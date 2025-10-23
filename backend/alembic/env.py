# backend/alembic/env.py
import os, sys
from pathlib import Path
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

# Alembic Config object
config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# Load .env for local dev; in Render you’ll rely on real env vars
load_dotenv(BASE_DIR / ".env")

def _build_url_from_parts():
    """Optional fallback if platform gives component env vars."""
    host = os.getenv("POSTGRES_HOST")
    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    db = os.getenv("POSTGRES_DB")
    port = os.getenv("POSTGRES_PORT", "5432")
    if all([host, user, password, db]):
        return f"postgresql://{user}:{password}@{host}:{port}/{db}"
    return None

# Try multiple env var names (support both async & sync)
raw_url = (
    os.getenv("ASYNC_DATABASE_URL") or
    os.getenv("DATABASE_URL") or    
    _build_url_from_parts()
)

if not raw_url:
    raise RuntimeError(
        "Alembic: No database URL found. "
        "Set DATABASE_URL (sync or async), or ASYNC_DATABASE_URL, or POSTGRES_* parts."
    )

# Normalize for Alembic (needs a *sync* driver)
# Accept both 'postgres://' and 'postgresql://' inputs
norm = raw_url.replace("postgres://", "postgresql://")
if "+asyncpg" in norm:
    sync_url = norm.replace("+asyncpg", "+psycopg2")
else:
    # If it’s already sync, keep it; if it includes a driver already, leave it.
    sync_url = norm

# Put the URL into Alembic config (do not mutate os.environ)
config.set_main_option("sqlalchemy.url", sync_url)

# Import your metadata
from database import Base
import models  # IMPORTANT: populate Base.metadata
target_metadata = Base.metadata

# ----- standard offline/online runners (unchanged) -----
def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
