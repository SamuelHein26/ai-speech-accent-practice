"""initial complete schema (users, sessions, practice_attempts)"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)

    # 2. Sessions table
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.String(), unique=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_guest", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("final_transcript", sa.Text(), nullable=True),
        sa.Column("audio_path", sa.String(512), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("filler_word_count", sa.Integer(), nullable=True),
    )
    op.create_index("ix_sessions_id", "sessions", ["id"], unique=False)
    op.create_index("ix_sessions_session_id", "sessions", ["session_id"], unique=True)

    # 3. Practice Attempts table
    op.create_table(
        "practice_attempts",
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("accent_target", sa.String(length=32), nullable=False),
        sa.Column("expected_text", sa.Text(), nullable=False),
        sa.Column("audio_path", sa.Text(), nullable=False),
        sa.Column("transcript_raw", sa.Text(), nullable=True),
        sa.Column(
            "feedback_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("overall_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("practice_attempts")
    op.drop_table("sessions")
    op.drop_table("users")