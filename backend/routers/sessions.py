# routers/sessions.py
import asyncio
import os
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dotenv import load_dotenv
from models import Session, User
from schemas import SessionSummary
from services.auth import get_current_user
from services.session_manager import SessionManager
from services.storage import S3Storage, StorageError
from services.transcription_service import TranscriptionService

load_dotenv()

router = APIRouter(prefix="/session", tags=["Sessions"])

storage = S3Storage()
session_manager = SessionManager(Path("./live_sessions"), storage=storage)
transcriber = TranscriptionService(os.getenv("ASSEMBLYAI_API_KEY"))

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
    """Return the number of filler phrases detected in the transcript."""

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

@router.post("/start")
async def start_session(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new session (user or guest)."""
    user_id = None
    is_guest = True
    if current_user:
        user_id = current_user.id
        is_guest = False
    return await session_manager.create_session(db, user_id=user_id, is_guest=is_guest)

@router.post("/{session_id}/chunk")
async def upload_chunk(session_id: str, file: UploadFile = File(...)):
    """Append chunk to session’s audio file (WebM container)."""
    path = session_manager.get_audio_path(session_id)
    # NOTE: MediaRecorder gives chunks; here we just append; no CPU bound work.
    async with asyncio.Lock():
        with open(path, "ab") as f:
            f.write(await file.read())
    return {"ready": True}

@router.post("/{session_id}/finalize")
async def finalize_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """
    Convert WebM → WAV, transcribe via AssemblyAI, then persist (if user) or purge (if guest).
    Returns the final transcript in the HTTP response regardless of persistence path.
    """
    webm_path = session_manager.get_audio_path(session_id)
    wav_path = str(webm_path).replace(".webm", ".wav")

    if not os.path.exists(webm_path):
        raise HTTPException(status_code=404, detail="Audio file not found.")

    # 1) Transcode to mono/16k WAV (AssemblyAI-friendly + consistent archive)
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(webm_path),
        "-ar", "16000", "-ac", "1",
        wav_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, err = await proc.communicate()
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=f"FFmpeg error: {err.decode()}")

    # 2) Probe duration (non-fatal)
    duration_seconds: int | None = None
    try:
        probe = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=nokey=1:noprint_wrappers=1",
            wav_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, _ = await probe.communicate()
        duration_seconds = int(float(out.decode().strip()))
    except Exception:
        duration_seconds = None

    # 3) Transcribe synchronously (network I/O inside TranscriptionService)
    try:
        transcript = transcriber.transcribe_audio(wav_path)
    except Exception as e:
        # Clean temp dir on failure; leave DB untouched
        raise HTTPException(status_code=500, detail=f"Transcription error: {e}")

    filler_word_count = count_filler_words(transcript)

    # 4) Persist (users) or purge (guests)
    try:
        await session_manager.finalize_and_persist(
            db,
            session_id,
            transcript_text=transcript,
            wav_path=wav_path,
            duration_seconds=duration_seconds,
            filler_word_count=filler_word_count,
        )
    except StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    audio_url: str | None = None
    stmt = select(Session).where(Session.session_id == session_id)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row and row.audio_path:
        audio_url = f"/session/{session_id}/audio"

    return {
        "final": transcript,
        "filler_word_count": filler_word_count,
        "audio_url": audio_url,
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

    # Download from S3 (or read locally) and return the raw bytes directly.
    try:
        if storage.is_configured():
            audio_bytes = await storage.download_audio(session.audio_path)
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
                await storage.delete_audio(session.audio_path)
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
