# AI Speech & Accent Practice Platform

A full-stack practice environment that helps learners refine their speech and accent using real-time transcription, AI-generated feedback, and personalized practice sessions. The FastAPI backend handles authentication, session management, audio transcription, and AI interactions, while the Next.js frontend delivers the practice experience.

## Features

- **Guided practice sessions** with streaming AssemblyAI transcription and OpenAI-powered feedback.
- **Accent drills** that store individual attempts for later review.
- **User accounts and session history** managed by a PostgreSQL database through SQLAlchemy and Alembic migrations.
- **Modern frontend** built with Next.js 15, React 19, and Tailwind CSS.

## Project structure

```
.
├── backend/          # FastAPI application, routers, services, and Alembic migrations
├── frontend/         # Next.js frontend (App Router)
└── README.md         # This document
```

## Prerequisites

- Python 3.11+
- Node.js 20+ (recommended by Next.js 15)
- PostgreSQL 14+ (or a compatible managed instance)
- Access to OpenAI and AssemblyAI API keys

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows use .venv\\Scripts\\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Environment variables

Create a `.env` file in `backend/` with at least the following configuration:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy-compatible PostgreSQL connection string (include `sslmode=require` for Render). |
| `DATABASE_URL_SYNC` | Optional sync connection string used by Alembic if the async DSN is not supported. |
| `RENDER_DATABASE_URL` | Legacy fallback for Render deployments. |
| `DATABASE_SSL` | Set to `false` locally to disable TLS; leave unset/`true` in production. |
| `OPENAI_API_KEY` | Required for topic suggestions and speech feedback. |
| `ASSEMBLYAI_API_KEY` | Used for offline transcription and accent analysis. |
| `ASSEMBLYAI_STREAMING_API_KEY` | Enables the WebSocket streaming transcription service. |
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

## Deployment notes

- Provide a managed PostgreSQL instance and set the `DATABASE_URL` (and optionally `DATABASE_URL_SYNC`) environment variables.
- Configure `CORS_ORIGINS`/`FRONTEND_URL` with your production domain so browsers can access the API without errors.
- In production environments, keep `DATABASE_SSL` unset (or set to `true`) to ensure TLS is enforced by Render.
- Rotate `SECRET_KEY` regularly and store API credentials in your secret manager of choice.

## Housekeeping

- The `frontend/node_modules/` directory is intentionally ignored; install dependencies locally with `npm install`.
- Sample assets and recordings live under `backend/recordings/` and can be pruned or replaced in your deployments.
