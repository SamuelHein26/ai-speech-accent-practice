# ComfTalk — AI Speech & Accent Practice

A full-stack platform that helps learners improve spoken English through real-time AI coaching. Practice monologues with live transcription and instant feedback, or train your accent with phrase-reading drills scored against native pronunciation patterns.

## Features

- **Monologue Studio** — Record up to 3-minute speaking sessions with live Deepgram streaming transcription, automatic pause/pacing detection, filler word tracking (`um`, `uh`, `you know`, etc.), and AI-generated coaching feedback.
- **Accent Training** — Read phrases aloud and receive word-by-word scoring against American or British English using Deepgram confidence data and phoneme heuristic alignment (Needleman-Wunsch).
- **Dashboard** — Browse session history, replay audio, view transcripts with `[pause]` annotations, and delete old recordings.
- **User Accounts** — JWT-based authentication with registration, login, and profile management.

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI · Python 3.11+ · SQLAlchemy 2.0 (async) · Alembic |
| **Database** | Supabase PostgreSQL (transaction pooler, port 6543) |
| **Speech-to-Text** | Deepgram nova-2 — streaming WebSocket + pre-recorded batch |
| **LLM** | Google Gemini 2.5 Flash (production) · Ollama (local dev) |
| **Audio Storage** | Supabase Storage (S3-compatible) · local disk fallback |
| **Frontend** | Next.js 15 · React 19 · Tailwind CSS v4 · next-themes |
| **Hosting** | Render (backend) · Vercel (frontend) |

## Project Structure

```
.
├── .env                    # Environment variables — never commit
├── backend/
│   ├── main.py             # FastAPI entrypoint, CORS, health check, LLM endpoints
│   ├── database.py         # Async SQLAlchemy engine (Supabase SSL, PgBouncer compat)
│   ├── models.py           # ORM models: User, Session, PracticeAttempt
│   ├── schemas.py          # Pydantic request/response schemas
│   ├── alembic/            # Database migrations
│   ├── routers/
│   │   ├── auth.py         # POST /login, GET /me
│   │   ├── users.py        # Registration, login (JSON), profile CRUD
│   │   ├── sessions.py     # Monologue session lifecycle, audio upload/playback
│   │   ├── accent.py       # Accent training attempts, history, audio storage
│   │   └── streaming.py    # WebSocket /ws/stream → Deepgram real-time proxy
│   ├── services/
│   │   ├── llm_service.py          # Gemini / Ollama / OpenAI abstraction layer
│   │   ├── deepgram_service.py     # Batch transcription: DeepgramService + DeepgramAccentService
│   │   ├── deepgram_streaming.py   # Real-time WebSocket proxy (DeepgramStreamingService)
│   │   ├── audio_storage.py        # S3-compatible storage (AudioStorage) + local fallback
│   │   ├── auth_service.py         # JWT creation/validation, password hashing (bcrypt)
│   │   ├── session_manager.py      # Session lifecycle, audio archival, guest cleanup
│   │   └── accent_engine.py        # Needleman-Wunsch alignment, phoneme heuristics
│   └── tests/
│       ├── test_llm_service.py     # LLM backend factory + Gemini mock tests
│       ├── test_accent_engine.py   # Alignment and scoring tests
│       ├── test_auth_unit.py       # JWT and password hashing tests
│       └── test_filler_words.py    # Filler word counting tests
└── frontend/
    └── app/                # Next.js 15 App Router
        ├── page.tsx                # Landing page
        ├── monologue/page.tsx      # Monologue recording studio
        ├── accent/page.tsx         # Accent training drills
        ├── dashboard/              # Session history (monologue + accent)
        ├── profile/page.tsx        # User profile
        ├── register/page.tsx       # Registration page
        ├── about/page.tsx          # About page
        ├── components/             # Header, Footer, LoginModal, ThemeToggle
        └── lib/api.ts              # API base URL config
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- A free [Supabase](https://supabase.com) project (database + optional storage)
- [Deepgram](https://deepgram.com) API key (free \$200 credit on sign-up)
- [Gemini](https://aistudio.google.com) API key **or** [Ollama](https://ollama.com) running locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head            # Run database migrations
uvicorn main:app --reload       # Starts on http://localhost:8000
```

