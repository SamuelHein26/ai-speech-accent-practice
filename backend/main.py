import os
import subprocess
import asyncio
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from dotenv import load_dotenv
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.session_manager import SessionManager
from services.storage import SupabaseStorage, SupabaseStorageError
from services.transcription_service import TranscriptionService
from services.streaming_transcription_service import StreamingTranscriptionService
from services.openai_service import OpenAIService
from fastapi_utils.tasks import repeat_every
from routers import users, sessions, auth_router, streaming
from schemas import TopicRequest, TopicResponse

# Load environment variables
load_dotenv()

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
# === CORS Config ===
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://ai-speech-accent-practice.vercel.app",
]

configured_origins = os.getenv("CORS_ORIGINS", "").split(",")
configured_origins = [origin.strip() for origin in configured_origins if origin.strip()]

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    configured_origins.append(frontend_url.strip())

origins = configured_origins or default_origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,       # if you send cookies/auth headers
    allow_methods=["*"],          # important for POST/OPTIONS
    allow_headers=["*"],          # important for Authorization, Content-Type, etc.
)


app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(auth_router.router)
app.include_router(streaming.router)

# === Dependency Setup ===
WORKDIR = Path("./live_sessions")
WORKDIR.mkdir(parents=True, exist_ok=True)

storage = SupabaseStorage()
session_manager = SessionManager(WORKDIR, storage=storage)
transcriber = TranscriptionService(os.getenv("ASSEMBLYAI_API_KEY"))
openai_service = OpenAIService(os.getenv("OPENAI_API_KEY"))
stream_service = StreamingTranscriptionService()

@app.get("/")
def health():
    return {"status": "ok"}

        
@app.websocket("/ws/stream")
async def websocket_stream(ws: WebSocket):
    await ws.accept()
    await stream_service.proxy(ws)

# === Start Session ===
@app.post("/session/start")
async def start_session(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):

    user_id = None
    is_guest = False

    # Try to decode JWT (optional)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email:
            stmt = select(User).where(User.email == email)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            if user:
                user_id = user.id
    except JWTError:
        is_guest = True
    except Exception:
        is_guest = True

    # Fallback to guest if user not found or token invalid
    if not user_id:
        is_guest = True

    session = await session_manager.create_session(db, user_id=user_id, is_guest=is_guest)
    return {"session_id": session["session_id"], "is_guest": is_guest}

# === Upload Audio Chunk ===
@app.post("/session/{session_id}/chunk")
async def upload_chunk(session_id: str, file: UploadFile = File(...)):
    """Append chunk to session’s audio file."""
    path = session_manager.get_audio_path(session_id)
    async with asyncio.Lock():
        with open(path, "ab") as f:
            f.write(await file.read())
    return {"ready": True}


# === Finalize Session ===
@app.post("/session/{session_id}/finalize")
async def finalize_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Convert WebM → WAV, transcribe, and finalize session."""
    webm_path = session_manager.get_audio_path(session_id)
    wav_path = str(webm_path).replace(".webm", ".wav")

    if not os.path.exists(webm_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found at {webm_path}")

    # Step 1: Convert audio using ffmpeg asynchronously
    process = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(webm_path),
        "-ar", "16000", "-ac", "1", wav_path,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        raise HTTPException(status_code=500, detail=f"FFmpeg conversion failed: {stderr.decode()}")

    # Step 2: Probe duration (best effort)
    duration_seconds = None
    try:
        probe = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nokey=1:noprint_wrappers=1",
            wav_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, _ = await probe.communicate()
        duration_seconds = int(float(out.decode().strip()))
    except Exception:
        duration_seconds = None

    # Step 3: Transcribe & cleanup
    try:
        transcript = transcriber.transcribe_audio(wav_path)
        try:
            await session_manager.finalize_and_persist(
                db,
                session_id,
                transcript_text=transcript,
                wav_path=wav_path,
                duration_seconds=duration_seconds,
            )
        except SupabaseStorageError as exc:
            raise HTTPException(status_code=500, detail=str(exc))
        return {"final": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {e}")


# === Topic Generation ===
@app.post("/topics/generate", response_model=TopicResponse)
async def generate_topics(payload: TopicRequest):
    """Generate topic suggestions based on the user's recent monologue."""
    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty")

    try:
        topics = await asyncio.to_thread(openai_service.generate_topics, transcript)
        return TopicResponse(topics=topics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")


# === Feedback Analysis ===
@app.post("/feedback/analyze")
async def analyze_feedback(transcript: str):
    """Analyze speech feedback."""
    try:
        feedback = await asyncio.to_thread(openai_service.analyze_speech, transcript)
        return {"feedback": feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback generation failed: {e}")
