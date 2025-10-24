"""baseline: create users & sessions (and indexes); optional backfills guarded"""

# --- Imports (DDL ops + SQLAlchemy Core) ---
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# --- Alembic identifiers ---
revision: str = "bfb262d2abdd"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 1) Create users (DDL) ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    # NOTE: PK is already indexed; this is harmless but optional.
    op.create_index("ix_users_id", "users", ["id"], unique=False)

    # --- 2) Create sessions (DDL) ---
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.String, unique=True),  # do NOT pass index=True in migrations
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_guest", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("final_transcript", sa.Text, nullable=True),
        sa.Column("audio_path", sa.String(512), nullable=True),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
    )
    op.create_index("ix_sessions_id", "sessions", ["id"], unique=False)

    # --- 2a) Idempotent unique index on session_id (DDL) ---
    # Some envs already have this index; we guard via Inspector to avoid duplicate errors.
    bind = op.get_bind()
    insp = sa.inspect(bind)

    existing_idx_names = {i["name"] for i in insp.get_indexes("sessions")}
    if "ix_sessions_session_id" not in existing_idx_names:
        op.create_index(
            "ix_sessions_session_id",
            "sessions",
            ["session_id"],
            unique=True,
        )

    # --- 3) Optional backfill (DML) ---
    # Guard so fresh DBs won’t error, and make it safe for re-runs.
    if insp.has_table("sessions"):
        op.execute("UPDATE sessions SET is_guest = false WHERE is_guest IS NULL;")


def downgrade() -> None:
    # --- Drop in reverse order (DDL) ---
    # Guarded drops: these are safe if index/table already gone.
    try:
        op.drop_index("ix_sessions_session_id", table_name="sessions")
    except Exception:
        pass

    try:
        op.drop_index("ix_sessions_id", table_name="sessions")
    except Exception:
        pass

    op.drop_table("sessions")

    try:
        op.drop_index("ix_users_id", table_name="users")
    except Exception:
        pass

    op.drop_table("users")
