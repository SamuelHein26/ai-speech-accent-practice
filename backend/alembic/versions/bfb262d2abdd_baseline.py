"""baseline: create users & sessions (and indexes); optional backfills guarded"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "bfb262d2abdd"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Create users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_users_id", "users", ["id"])

    # 2) Create sessions
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.String, unique=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_guest", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("final_transcript", sa.Text, nullable=True),
        sa.Column("audio_path", sa.String(512), nullable=True),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
    )
    op.create_index("ix_sessions_id", "sessions", ["id"])
    op.create_index("ix_sessions_session_id", "sessions", ["session_id"], unique=True)

    # 3) OPTIONAL: backfill / data fixes (guarded so fresh DBs won’t error)
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("sessions"):
        # If you previously had NULLs in is_guest in an existing DB, this will fix them.
        op.execute("UPDATE sessions SET is_guest = false WHERE is_guest IS NULL;")


def downgrade() -> None:
    # Drop in reverse order
    op.drop_index("ix_sessions_session_id", table_name="sessions")
    op.drop_index("ix_sessions_id", table_name="sessions")
    op.drop_table("sessions")

    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
