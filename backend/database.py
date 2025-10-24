"""Database configuration and session utilities."""

import os
import socket
import ssl
from typing import Any, Dict
from urllib.parse import parse_qs, parse_qsl, urlencode, urlparse, urlunparse

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


DATABASE_URL = (
    os.getenv("SUPABASE_DB_URL")
    or os.getenv("DATABASE_URL")
    or os.getenv("DATABASE_URL_SYNC")
)
if not DATABASE_URL:
    raise ValueError(
        "None of SUPABASE_DB_URL, DATABASE_URL, or DATABASE_URL_SYNC are set"
    )


def _ensure_ipv4_hostaddr(url: str) -> str:
    """Append hostaddr=<ipv4> so libpq clients skip unreachable IPv6 records."""

    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        return url

    existing_params = parse_qsl(parsed.query, keep_blank_values=True)
    if any(key == "hostaddr" for key, _ in existing_params):
        return url

    port = parsed.port or 5432
    try:
        infos = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except OSError:
        return url

    ipv4 = next((info[4][0] for info in infos if info[0] == socket.AF_INET), None)
    if not ipv4:
        return url

    updated_params = existing_params + [("hostaddr", ipv4)]
    new_query = urlencode(updated_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


DATABASE_URL = _ensure_ipv4_hostaddr(DATABASE_URL)

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
    ssl_context = ssl.create_default_context()
    connect_args["ssl"] = ssl_context
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
