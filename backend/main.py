import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import users, sessions, auth_router, streaming
from services.session_manager import SessionManager
from services.storage import SupabaseStorage
from services.transcription_service import TranscriptionService
from services.streaming_transcription_service import StreamingTranscriptionService
from services.openai_service import OpenAIService

# Load environment variables
load_dotenv()

app = FastAPI()

# === CORS Config - MUST BE FIRST ===
origins = [
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# === Include Routers ===
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(auth_router.router)
app.include_router(streaming.router)

@app.get("/")
def health():
    return {"status": "ok"}