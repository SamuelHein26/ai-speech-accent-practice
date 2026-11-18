import asyncio
import os
import re
import uuid
import wave
from tempfile import TemporaryDirectory
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dotenv import load_dotenv
from models import Session, User
from schemas import SessionSummary
from services.auth_service import get_current_user, require_current_user
from services.audio_storage import AudioStorage, StorageError
from services.deepgram_service import DeepgramError, DeepgramService

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

router = APIRouter(prefix="/session", tags=["Sessions"])

storage = AudioStorage()

_transcriber: Optional[DeepgramService] = None

def _get_transcriber() -> DeepgramService:
    global _transcriber
    if _transcriber is None:
        key = os.getenv("DEEPGRAM_API_KEY")
        if not key:
            raise HTTPException(status_code=500, detail="Missing Deepgram API key.")
        _transcriber = DeepgramService(key)
    return _transcriber

FILLER_PHRASES: tuple[tuple[str, ...], ...] = (
    ("um",),
    ("uh",),
    ("erm",),
    ("hmm",),
    ("like",),
    ("so",),
    ("actually",),
    ("basically",),
    ("literally",),
    ("you", "know"),
    ("i", "mean"),
    ("kind", "of"),
    ("sort", "of"),
)


def count_filler_words(transcript: str | None) -> int:

    if not transcript:
        return 0

    tokens = re.findall(r"[a-zA-Z']+", transcript.lower())
    total = 0

    for phrase in FILLER_PHRASES:
        size = len(phrase)
        if size == 0:
            continue
        for idx in range(len(tokens) - size + 1):
            if tokens[idx : idx + size] == list(phrase):
                total += 1

    return total

@router.post("/complete")
async def complete_session(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_current_user),
):
    limit = 20 * 1024 * 1024
    audio = await file.read(limit + 1)
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    if len(audio) > limit:
        raise HTTPException(status_code=413, detail="Recording exceeds 20 MB.")

    with TemporaryDirectory(prefix="comftalk-") as workdir:
        source = Path(workdir) / "recording"
        wav = Path(workdir) / "recording.wav"
        await asyncio.to_thread(source.write_bytes, audio)

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-nostdin", "-loglevel", "error",
            "-format_whitelist", "matroska,webm,ogg,mov,mp4,m4a,3gp,3g2,mj2,wav",
            "-i", str(source), "-t", "180", "-ar", "16000", "-ac", "1", str(wav),
            stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            await asyncio.wait_for(proc.wait(), timeout=30)
        except (TimeoutError, asyncio.CancelledError):
            if proc.returncode is None:
                proc.kill()
                await proc.wait()
            raise
        if proc.returncode != 0:
            raise HTTPException(status_code=422, detail="Unable to read this recording.")

        # Read duration from the converted WAV so usage matches the audio analyzed.
        with wave.open(str(wav), "rb") as converted:
            duration = round(converted.getnframes() / converted.getframerate())

        try:
            transcript, timing = await asyncio.to_thread(
                _get_transcriber().transcribe_with_timing, str(wav)
            )
        except DeepgramError as exc:
            raise HTTPException(status_code=502, detail="Transcription is unavailable.") from exc

    filler_count = count_filler_words(transcript)
    db.add(Session(
        session_id=str(uuid.uuid4()),
        user_id=current_user.id,
        duration_seconds=duration,
        filler_word_count=filler_count,
    ))
    await db.commit()

    return {
        "final": timing.get("annotated_transcript", transcript),
        "filler_word_count": filler_count,
    }


@router.get("/history", response_model=list[SessionSummary])
async def session_history(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = (
        select(
            Session.id,
            Session.session_id,
            Session.created_at,
            Session.duration_seconds,
            Session.final_transcript,
            Session.filler_word_count,
            Session.audio_path.isnot(None).label("audio_available"),
        )
        .where(Session.user_id == current_user.id)
        .order_by(Session.created_at.desc())
    )
    result = await db.execute(stmt)
    sessions = result.all()

    return [
        SessionSummary(
            id=row.id,
            session_id=row.session_id,
            created_at=row.created_at,
            duration_seconds=row.duration_seconds,
            final_transcript=row.final_transcript,
            filler_word_count=row.filler_word_count,
            audio_available=row.audio_available,
        )
        for row in sessions
    ]


@router.get("/{session_id}", response_model=SessionSummary)
async def session_detail(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = (
        select(
            Session.id,
            Session.session_id,
            Session.created_at,
            Session.duration_seconds,
            Session.final_transcript,
            Session.filler_word_count,
            Session.audio_path.isnot(None).label("audio_available"),
        )
        .where(Session.session_id == session_id)
        .where(Session.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Recording not found")

    return SessionSummary(
        id=row.id,
        session_id=row.session_id,
        created_at=row.created_at,
        duration_seconds=row.duration_seconds,
        final_transcript=row.final_transcript,
        filler_word_count=row.filler_word_count,
        audio_available=row.audio_available,
    )


@router.get("/{session_id}/audio")
async def get_session_audio(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = select(Session).where(Session.session_id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recording not found")

    if not session.audio_path:
        raise HTTPException(status_code=404, detail="Audio file unavailable")

    try:
        if storage.is_configured():
            audio_bytes = await storage.download(session.audio_path)
        else:
            file_path = Path(session.audio_path)
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Audio file unavailable")
            audio_bytes = file_path.read_bytes()
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    headers = {
        "Cache-Control": "no-store",
        "Content-Disposition": f"inline; filename={session.session_id}.wav",
        "Content-Length": str(len(audio_bytes)),
    }

    return Response(content=audio_bytes, media_type="audio/wav", headers=headers)


@router.delete("/{session_id}", status_code=204)
async def delete_session_recording(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    stmt = select(Session).where(Session.session_id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recording not found")

    if session.audio_path:
        if storage.is_configured():
            try:
                await storage.delete(session.audio_path)
            except StorageError as exc:
                raise HTTPException(status_code=502, detail=str(exc))
        else:
            file_path = Path(session.audio_path)
            if file_path.exists():
                try:
                    file_path.unlink()
                except OSError as exc:
                    raise HTTPException(status_code=500, detail=f"Failed to delete audio file: {exc}")

    await db.delete(session)
    await db.commit()

    return Response(status_code=204)
