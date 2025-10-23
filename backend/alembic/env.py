# alembic/env.py
# Purpose: Load .env, derive a sync sqlalchemy.url for Alembic, and wire to your app's Base.metadata.

from __future__ import annotations
import os, sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]  # -> .../backend
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Load environment variables from .env
load_dotenv(BASE_DIR / ".env")

async_url = os.getenv("DATABASE_URL") or os.getenv("ASYNC_DATABASE_URL")
sync_url = async_url.replace("+asyncpg", "+psycopg2")
config.set_main_option("sqlalchemy.url", sync_url)

from database import Base
import models  # <-- important: ensures metadata is populated
target_metadata = Base.metadata

# Offline mode: generate SQL scripts without connecting
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()

# Online mode: run migrations against the DB (sync driver)
def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
