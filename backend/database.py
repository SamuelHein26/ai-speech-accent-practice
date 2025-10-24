# backend/database.py

import os
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# If you actually keep Base in core/db_base.py, import from there; otherwise from your local Base module.
from core.db_base import Base  # or: from .db_base import Base

load_dotenv()

def _to_asyncpg_url(url: str) -> str:
    """
    Normalize any postgres URL into an asyncpg DSN for SQLAlchemy’s asyncio dialect.
    Handles: postgresql://..., postgres://..., postgresql+psycopg2://...
    """
    if "+asyncpg" in url:
        return url  # already async

    # postgres:// → postgresql+asyncpg://
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]

    # postgresql:// → postgresql+asyncpg://
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]

    # postgresql+psycopg2:// → postgresql+asyncpg://
    return url.replace("+psycopg2", "+asyncpg")


DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

ASYNC_URL = _to_asyncpg_url(DATABASE_URL)

# asyncpg needs SSL on Render. Provide via connect_args so you don’t rely on query params.
connect_args: Dict[str, Any] = {}
# Render requires TLS; for asyncpg, ssl=True is enough unless you want a custom SSLContext.
connect_args["ssl"] = True

# Create async engine (AIO)
engine = create_async_engine(
    ASYNC_URL,
    echo=True,
    future=True,
    connect_args=connect_args,
)

# Async session factory
SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# DI helper
async def get_db():
    async with SessionLocal() as session:
        yield session
