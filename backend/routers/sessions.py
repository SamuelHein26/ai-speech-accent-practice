# routers/sessions.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from pathlib import Path
from services.auth import get_current_user
from services.session_manager import SessionManager
from services.transcription_service import TranscriptionService
import os, asyncio
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(prefix="/session", tags=["Sessions"])

session_manager = SessionManager(Path("./live_sessions"))
transcriber = TranscriptionService(os.getenv("ASSEMBLYAI_API_KEY"))

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

    # 4) Persist (users) or purge (guests)
    await session_manager.finalize_and_persist(
        db,
        session_id,
        transcript_text=transcript,
        wav_path=wav_path,
        duration_seconds=duration_seconds,
    )

    return {"final": transcript}
