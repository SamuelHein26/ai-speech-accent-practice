# Comment: Accent training endpoints (FastAPI APIRouter).
#          Handles: upload clip -> transcribe -> evaluate -> persist -> respond.

from __future__ import annotations

import asyncio
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db                      # DI: returns AsyncSession
from models import PracticeAttempt, User        # ORM models (SQLAlchemy async)
from schemas import AccentTrainingResponse      # Pydantic response schema
from services.accent_engine import (           # biz logic: scoring / tips
    RecognisedWord,
    build_tip,
    evaluate_attempt,
)
from services.accent_transcriber import (      # ASR wrapper
    AccentTranscriber,
    AccentTranscriptionError,
)
from services.s3_audio_storage import S3AudioStorage  # S3 PUT + key gen


router = APIRouter(prefix="/accent", tags=["accent"])

# S3 client (long-lived singleton for perf / no re-init)
storage = S3AudioStorage()

# Transcriber singleton cache (lazy init)
_transcriber: Optional[AccentTranscriber] = None


def _get_transcriber() -> AccentTranscriber:
    """
    Lazy-init the ASR / STT engine (AccentTranscriber) and reuse it.
    Raises HTTP 500 if misconfigured (e.g. missing API key).
    """
    global _transcriber
    if _transcriber is None:
        try:
            _transcriber = AccentTranscriber()
        except ValueError as exc:  # e.g. no API key set for STT provider
            raise HTTPException(status_code=500, detail=str(exc))
    return _transcriber


def _pick_extension(file: UploadFile) -> str:
    """
    Derive a file extension to store in S3 based on the uploaded filename (fallback .webm).
    """
    filename = file.filename or "audio.webm"
    if "." in filename:
        return filename[filename.rfind(".") :]
    return ".webm"


def _coerce_user_id(value: str | None) -> Optional[uuid.UUID]:

    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        return None


@router.post("/train", response_model=AccentTrainingResponse)
async def train_accent(
    # Form(...) means this works with multipart/form-data along with the UploadFile.
    text: str = Form(...),               
    accent: str = Form(...),               
    userId: str | None = Form(None),       
    audio: UploadFile = File(...),         
    db: AsyncSession = Depends(get_db),    
):

    audio_bytes = await audio.read()  # await OK here (UploadFile.read is async)

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload")

    # pick extension for storage key
    ext = _pick_extension(audio)
    attempt_uuid = uuid.uuid4()
    object_key = f"recordings/{attempt_uuid}{ext}"

    # upload to S3 (network I/O). If your S3 client is sync/boto3, run it in a thread.
    try:
        await asyncio.to_thread(
            storage.put_object_bytes,     # we'll define this helper in S3AudioStorage
            audio_bytes,
            object_key,
            audio.content_type or "application/octet-stream",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"S3 upload failed: {exc}") from exc

    # === 2. Transcribe audio with word-level confidences =======================
    transcriber = _get_transcriber()

    try:
        # offload sync STT call to threadpool, so FastAPI event loop is not blocked
        transcript_text, word_entries = await asyncio.to_thread(
            transcriber.transcribe_with_words,
            audio_bytes,
        )
    except AccentTranscriptionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Normalise STT output into RecognisedWord list (DTO for scoring layer)
    recognised_words: List[RecognisedWord] = [
        RecognisedWord(
            word=entry.get("word", ""),
            confidence=float(entry.get("confidence", 0.0)),
        )
        for entry in word_entries
        if entry.get("word")
    ]

    # === 3. Score pronunciation / accent ======================================
    # evaluate_attempt() does:
    # - align expected 'text' vs recognised_words
    # - mark status per word ("ok"/"bad"/"accent_mismatch")
    # - compute overall score 0-100
    feedback_items, score = evaluate_attempt(
        text,
        recognised_words,
        accent_target=accent,
    )

    # build_tip() generates short coaching hints, e.g.
    # "Try pronouncing the R in 'weather' for American English."
    tips = build_tip(feedback_items, accent)

    # === 4. Resolve userId -> DB user (optional MVP auth binding) ==============
    db_user_id: uuid.UUID | None = None
    requested_id = _coerce_user_id(userId)
    if requested_id is not None:
        result = await db.execute(select(User.id).where(User.id == requested_id))
        db_user_id = result.scalar_one_or_none()

    # === 5. Persist attempt row ===============================================
    attempt = PracticeAttempt(
        attempt_id=attempt_uuid,
        user_id=db_user_id,
        accent_target=accent,
        expected_text=text,
        audio_path=object_key,
        transcript_raw=transcript_text,
        feedback_json=[item.to_response() for item in feedback_items],
        overall_score=score,
    )

    db.add(attempt)
    await db.commit()

    # === 6. Response payload for frontend UI ==================================
    return AccentTrainingResponse(
        attemptId=str(attempt_uuid),
        score=score,
        words=[item.to_response() for item in feedback_items],
        tips=tips,
        transcript=transcript_text,
    )
