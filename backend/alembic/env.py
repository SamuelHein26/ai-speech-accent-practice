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
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

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
    os.getenv("SUPABASE_DB_URL")
    or os.getenv("DATABASE_URL")
    or os.getenv("DATABASE_URL_SYNC")
)
if not database_url:
    raise RuntimeError(
        "None of SUPABASE_DB_URL, DATABASE_URL, or DATABASE_URL_SYNC are set"
    )

# Alembic expects a synchronous driver; swap if an async URL is provided.
sync_url = database_url.replace("+asyncpg", "+psycopg2")

# Older env vars might use the Supabase `ssl=require` query param.
sync_url = sync_url.replace("ssl=require", "sslmode=require")

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
