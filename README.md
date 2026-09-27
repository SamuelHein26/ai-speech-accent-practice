# ComfTalk — AI Speech & Accent Practice

A full-stack platform that helps learners improve spoken English through real-time AI coaching. The FastAPI backend handles authentication, session management, audio transcription via Deepgram, and AI feedback via Gemini or Ollama. The Next.js frontend delivers the practice experience.

## Features

- **Monologue Studio** — Up to 3-minute speaking sessions with live Deepgram streaming transcription, automatic silence detection, pause/pacing analysis, filler word tracking, and LLM-generated coaching.
- **Accent Training** — Phrase-reading drills scored against American or British English using word-level confidence and phoneme heuristics.
- **Dashboard** — History, audio playback, and deletion for both session types.
- **User Accounts** — JWT authentication, registration, and profile management backed by PostgreSQL.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11+, SQLAlchemy 2.0 (async), Alembic |
| Database | PostgreSQL (Supabase or local PostgreSQL) |
| Speech-to-Text | Deepgram nova-2 (streaming + pre-recorded) |
| LLM | Google Gemini 2.5 Flash or local Ollama |
| Audio Storage | Supabase Storage (or local disk fallback) |
| Frontend | Next.js 15, React 19, Tailwind CSS v4 |

## Project Structure

```
.
├── .env                    # Environment variables — never commit
├── backend/
│   ├── main.py             # FastAPI app entrypoint, CORS, LLM endpoints
│   ├── models.py           # SQLAlchemy ORM models (User, Session, PracticeAttempt)
│   ├── schemas.py          # Pydantic request/response schemas
│   ├── database.py         # Async engine and session factory
│   ├── alembic/            # Database migrations
│   ├── routers/
│   │   ├── auth.py         # POST /login, GET /me
│   │   ├── users.py        # Registration, login (JSON), profile
│   │   ├── sessions.py     # Monologue session lifecycle and audio
│   │   ├── accent.py       # Accent training attempts and history
│   │   └── streaming.py    # WebSocket /ws/stream proxy to Deepgram
│   └── services/
│       ├── auth_service.py         # JWT creation, password hashing
│       ├── deepgram_service.py     # Batch transcription (monologue + accent)
│       ├── deepgram_streaming.py   # Real-time WebSocket proxy to Deepgram
│       ├── llm_service.py          # Gemini / Ollama / OpenAI abstraction
│       ├── audio_storage.py        # Supabase Storage + local disk storage
│       ├── session_manager.py      # Session lifecycle, archival, cleanup
│       └── accent_engine.py        # Needleman-Wunsch alignment, phoneme heuristics
└── frontend/
    └── app/                # Next.js App Router pages and components
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+ (or a free [Supabase](https://supabase.com) project)
- [Deepgram](https://deepgram.com) API key (free \$200 credit on sign-up)
- [Gemini](https://aistudio.google.com) API key **or** [Ollama](https://ollama.com) running locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head            # Create database tables
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env` file in the **project root** (next to `backend/` and `frontend/`):

```env
# Database (Supabase PostgreSQL or local)
DATABASE_URL=postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require

# Auth
SECRET_KEY=your-secret-key-here

# Deepgram (required for all transcription)
DEEPGRAM_API_KEY=your-deepgram-key

# LLM Backend — choose one
LLM_BACKEND=ollama              # "gemini" for cloud, "ollama" for local

# Gemini (when LLM_BACKEND=gemini)
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash   # optional, this is the default

# Ollama (when LLM_BACKEND=ollama)
OLLAMA_MODEL=gemma3:4b
OLLAMA_BASE_URL=http://localhost:11434/v1

# Supabase Storage (optional — falls back to local disk if not set)
STORAGE_ENDPOINT_URL=https://[project-ref].storage.supabase.co/v1/s3
STORAGE_ACCESS_KEY_ID=your-supabase-access-key-id
STORAGE_SECRET_ACCESS_KEY=your-supabase-secret-access-key
STORAGE_BUCKET=recordings
STORAGE_REGION=us-east-1

# CORS (optional)
CORS_ORIGINS=https://yourapp.vercel.app
FRONTEND_URL=https://yourapp.vercel.app
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase or local). Use `sslmode=require` for Supabase. |
| `SECRET_KEY` | JWT signing secret. Required — use a long random string in production. |
| `DEEPGRAM_API_KEY` | Required for all transcription (streaming and batch). |
| `LLM_BACKEND` | `gemini`, `ollama`, or `openai`. Controls which LLM is used. |
| `GEMINI_API_KEY` | Required when `LLM_BACKEND=gemini`. |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-2.5-flash`). |
| `OLLAMA_BASE_URL` | Ollama API base URL (default: `http://localhost:11434/v1`). |
| `OLLAMA_MODEL` | Ollama model name (default: `llama3.2:3b`). |
| `STORAGE_ENDPOINT_URL` | Supabase Storage S3 endpoint URL (`https://<project-ref>.storage.supabase.co/v1/s3`). |
| `STORAGE_BUCKET` | Storage bucket name created in Supabase (default: `recordings`). |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | S3 Access Keys generated in Supabase (Project Settings → Storage). |
| `STORAGE_REGION` | Supabase region (e.g. `us-east-1`). |
| `DATABASE_SSL` | Set to `true` to force SSL. Auto-detected when `sslmode=require` is in the URL. |
