# services/session_manager.py
# SRP: session lifecycle + persistence. Persists artifacts for logged-in users, purges guests.

import os
import shutil
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Session
from services.storage import S3Storage, StorageError


class SessionManager:
    """Handles creation, storage paths, and finalize semantics."""

    def __init__(self, workdir: Path, storage: S3Storage | None = None):
        # Ephemeral workspace for in-progress recordings (per-session dir)
        self.workdir = Path(workdir)
        self.workdir.mkdir(parents=True, exist_ok=True)
        self.storage = storage
        self.archive_root = Path(os.getenv("SESSION_ARCHIVE_DIR", "./recordings"))

    async def create_session(self, db: AsyncSession, user_id=None, is_guest=False):
        """Create a new row and a working directory for the recording session."""
        session_uuid = str(uuid.uuid4())
        (self.workdir / session_uuid).mkdir(parents=True, exist_ok=True)

        new_session = Session(
            session_id=session_uuid,
            user_id=user_id,
            is_guest=is_guest,
        )
        db.add(new_session)
        await db.commit()
        # NOTE: refresh is optional; we don't need DB-generated defaults immediately
        return {"session_id": session_uuid, "is_guest": is_guest}

    def get_audio_path(self, session_id: str) -> Path:
        """Return the path for the in-flight WebM container."""
        session_dir = self.workdir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir / "session.webm"

    async def finalize_and_persist(
        self,
        db: AsyncSession,
        session_id: str,
        *,
        transcript_text: str,
        wav_path: str,
        duration_seconds: int | None,
        filler_word_count: int | None,
    ) -> None:
        """
        Persist or purge after transcription.
        - Guests: delete working dir and row (ephemeral by design).
        - Users: store transcript/duration metadata and archive the WAV via storage or disk.
        """
        result = await db.execute(select(Session).where(Session.session_id == session_id))
        row = result.scalar_one_or_none()

        # Always clean the working directory
        work_dir = self.workdir / session_id

        if not row:
            # Nothing else to do; just best-effort cleanup.
            shutil.rmtree(work_dir, ignore_errors=True)
            return

        if row.is_guest:
            # Purge ephemeral guest sessions
            shutil.rmtree(work_dir, ignore_errors=True)
            await db.delete(row)
            await db.commit()
            return

        # Store metadata on session row
        row.final_transcript = transcript_text or None
        row.duration_seconds = duration_seconds
        row.filler_word_count = filler_word_count

        # Persist audio artifact either to Supabase storage (preferred) or the local
        # archive directory when Supabase is not configured (local development).
        try:
            if self.storage and self.storage.is_configured():
                object_key = self._build_storage_key(row.user_id, session_id)
                stored_key = await self.storage.upload_audio(object_key, wav_path)
                row.audio_path = stored_key
                # Uploaded successfully; the local WAV is no longer needed.
                try:
                    os.remove(wav_path)
                except FileNotFoundError:
                    pass
            else:
                # Local fallback: move the WAV into a stable recordings directory so we
                # can continue serving downloads during development without Supabase.
                archive_dir = self.archive_root / (str(row.user_id) if row.user_id else "guests")
                archive_dir.mkdir(parents=True, exist_ok=True)
                destination = archive_dir / f"{session_id}.wav"
                shutil.move(wav_path, destination)
                row.audio_path = str(destination)

            await db.commit()
        except StorageError:
            await db.rollback()
            raise
        except Exception:
            await db.rollback()
            raise
        finally:
            # Remove temporary working dir last
            shutil.rmtree(work_dir, ignore_errors=True)

    async def cleanup_expired_sessions(self, db: AsyncSession, max_age_hours: int = 24) -> None:
        """
        Clean up old guest sessions that were never finalized.
        Removes both database records and working directories.
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        
        # Find expired guest sessions
        stmt = select(Session).where(
            Session.is_guest == True,
            Session.created_at < cutoff_time,
            Session.final_transcript.is_(None)  # Never finalized
        )
        result = await db.execute(stmt)
        expired_sessions = result.scalars().all()

        for session in expired_sessions:
            # Clean up working directory
            work_dir = self.workdir / session.session_id
            if work_dir.exists():
                shutil.rmtree(work_dir, ignore_errors=True)
            
            # Delete from database
            await db.delete(session)
        
        if expired_sessions:
            await db.commit()
            print(f"Cleaned up {len(expired_sessions)} expired guest sessions")

    def _build_storage_key(self, user_id: int | None, session_id: str) -> str:
        """Deterministically derive the storage key for a finalized session."""

        owner_segment = str(user_id) if user_id is not None else "guests"
        return f"{owner_segment}/{session_id}.wav"
