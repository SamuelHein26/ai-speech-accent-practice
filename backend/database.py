"""Database configuration and session utilities."""

import os
import ssl
from pathlib import Path
from typing import Any, Dict
from urllib.parse import parse_qs, urlparse, urlunparse

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from core.db_base import Base

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _to_asyncpg_url(url: str) -> str:
    """Normalize any Postgres URL so SQLAlchemy uses the asyncpg driver."""
    if "+asyncpg" in url:
        return url  # already async

    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]

    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]

    return url.replace("+psycopg2", "+asyncpg")


def _clean_asyncpg_url(url: str) -> str:
    """Strip query parameters (like sslmode) that asyncpg does not accept in connection URLs."""
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    parsed = urlparse(url)
    if not parsed.query:
        return url
    q = parse_qs(parsed.query, keep_blank_values=True)
    # asyncpg does not recognize sslmode / gssencmode / channel_binding
    q.pop("sslmode", None)
    q.pop("gssencmode", None)
    q.pop("channel_binding", None)
    clean_query = urlencode(q, doseq=True)
    return urlunparse(parsed._replace(query=clean_query))


def _resolve_ipv4_host(url: str) -> str:
    """Resolve hostnames to IPv4 addresses to avoid IPv6 connectivity issues."""

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


raw_db_url = (
    os.getenv("DATABASE_URL")
    or os.getenv("DATABASE_URL_SYNC")
    or os.getenv("RENDER_DATABASE_URL")
    or "postgresql+asyncpg://postgres:postgres@localhost:5432/comftalk"
)

raw_parsed = urlparse(raw_db_url)
original_hostname = raw_parsed.hostname

# Check SSL configuration: opt-in via env var or automatically honour sslmode=require
explicit_ssl = os.getenv("DATABASE_SSL")
query_params = {k: v[0].lower() for k, v in parse_qs(raw_parsed.query).items() if v}
sslmode = query_params.get("sslmode")

enable_ssl = False
if explicit_ssl is not None:
    enable_ssl = explicit_ssl.lower() in {"1", "true", "yes"}
elif sslmode in {"require", "verify-ca", "verify-full"}:
    enable_ssl = True

# When SSL is enabled (e.g. Supabase), do NOT resolve hostname to a raw IP,
# because TLS certificate validation requires the real domain name (e.g. *.pooler.supabase.com).
# For local development without SSL, resolve to IPv4 to prevent IPv6 loopback issues.
if enable_ssl:
    DATABASE_URL = raw_db_url
else:
    DATABASE_URL = _resolve_ipv4_host(raw_db_url)

ASYNC_URL = _clean_asyncpg_url(_to_asyncpg_url(DATABASE_URL))

connect_args: Dict[str, Any] = {}

if enable_ssl:
    ssl_context = ssl.create_default_context()
    # Supabase's transaction pooler uses a self-signed certificate;
    # skip verification but keep the connection encrypted.
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = ssl_context
    print(f"Database SSL: ENABLED for {original_hostname}")
else:
    print("Database SSL: DISABLED (local development)")

# Additional connect args for asyncpg to prefer IPv4 and support Supabase/PgBouncer poolers
connect_args["server_settings"] = {"jit": "off"}
# Disable statement cache for connection poolers (e.g. Supabase port 6543)
connect_args["statement_cache_size"] = 0
connect_args["prepared_statement_cache_size"] = 0

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