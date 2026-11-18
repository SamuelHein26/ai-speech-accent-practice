"""Allow completed accent attempts without archived audio."""

from alembic import op


revision = "0002_optional_attempt_audio"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("practice_attempts", "audio_path", nullable=True)


def downgrade() -> None:
    # Older releases use an empty path to indicate unavailable audio.
    op.execute("UPDATE practice_attempts SET audio_path = '' WHERE audio_path IS NULL")
    op.alter_column("practice_attempts", "audio_path", nullable=False)
