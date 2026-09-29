import os
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables in Supabase / PostgreSQL if migrations were not run
    try:
        from core.db_base import Base
        from database import engine
        import models  # noqa: F401
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[Startup] Database tables verified / created successfully.")
    except Exception as exc:
        print(f"[Startup] Database initialization notice: {exc}")
    yield


app = FastAPI(lifespan=lifespan)


# === Global Exception Handler for CORS-compliant error responses ===
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )


# === CORS Config ===
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://ai-speech-accent-practice.vercel.app",
]

configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url and frontend_url.strip():
    configured_origins.append(frontend_url.strip())

# Always preserve localhost and default Vercel domains, plus any custom configured origins
origins = list(dict.fromkeys(default_origins + configured_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
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
