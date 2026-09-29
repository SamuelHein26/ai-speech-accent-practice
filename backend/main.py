import os
import asyncio
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from services.llm_service import _build_service as _build_llm_service
from routers import users, sessions, auth, streaming, accent
from schemas import (
    FeedbackRequest,
    FeedbackResponse,
    TopicRequest,
    TopicResponse,
)

# Load .env from the project root (one level above backend/)
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI()
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# === Include Routers ===
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(auth.router)
app.include_router(streaming.router)
app.include_router(accent.router)

# === Dependency Setup ===
openai_service = _build_llm_service()

@app.api_route("/", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}

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
@app.post("/feedback/analyze", response_model=FeedbackResponse)
async def analyze_feedback(payload: FeedbackRequest):
    """Analyze speech feedback."""

    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is empty")

    try:
        feedback = await asyncio.to_thread(openai_service.analyze_speech, transcript)
        return FeedbackResponse(feedback=feedback)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback generation failed: {e}")
