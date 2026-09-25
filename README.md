# AI Speech & Accent Practice Platform

A full-stack practice environment that helps learners refine their speech and accent using real-time transcription, AI-generated feedback, and personalized practice sessions. The FastAPI backend handles authentication, session management, audio transcription, and AI interactions, while the Next.js frontend delivers the practice experience.

## Features

- **Guided practice sessions** with streaming Deepgram transcription and AI-powered feedback (Gemini or Ollama).
- **Accent drills** that store individual attempts for later review.
- **User accounts and session history** managed by a PostgreSQL database through SQLAlchemy and Alembic migrations.
- **Modern frontend** built with Next.js 15, React 19, and Tailwind CSS.

## Project structure

```
.
├── .env              # Environment variables (create this — never commit it)
├── backend/          # FastAPI application, routers, services, and Alembic migrations
├── frontend/         # Next.js frontend (App Router)
└── README.md         # This document
```

## Prerequisites

- Python 3.11+
- Node.js 20+ (recommended by Next.js 15)
- PostgreSQL 14+ (or a compatible managed instance)
- A [Deepgram](https://deepgram.com) API key (free \$200 credit on sign-up)
- A [Gemini](https://aistudio.google.com) API key **or** [Ollama](https://ollama.com) for local dev

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows use .venv\\Scripts\\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Environment variables

Create a `.env` file in the **project root** (alongside `backend/` and `frontend/`) with at least the following configuration:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy-compatible PostgreSQL connection string (include `sslmode=require` for Render). |
| `DATABASE_URL_SYNC` | Optional sync connection string used by Alembic if the async DSN is not supported. |
| `DATABASE_SSL` | Set to `false` locally to disable TLS; leave unset/`true` in production. |
| `DEEPGRAM_API_KEY` | Required for all transcription — batch (accent drills + monologue) and real-time streaming. |
| `LLM_BACKEND` | Which LLM to use: `gemini` (default/production), `ollama` (local dev), or `openai` (legacy). |
| `GEMINI_API_KEY` | Required when `LLM_BACKEND=gemini`. Uses `gemini-3.5-flash-lite`. |
| `OLLAMA_BASE_URL` | Ollama API base URL (default: `http://localhost:11434/v1`). Used when `LLM_BACKEND=ollama`. |
| `OLLAMA_MODEL` | Ollama model name (default: `llama3.2:3b`). Used when `LLM_BACKEND=ollama`. |
| `OPENAI_API_KEY` | Only required when `LLM_BACKEND=openai` (legacy fallback). |
| `SECRET_KEY` | JWT signing key for authentication. |
| `CORS_ORIGINS` | Comma-separated list of allowed origins (overrides defaults). |
| `FRONTEND_URL` | Additional single origin appended to the CORS list. |
| `SESSION_ARCHIVE_DIR` | Local directory for saving recorded audio (defaults to `./recordings`). |
| `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_ENDPOINT_URL`, `S3_STORAGE_PREFIX` | Configure remote storage for archived recordings (optional). |

Run database migrations before starting the API:

```bash
alembic upgrade head
```

Start the development server:

```bash
uvicorn main:app --reload
```

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The development server runs at [http://localhost:3000](http://localhost:3000) and is already configured to communicate with the FastAPI backend on the default localhost ports.
