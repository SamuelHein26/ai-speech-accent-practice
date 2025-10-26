from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime

    class Config:
        orm_mode = True


class UserProfileResponse(UserResponse):
    total_sessions: int


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TopicRequest(BaseModel):
    transcript: str


class TopicResponse(BaseModel):
    topics: List[str]


class SessionSummary(BaseModel):
    id: int
    session_id: str
    created_at: datetime
    duration_seconds: Optional[int]
    final_transcript: Optional[str]
    filler_word_count: Optional[int]
    audio_available: bool

    class Config:
        orm_mode = True
