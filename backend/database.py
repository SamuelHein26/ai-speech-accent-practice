# backend/database.py

import os
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

from core.db_base import Base

load_dotenv()

def _to_asyncpg_url(url: str) -> str:
    """
    Normalize any postgres URL into an asyncpg DSN for SQLAlchemy's asyncio dialect.
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

# SSL configuration: only enable for production environments
connect_args: Dict[str, Any] = {}

# Check if SSL should be enabled (opt-in via environment variable)
enable_ssl = os.getenv("DATABASE_SSL", "false").lower() == "true"

if enable_ssl:
    # Production: require SSL
    connect_args["ssl"] = True
    print("Database SSL: ENABLED")
else:
    # Local development: no SSL
    print("Database SSL: DISABLED (local development)")

# Create async engine
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