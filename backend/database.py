"""Database configuration and session utilities."""

import os
from typing import Any, Dict
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from core.db_base import Base

load_dotenv()


def _to_asyncpg_url(url: str) -> str:
    """Normalize any Postgres URL so SQLAlchemy uses the asyncpg driver."""
    if "+asyncpg" in url:
        return url  # already async

    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]

    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]

    return url.replace("+psycopg2", "+asyncpg")


DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

ASYNC_URL = _to_asyncpg_url(DATABASE_URL)

# SSL configuration: opt-in via env var or automatically honour sslmode=require
connect_args: Dict[str, Any] = {}

explicit_ssl = os.getenv("DATABASE_SSL")
parsed = urlparse(DATABASE_URL)
query_params = {k: v[0].lower() for k, v in parse_qs(parsed.query).items() if v}
sslmode = query_params.get("sslmode")

enable_ssl = False
if explicit_ssl is not None:
    enable_ssl = explicit_ssl.lower() in {"1", "true", "yes"}
elif sslmode in {"require", "verify-ca", "verify-full"}:
    enable_ssl = True

if enable_ssl:
    connect_args["ssl"] = True
    print("Database SSL: ENABLED")
else:
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


async def get_db():
    """FastAPI dependency that yields a single async session per request."""
    async with SessionLocal() as session:
        yield session
