# Comment: Accent training endpoints (FastAPI APIRouter).
#          Handles: upload clip -> transcribe -> evaluate -> persist -> respond.

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db                    
from models import PracticeAttempt, User       
from schemas import AccentAttemptSummary, AccentTrainingResponse
from services.accent_engine import (           
    RecognisedWord,
    build_tip,
    evaluate_attempt,
)
from services.accent_transcriber import (      
    AccentTranscriber,
    AccentTranscriptionError,
)
from services.s3_audio_storage import S3AudioStorage  
from services.storage import StorageError
from services.auth import get_current_user


router = APIRouter(prefix="/accent", tags=["accent"])
storage = S3AudioStorage()

_transcriber: Optional[AccentTranscriber] = None


def _get_transcriber() -> AccentTranscriber:
    global _transcriber
    if _transcriber is None:
        try:
            _transcriber = AccentTranscriber()
        except ValueError as exc: 
            raise HTTPException(status_code=500, detail=str(exc))
    return _transcriber


def _pick_extension(file: UploadFile) -> str:
    filename = file.filename or "audio.webm"
    if "." in filename:
        return filename[filename.rfind(".") :]
    return ".webm"


def _media_type_from_path(path: str) -> str:
    lowered = path.lower()
    if lowered.endswith(".wav"):
        return "audio/wav"
    if lowered.endswith(".mp3"):
        return "audio/mpeg"
    if lowered.endswith(".ogg") or lowered.endswith(".oga"):
        return "audio/ogg"
    if lowered.endswith(".m4a") or lowered.endswith(".mp4"):
        return "audio/mp4"
    return "audio/webm"


def _coerce_user_id(value: str | None) -> Optional[int]:

    if not value:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


@router.post("/train", response_model=AccentTrainingResponse)
async def train_accent(
    text: str = Form(...),
    accent: str = Form(...),
    userId: str | None = Form(None),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):

    audio_bytes = await audio.read() 

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload")

    ext = _pick_extension(audio)
    attempt_uuid = uuid.uuid4()
    object_key = f"{attempt_uuid}{ext}"

    try:
        stored_audio_path = await storage.store_bytes(
            object_key,
            audio_bytes,
            content_type=audio.content_type or "application/octet-stream",
        )
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Audio storage failed: {exc}") from exc

    transcriber = _get_transcriber()

    try:
        transcript_text, word_entries = await asyncio.to_thread(
            transcriber.transcribe_with_words,
            audio_bytes,
        )
    except AccentTranscriptionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    recognised_words: List[RecognisedWord] = [
        RecognisedWord(
            word=entry.get("word", ""),
            confidence=float(entry.get("confidence", 0.0)),
        )
        for entry in word_entries
        if entry.get("word")
    ]

    feedback_items, score = evaluate_attempt(
        text,
        recognised_words,
        accent_target=accent,
    )

    tips = build_tip(feedback_items, accent)
    db_user_id: Optional[int] = None
    if current_user is not None:
        db_user_id = current_user.id
    else:
        requested_id = _coerce_user_id(userId)
        if requested_id is not None:
            result = await db.execute(select(User.id).where(User.id == requested_id))
            db_user_id = result.scalar_one_or_none()
            
    attempt = PracticeAttempt(
        attempt_id=attempt_uuid,
        user_id=db_user_id,
        accent_target=accent,
        expected_text=text,
        audio_path=stored_audio_path,
        transcript_raw=transcript_text,
        feedback_json=[item.to_response() for item in feedback_items],
        overall_score=score,
    )

    db.add(attempt)
    await db.commit()

    return AccentTrainingResponse(
        attemptId=str(attempt_uuid),
        score=score,
        words=[item.to_response() for item in feedback_items],
        tips=tips,
        transcript=transcript_text,
    )


@router.get("/history", response_model=list[AccentAttemptSummary])
async def accent_history(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = (
        select(
            PracticeAttempt.attempt_id,
            PracticeAttempt.created_at,
            PracticeAttempt.accent_target,
            PracticeAttempt.overall_score,
            PracticeAttempt.transcript_raw,
            PracticeAttempt.audio_path,
        )
        .where(PracticeAttempt.user_id == current_user.id)
        .order_by(PracticeAttempt.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    summaries: list[AccentAttemptSummary] = []
    for row in rows:
        score_value = None
        if row.overall_score is not None:
            score_value = float(row.overall_score)

        summaries.append(
            AccentAttemptSummary(
                attempt_id=str(row.attempt_id),
                created_at=row.created_at,
                accent_target=row.accent_target,
                score=score_value,
                transcript=row.transcript_raw,
                audio_available=bool(row.audio_path),
            )
        )

    return summaries


@router.get("/{attempt_id}", response_model=AccentAttemptSummary)
async def accent_detail(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = (
        select(
            PracticeAttempt.attempt_id,
            PracticeAttempt.created_at,
            PracticeAttempt.accent_target,
            PracticeAttempt.overall_score,
            PracticeAttempt.transcript_raw,
            PracticeAttempt.audio_path,
        )
        .where(PracticeAttempt.attempt_id == attempt_id)
        .where(PracticeAttempt.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Recording not found")

    score_value = None
    if row.overall_score is not None:
        score_value = float(row.overall_score)

    return AccentAttemptSummary(
        attempt_id=str(row.attempt_id),
        created_at=row.created_at,
        accent_target=row.accent_target,
        score=score_value,
        transcript=row.transcript_raw,
        audio_available=bool(row.audio_path),
    )


@router.get("/{attempt_id}/audio")
async def accent_audio(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = select(PracticeAttempt).where(PracticeAttempt.attempt_id == attempt_id)
    result = await db.execute(stmt)
    attempt = result.scalar_one_or_none()

    if not attempt or attempt.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recording not found")

    if not attempt.audio_path:
        raise HTTPException(status_code=404, detail="Audio file unavailable")

    try:
        audio_bytes = await storage.download_audio(attempt.audio_path)
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    media_type = _media_type_from_path(attempt.audio_path)
    suffix = Path(attempt.audio_path).suffix or ".webm"
    filename = f"{attempt.attempt_id}{suffix}"

    headers = {
        "Cache-Control": "no-store",
        "Content-Disposition": f"inline; filename={filename}",
        "Content-Length": str(len(audio_bytes)),
    }

    return Response(content=audio_bytes, media_type=media_type, headers=headers)


@router.delete("/{attempt_id}", status_code=204)
async def delete_accent_attempt(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = select(PracticeAttempt).where(PracticeAttempt.attempt_id == attempt_id)
    result = await db.execute(stmt)
    attempt = result.scalar_one_or_none()

    if not attempt or attempt.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recording not found")

    if attempt.audio_path:
        try:
            await storage.delete_audio(attempt.audio_path)
        except StorageError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover - defensive guard
            raise HTTPException(status_code=500, detail=f"Failed to delete audio: {exc}") from exc

    await db.delete(attempt)
    await db.commit()

    return Response(status_code=204)
