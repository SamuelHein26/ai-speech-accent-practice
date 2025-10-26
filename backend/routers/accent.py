"""Endpoints for accent training attempts."""

from __future__ import annotations

import asyncio
import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import PracticeAttempt
from schemas import AccentTrainingResponse
from services.accent_engine import (
    RecognisedWord,
    build_tip,
    evaluate_attempt,
)
from services.accent_transcriber import AccentTranscriber, AccentTranscriptionError
from services.s3_audio_storage import S3AudioStorage


router = APIRouter(prefix="/accent", tags=["accent"])

storage = S3AudioStorage()
_transcriber: AccentTranscriber | None = None


def _get_transcriber() -> AccentTranscriber:
    global _transcriber
    if _transcriber is None:
        try:
            _transcriber = AccentTranscriber()
        except ValueError as exc:  # Missing API key
            raise HTTPException(status_code=500, detail=str(exc))
    return _transcriber


@router.post("/train", response_model=AccentTrainingResponse)
async def train_accent(
    *,
    audio: UploadFile = File(...),
    text: str = Form(...),
    accentTarget: str = Form(...),
    userId: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
):
    accent = accentTarget.lower()
    if accent not in {"american", "british"}:
        raise HTTPException(status_code=400, detail="accentTarget must be american or british")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    attempt_uuid = uuid.uuid4()
    object_key = f"{accent}/{attempt_uuid}{_pick_extension(audio)}"

    stored_key = await storage.store_bytes(
        object_key,
        audio_bytes,
        content_type=audio.content_type or "application/octet-stream",
    )

    transcriber = _get_transcriber()

    try:
        transcript_text, word_entries = await asyncio.to_thread(
            transcriber.transcribe_with_words,
            audio_bytes,
        )
    except AccentTranscriptionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    recognised_words: List[RecognisedWord] = [
        RecognisedWord(word=entry.get("word", ""), confidence=float(entry.get("confidence", 0.0)))
        for entry in word_entries
        if entry.get("word")
    ]

    feedback_items, score = evaluate_attempt(
        text,
        recognised_words,
        accent_target=accent,
    )
    tips = build_tip(feedback_items, accent)

    attempt = PracticeAttempt(
        attempt_id=attempt_uuid,
        user_id=_coerce_user_id(userId),
        accent_target=accent,
        expected_text=text,
        audio_path=stored_key,
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


def _pick_extension(file: UploadFile) -> str:
    filename = file.filename or "audio.webm"
    if "." in filename:
        return filename[filename.rfind(".") :]
    return ".webm"


def _coerce_user_id(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(value)
        coerced = int(value)
        if coerced <= 0:
            return None
        return coerced
    except (ValueError, TypeError):
        return None