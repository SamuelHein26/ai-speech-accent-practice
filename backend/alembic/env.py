import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# Import only metadata (no engine creation!)
from core.db_base import Base
import models  # ensures all models are registered with Base
target_metadata = Base.metadata

# Prefer DATABASE_URL_SYNC; fallback derive from async
async_url = os.getenv("DATABASE_URL")
sync_url = os.getenv("DATABASE_URL_SYNC")
if not sync_url:
    if not async_url:
        raise RuntimeError("Neither DATABASE_URL_SYNC nor DATABASE_URL is set")
    sync_url = async_url.replace("+asyncpg", "+psycopg2").replace("ssl=require", "sslmode=require")

config.set_main_option("sqlalchemy.url", sync_url)

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
