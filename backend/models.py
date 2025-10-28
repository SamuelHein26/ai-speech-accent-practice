import uuid

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    func,
    Text,
    text,
    Numeric,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from core.db_base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sessions = relationship("Session", back_populates="user")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)

    # NOT NULL in DB; keep parity here
    session_id = Column(String, unique=True, index=True, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # NOT NULL DEFAULT false in DB; mirror in ORM
    is_guest = Column(Boolean, nullable=False, default=False, server_default=text("false"))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    final_transcript = Column(Text, nullable=True)
    audio_path = Column(String(512), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    filler_word_count = Column(Integer, nullable=True)

    #  relationship only (no accidental "Column =" assignment)
    user = relationship("User", back_populates="sessions")


class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"

    attempt_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    accent_target = Column(String(32), nullable=False)
    expected_text = Column(Text, nullable=False)
    audio_path = Column(Text, nullable=False)
    transcript_raw = Column(Text, nullable=True)
    feedback_json = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    overall_score = Column(Numeric(5, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
