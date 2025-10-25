"""Database configuration and session utilities."""

import os
import ssl
from typing import Any, Dict
from urllib.parse import parse_qs, urlparse, urlunparse

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


def _resolve_ipv4_host(url: str) -> str:
    """
    Resolve hostname to IPv4 address to avoid IPv6 connectivity issues.
    This is particularly important for Supabase connections in some hosting environments.
    """
    import socket
    
    parsed = urlparse(url)
    hostname = parsed.hostname
    
    if not hostname or hostname.replace('.', '').isdigit():  # Already an IP
        return url
    
    try:
        # Get IPv4 address
        ipv4_addr = socket.getaddrinfo(hostname, None, socket.AF_INET)[0][4][0]
        
        # Reconstruct URL with IP address
        netloc = parsed.netloc.replace(hostname, ipv4_addr)
        new_parsed = parsed._replace(netloc=netloc)
        return urlunparse(new_parsed)
    except (socket.gaierror, IndexError):
        # If resolution fails, return original URL
        return url


DATABASE_URL = (
    os.getenv("SUPABASE_DB_URL")
    or os.getenv("DATABASE_URL")
    or os.getenv("DATABASE_URL_SYNC")
)
if not DATABASE_URL:
    raise ValueError(
        "None of SUPABASE_DB_URL, DATABASE_URL, or DATABASE_URL_SYNC are set"
    )

# Resolve to IPv4 to avoid IPv6 connectivity issues
DATABASE_URL = _resolve_ipv4_host(DATABASE_URL)

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

# Additional connect args for asyncpg to prefer IPv4
connect_args["server_settings"] = {"jit": "off"}

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