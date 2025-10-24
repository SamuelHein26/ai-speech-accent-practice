This platform is an AI powered speech and accent practicing web-based platform.

## Deployment notes

### Database configuration

The backend now expects a Supabase Postgres connection string. Provide one of the
following environment variables when starting the FastAPI service:

* `SUPABASE_DB_URL` &mdash; preferred. Use the full connection string from the Supabase dashboard (Service Role works best) and be sure it includes `sslmode=require`.
* `DATABASE_URL` &mdash; legacy fallback. If `SUPABASE_DB_URL` is absent we will read this variable instead.

For production deployments leave `DATABASE_SSL` unset (or set it to `true`). This
allows the app to create a TLS context for Supabase automatically. In local
development you can omit both `DATABASE_SSL` and `sslmode` parameters to keep
plain connections against Docker/Postgres.

After updating the connection string run the Alembic migration so the
`sessions` table stays in sync with the latest schema changes:

```bash
cd backend
alembic upgrade head
```

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
