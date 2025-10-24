from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, ForeignKey, func, Text, text
)
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

    # ✅ relationship only (no accidental "Column =" assignment)
    user = relationship("User", back_populates="sessions")
