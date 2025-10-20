import os
import subprocess
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import users, sessions
from database import Base, engine
from services.session_manager import SessionManager
from services.transcription_service import TranscriptionService
from services.openai_service import OpenAIService

# Load environment variables
load_dotenv()

# Initialize FastAPI Application 
app = FastAPI(title="Monologue AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Dependency Injection Setup ===
WORKDIR = Path("./live_sessions")
WORKDIR.mkdir(parents=True, exist_ok=True)

session_manager = SessionManager(WORKDIR)
transcriber = TranscriptionService(os.getenv("ASSEMBLYAI_API_KEY"))
openai_service = OpenAIService(os.getenv("OPENAI_API_KEY"))

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(users.router)
app.include_router(sessions.router)

@app.get("/ping")
def ping():
    """Health check endpoint."""
    return {"message": "pong"}


@app.post("/session/start")
def start_session(user_id: str):
    """Create a new user session."""
    session_id = session_manager.create_session(user_id)
    return {"session_id": session_id}


@app.post("/session/{session_id}/chunk")
async def upload_chunk(session_id: str, file: UploadFile = File(...)):
    """Append chunk to session’s audio file."""
    path = session_manager.get_audio_path(session_id)
    with open(path, "ab") as f:
        f.write(await file.read())
    return {"ready": True}


@app.post("/session/{session_id}/finalize")
def finalize_session(session_id: str):
    """Convert WebM → WAV, transcribe, and return final transcript."""
    webm_path = session_manager.get_audio_path(session_id)
    wav_path = str(webm_path).replace(".webm", ".wav")

    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(webm_path), "-ar", "16000", "-ac", "1", wav_path],
        capture_output=True,
        text=True,
    )

    try:
        transcript = transcriber.transcribe_audio(wav_path)
        session_manager.finalize_session(session_id)
        return {"final": transcript}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/topics/generate")
def generate_topics(transcript: str):
    """Generate topic suggestions mid-monologue."""
    try:
        topics = openai_service.generate_topics(transcript)
        return {"topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {e}")


@app.post("/feedback/analyze")
def analyze_feedback(transcript: str):
    """Generate speech improvement feedback post-recording."""
    try:
        feedback = openai_service.analyze_speech(transcript)
        return {"feedback": feedback}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback generation failed: {e}")


@app.on_event("startup")
def warmup_model():
    """Optional: Pre-warm the AssemblyAI model (no-op for API mode)."""
    print("✅ Backend initialized: services loaded and ready.")
