This platform is an AI powered speech and accent practicing web-based platform.

## Deployment notes

### Database configuration

The backend expects the Render PostgreSQL connection string. Provide one of the
following environment variables when starting the FastAPI service:

* `DATABASE_URL` &mdash; default Render variable. Ensure it includes `sslmode=require`.
* `DATABASE_URL_SYNC` &mdash; optional override for environments where only a synchronous DSN is available during migrations.
* `RENDER_DATABASE_URL` &mdash; legacy fallback supported for backwards compatibility.

For production deployments leave `DATABASE_SSL` unset (or set it to `true`). This
allows the app to create a TLS context for Render automatically. In local
development you can omit both `DATABASE_SSL` and `sslmode` parameters to keep
plain connections against Docker/Postgres.

After updating the connection string run the Alembic migration so the
`sessions` table stays in sync with the latest schema changes:

```bash
cd backend
alembic upgrade head
```

### Frontend origins / CORS

The backend enables cross-origin requests for local development URLs by
default. In production set the frontend domain explicitly so browsers can reach
the Render API without CORS errors:

* `CORS_ORIGINS` &mdash; comma-separated list of allowed origins (for example
  `https://ai-speech-accent-practice.vercel.app`).
* `FRONTEND_URL` &mdash; optional single origin that is appended to the list. This
  is useful when the same value is already configured for other services.

When neither variable is set, the API falls back to the built-in localhost and
Vercel preview defaults.

### Audio retention

Finalised recordings are uploaded to Supabase Storage. The `audio_path` column
now stores the object key for each audio file rather than the binary payload.

Configure the following environment variables for production deployments:

* `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`) &mdash; used to upload and
  fetch audio from Supabase Storage.
* `SUPABASE_STORAGE_BUCKET` &mdash; the bucket that will contain the recordings.
* `SUPABASE_STORAGE_PREFIX` (optional) &mdash; folder prefix inside the bucket (for
  example `recordings/monologues`).

During local development you can omit the Supabase variables. In that case the
API falls back to moving WAV files into `backend/recordings/` and continues to
serve them from disk.
