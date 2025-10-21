import shutil
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import Session


class SessionManager:
    """Handles creation and lifecycle management of monologue sessions."""

    def __init__(self, workdir: Path):
        # Ensure the working directory exists
        self.workdir = Path(workdir)
        self.workdir.mkdir(parents=True, exist_ok=True)

    async def create_session(self, db: AsyncSession, user_id=None, is_guest=False):
        """Create a new monologue session for either a user or a guest."""
        session_uuid = str(uuid.uuid4())
        session_dir = self.workdir / session_uuid
        session_dir.mkdir(parents=True, exist_ok=True)

        expires_at = None
        if is_guest:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        new_session = Session(
            session_id=session_uuid,
            user_id=user_id,
            is_guest=is_guest,
        )

        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)

        print(f"Created {'guest' if is_guest else 'user'} session {session_uuid}")
        return {"session_id": new_session.session_id}

    def get_audio_path(self, session_id: str) -> Path:
        """Return the absolute path to the session’s audio file."""
        session_dir = self.workdir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir / "session.webm"

    async def finalize_session(self, db: AsyncSession, session_id: str):
        """
        Finalize the session after transcription.
        - Delete the local audio directory.
        - If the session belongs to a guest, remove it from the DB immediately.
        """
        session_dir = self.workdir / session_id
        shutil.rmtree(session_dir, ignore_errors=True)

        result = await db.execute(select(Session).where(Session.session_id == session_id))
        session = result.scalar_one_or_none()

        if not session:
            print(f"⚠️ Session {session_id} not found in DB.")
            return

        if session.is_guest:
            await db.delete(session)
            await db.commit()  # ✅ Ensure commit is called after delete
            print(f"🧹 Deleted guest session immediately after recording: {session_id}")
        else:
            print(f"✅ User session {session_id} finalized and retained.")
