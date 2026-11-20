# ComfTalk

ComfTalk is a web app for practising spoken English. It combines free-form speaking practice with phrase-based pronunciation exercises.

## Features

- **Monologue practice:** Record a speaking session with live transcription, pause markers, filler-word counts, AI-generated topic prompts, and written coaching feedback.
- **Accent practice:** Read a prompt aloud and review word-level feedback for American or British English. Feedback currently uses speech recognition results and pronunciation heuristics.
- **Accounts and history:** Sign in to practise. Completed sessions are tracked by account.
- **Audio playback and downloads:** Replay or download new recordings on the practice page.

## Technology

- **Frontend:** Next.js 15, React 19, TypeScript, and Tailwind CSS 4
- **Backend:** FastAPI, Python, SQLAlchemy, and Alembic
- **Database:** PostgreSQL
- **Speech recognition:** Deepgram Nova-2 for streaming and recorded audio
- **AI coaching:** Gemini by default; Ollama and OpenAI provider implementations are also available
- **Audio storage:** Temporary processing for new recordings. Local disk or S3-compatible storage can still serve existing archived recordings.

## Requirements

- Python 3.11 or newer
- Node.js 20 or newer
- PostgreSQL database
- Deepgram API key
- Gemini API key
- FFmpeg and FFprobe on the backend machine

Optional: Ollama for local model use, or S3-compatible storage for existing archived recordings.

## Local setup

### Docker Compose

Install Docker with Compose v2.22 or later. From the repository root, add your
Deepgram and Gemini keys to `.env`, then run:

```bash
docker compose up --build --watch
```

Open the frontend at http://localhost:3001 and the API docs at
http://localhost:8001/docs. Set `COMFTALK_FRONTEND_PORT` or
`COMFTALK_BACKEND_PORT` in `.env` to change those ports. Compose starts PostgreSQL, runs the Alembic
migrations, and syncs local code edits while watch mode is running.
Stop the stack with Ctrl+C or `docker compose down`. The named volume
preserves database data between runs.

The Docker database is a separate local database. Compose uses its own
`DATABASE_URL`, even if the root `.env` points at Supabase or your existing
local database. Connect to it with:

```bash
docker compose exec db psql -U comftalk -d comftalk
```

Host tools can also connect at `127.0.0.1:5433` using the local development
password `comftalk-local`.

### Manual setup

Create a `.env` file in the repository root. Add the database connection and service credentials described under [Configuration](#configuration).

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`. On startup, the backend also attempts to create any missing tables; use Alembic migrations to manage schema changes.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The website runs at `http://localhost:3000`. To use a backend at a different address, set `NEXT_PUBLIC_API_BASE_URL` in the frontend environment.

### Admin accounts

Run `alembic upgrade head` on the intended database before deploying the
role-aware backend. Existing accounts and new registrations start as `user`.
The database permits one `primary_admin` and supports additional `admin` accounts.

To set up the primary admin, first register the account in the intended
environment. Connect to that database with a trusted operator account and run
this SQL in `psql`, replacing the example address with the registered email:

```sql
\conninfo
\set admin_email 'owner@example.com'
UPDATE public.users
SET role = 'primary_admin'
WHERE email = :'admin_email' AND role IN ('user', 'admin')
RETURNING id, email, role;
```

A successful first assignment returns one row. A different primary admin
already present causes the database to reject the update. For an additional
admin, assign `admin` to the intended account from the database. Both admin
roles can open **Dashboard → Admin** to see account and practice totals.
Role changes are managed by database operators.

## Configuration

The backend loads `.env` from the repository root.

### Required

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DATABASE
SECRET_KEY=replace-with-a-long-random-secret
DEEPGRAM_API_KEY=your-deepgram-api-key
LLM_BACKEND=gemini
GEMINI_API_KEY=your-gemini-api-key
```

For Supabase PostgreSQL, use the connection string and SSL settings appropriate to your Supabase project. Keep credentials private and do not commit `.env`.

### Optional

```env
# Gemini model (defaults to gemini-2.5-flash)
GEMINI_MODEL=gemini-2.5-flash

# Alternative AI providers
# LLM_BACKEND=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2:3b
# LLM_BACKEND=openai
OPENAI_API_KEY=your-openai-api-key

# S3-compatible audio storage, for example Supabase Storage
STORAGE_ENDPOINT_URL=https://PROJECT.storage.supabase.co/v1/s3
STORAGE_ACCESS_KEY_ID=your-storage-access-key
STORAGE_SECRET_ACCESS_KEY=your-storage-secret-key
STORAGE_BUCKET=recordings
STORAGE_REGION=us-east-1

# Browser origins allowed to call the API
CORS_ORIGINS=https://your-domain.example
FRONTEND_URL=https://your-frontend.example
```

Storage credentials are only needed to access recordings previously archived in object storage.

The frontend's `NEXT_PUBLIC_API_BASE_URL` should point to the backend, for example:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Project layout

```text
backend/
  main.py             API application and coaching endpoints
  routers/            Authentication, users, sessions, accent, streaming
  services/           AI, transcription, audio storage, scoring, and auth logic
  models.py           Database models
  schemas.py          API request and response models
  alembic/            Database migrations
  tests/              Backend unit tests
frontend/
  app/                Pages, shared components, and browser workflows
```

## Tests

Run backend tests from the `backend/` directory with the virtual environment active:

```bash
pytest
```

Run frontend linting from `frontend/`:

```bash
npm run lint
```

## Deployment

The frontend and backend can be deployed separately. Configure the frontend's `NEXT_PUBLIC_API_BASE_URL` with the deployed API address, and set backend environment variables on the backend host. Run Alembic before deploying the updated backend. New recordings can be downloaded from the browser after practice.
