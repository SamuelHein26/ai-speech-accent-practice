"""add filler_word_count column to sessions"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202510260257"
down_revision: Union[str, Sequence[str], None] = "bfb262d2abdd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("filler_word_count", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    try:
        op.drop_column("sessions", "filler_word_count")
    except Exception:
        pass
