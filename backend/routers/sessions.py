# routers/sessions.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from pathlib import Path
from services.auth import get_current_user
from services.session_manager import SessionManager
from services.transcription_service import TranscriptionService
import os, asyncio, subprocess
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/session", tags=["Sessions"])

session_manager = SessionManager(Path("./live_sessions"))
transcriber = TranscriptionService(os.getenv("ASSEMBLYAI_API_KEY"))

# === Start a new session ===
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

    session = await session_manager.create_session(db, user_id=user_id, is_guest=is_guest)
    return {"session_id": session["session_id"], "is_guest": is_guest}


# === Upload Audio Chunk ===
@router.post("/{session_id}/chunk")
async def upload_chunk(session_id: str, file: UploadFile = File(...)):
    """Append chunk to session’s audio file."""
    path = session_manager.get_audio_path(session_id)
    async with asyncio.Lock():
        with open(path, "ab") as f:
            f.write(await file.read())
    return {"ready": True}


# === Finalize Session ===
@router.post("/{session_id}/finalize")
async def finalize_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Convert WebM → WAV, transcribe, and finalize."""
    webm_path = session_manager.get_audio_path(session_id)
    wav_path = str(webm_path).replace(".webm", ".wav")

    if not os.path.exists(webm_path):
        raise HTTPException(status_code=404, detail="Audio file not found.")

    process = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(webm_path),
        "-ar", "16000", "-ac", "1", wav_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await process.communicate()
    if process.returncode != 0:
        raise HTTPException(status_code=500, detail=f"FFmpeg error: {stderr.decode()}")

    transcript = transcriber.transcribe_audio(wav_path)
    await session_manager.finalize_session(db, session_id)
    return {"final": transcript}