> **Note:** Tables are also auto-created on startup via `Base.metadata.create_all` if migrations haven't been run yet.

### Frontend

```bash
cd frontend
npm install
npm run dev                     # Starts on http://localhost:3000
```

## Environment Variables

Create a `.env` file in the **project root** (next to `backend/` and `frontend/`):

```env
# ── Database (Supabase PostgreSQL) ──────────────────────────────
DATABASE_URL=postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require

# ── Auth ────────────────────────────────────────────────────────
SECRET_KEY=your-secret-key-here           # openssl rand -hex 32

# ── Deepgram (required — all transcription) ─────────────────────
DEEPGRAM_API_KEY=your-deepgram-key

# ── LLM Backend ────────────────────────────────────────────────
LLM_BACKEND=gemini                        # "gemini" | "ollama" | "openai"

# Gemini (when LLM_BACKEND=gemini)
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash             # optional, this is the default

# Ollama (when LLM_BACKEND=ollama)
OLLAMA_MODEL=gemma3:4b
OLLAMA_BASE_URL=http://localhost:11434/v1

# ── Supabase Storage (optional — falls back to local disk) ─────
STORAGE_ENDPOINT_URL=https://[project-ref].storage.supabase.co/v1/s3
STORAGE_ACCESS_KEY_ID=your-supabase-s3-access-key
STORAGE_SECRET_ACCESS_KEY=your-supabase-s3-secret-key
STORAGE_BUCKET=recordings
STORAGE_REGION=us-east-1

# ── CORS (optional — localhost + *.vercel.app allowed by default)
CORS_ORIGINS=https://yourcustomdomain.com
FRONTEND_URL=https://ai-speech-accent-practice.vercel.app
```

### Variable Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Supabase PostgreSQL connection string. Use the **transaction pooler** (port `6543`) with `?sslmode=require`. The backend auto-strips `sslmode` for asyncpg and handles SSL internally. |
| `SECRET_KEY` | **Yes** | JWT signing secret. Use a long random string (`openssl rand -hex 32`). |
| `DEEPGRAM_API_KEY` | **Yes** | Required for all transcription — streaming and batch. |
| `LLM_BACKEND` | **Yes** | `gemini` (production), `ollama` (local dev), or `openai` (legacy). |
| `GEMINI_API_KEY` | When gemini | Required when `LLM_BACKEND=gemini`. |
| `GEMINI_MODEL` | No | Gemini model name. Default: `gemini-2.5-flash`. |
| `OLLAMA_BASE_URL` | No | Ollama API URL. Default: `http://localhost:11434/v1`. |
| `OLLAMA_MODEL` | No | Ollama model name. Default: `llama3.2:3b`. |
| `STORAGE_ENDPOINT_URL` | No | Supabase Storage S3 endpoint. Without this, audio saves to local disk (ephemeral on Render). |
| `STORAGE_BUCKET` | No | Supabase Storage bucket name. |
| `STORAGE_ACCESS_KEY_ID` | No | Supabase S3 access key (Project Settings → Storage → S3 Access Keys). |
| `STORAGE_SECRET_ACCESS_KEY` | No | Supabase S3 secret key. |
| `STORAGE_REGION` | No | Storage region. Default: `us-east-1`. |
| `CORS_ORIGINS` | No | Comma-separated allowed origins for custom domains. |
| `FRONTEND_URL` | No | Single additional allowed CORS origin. |
| `DATABASE_SSL` | No | Force SSL on/off. Auto-detected from `?sslmode=require` in the URL. |

## Deployment

### Backend on Render

1. Create a **Web Service** pointing to your repository.
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to `pip install -r requirements.txt`.
4. Set **Start Command** to `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. Add all required environment variables in the **Environment** tab.

> **Important:** Render's filesystem is ephemeral — audio files saved locally are lost on every deploy. Set up Supabase Storage variables to persist recordings.

### Frontend on Vercel

1. Import the repository and set **Root Directory** to `frontend`.
2. Add `NEXT_PUBLIC_API_BASE_URL` environment variable pointing to your Render backend URL (e.g. `https://ai-speech-accent-practice.onrender.com`).

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest -v                       # 22 tests across 4 test modules
```
