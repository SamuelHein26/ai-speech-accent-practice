# backend/alembic/env.py

# --- sys.path bootstrap so we can import `core` and `models` ---
import sys
from pathlib import Path
from dotenv import load_dotenv

# Resolve .../backend from .../backend/alembic/env.py
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# --- standard alembic imports ---
import os
import socket
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# --- import ONLY metadata (no engine creation here) ---
from core.db_base import Base          # ✅ now importable
import models                           # ensure models register with Base
target_metadata = Base.metadata

load_dotenv()

# --- choose sync DB URL for Alembic ---
database_url = (
    os.getenv("DATABASE_URL")
    or os.getenv("DATABASE_URL_SYNC")
    or os.getenv("RENDER_DATABASE_URL")
)
if not database_url:
    raise RuntimeError(
        "None of DATABASE_URL, DATABASE_URL_SYNC, or RENDER_DATABASE_URL are set"
    )

# Alembic expects a synchronous driver; swap if an async URL is provided.
sync_url = database_url.replace("+asyncpg", "+psycopg2")

# Older env vars might use the Render `ssl=require` query param.
sync_url = sync_url.replace("ssl=require", "sslmode=require")


def _ensure_ipv4_hostaddr(url: str) -> str:
    """Append hostaddr=<ipv4> so libpq skips unreachable IPv6 endpoints."""

    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        return url

    # Honour an explicit hostaddr if the operator already set one.
    existing_params = parse_qsl(parsed.query, keep_blank_values=True)
    if any(key == "hostaddr" for key, _ in existing_params):
        return url

    port = parsed.port or 5432
    try:
        infos = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except OSError:
        return url  # Leave untouched if DNS lookup fails.

    ipv4 = next((info[4][0] for info in infos if info[0] == socket.AF_INET), None)
    if not ipv4:
        return url

    updated_params = existing_params + [("hostaddr", ipv4)]
    new_query = urlencode(updated_params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


sync_url = _ensure_ipv4_hostaddr(sync_url)

config.set_main_option("sqlalchemy.url", sync_url)

def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"),
                      target_metadata=target_metadata,
                      literal_binds=True,
                      compare_type=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection,
                          target_metadata=target_metadata,
                          compare_type=True)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
