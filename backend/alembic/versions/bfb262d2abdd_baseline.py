"""baseline: enforce invariants + add index

Revision ID: bfb262d2abdd
Revises:
Create Date: 2025-10-23 23:22:37.549413
"""
# DDL/DML for initial alignment when DB already has tables.
from alembic import op
import sqlalchemy as sa


# Alembic identifiers
revision = "bfb262d2abdd"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Ensure UUID function exists for backfill (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    # Backfill before constraints
    op.execute("UPDATE sessions SET is_guest = false WHERE is_guest IS NULL;")
    # If any NULL session_id rows exist, backfill with UUID text
    op.execute("""
        UPDATE sessions
        SET session_id = gen_random_uuid()::text
        WHERE session_id IS NULL;
    """)

    # Enforce NOT NULL + default on is_guest
    op.alter_column(
        "sessions",
        "is_guest",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    )

    # Enforce NOT NULL on session_id
    op.alter_column(
        "sessions",
        "session_id",
        existing_type=sa.String(),
        nullable=False,
    )

    # Helpful composite index for profile queries
    op.create_index(
        "ix_sessions_user_created",
        "sessions",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade():
    # Drop composite index
    op.drop_index("ix_sessions_user_created", table_name="sessions")

    # Relax constraints (reverse)
    op.alter_column(
        "sessions",
        "session_id",
        existing_type=sa.String(),
        nullable=True,
    )
    op.alter_column(
        "sessions",
        "is_guest",
        existing_type=sa.Boolean(),
        nullable=True,
        server_default=None,
    )
