"""create practice_attempts table"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202511010001"
down_revision: Union[str, Sequence[str], None] = "202510260257"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "practice_attempts",
        sa.Column("attempt_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("accent_target", sa.String(length=32), nullable=False),
        sa.Column("expected_text", sa.Text(), nullable=False),
        sa.Column("audio_path", sa.Text(), nullable=False),
        sa.Column("transcript_raw", sa.Text(), nullable=True),
        sa.Column("feedback_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("overall_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("practice_attempts")
