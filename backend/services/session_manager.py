"""
session_manager.py
Encapsulates per-user session creation, audio storage, and cleanup.
"""

import uuid
import datetime
import shutil
from pathlib import Path

class SessionManager:
    def __init__(self, workdir: Path):
        self.workdir = workdir
        self.sessions = {}

    def create_session(self, user_id: str) -> str:
        """Create a new session directory and metadata record."""
        session_id = uuid.uuid4().hex
        session_dir = self.workdir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        self.sessions[session_id] = {
            "user_id": user_id,
            "status": "active",
            "created_at": datetime.datetime.utcnow(),
            "audio_path": session_dir / "session.webm"
        }
        return session_id

    def get_audio_path(self, session_id: str) -> Path:
        """Retrieve the path to the session’s audio file."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found.")
        return session["audio_path"]

    def finalize_session(self, session_id: str):
        """Mark session as completed and remove temporary files."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found.")
        session["status"] = "completed"
        session["completed_at"] = datetime.datetime.utcnow()

        # Remove session directory
        session_dir = self.workdir / session_id
        shutil.rmtree(session_dir, ignore_errors=True)