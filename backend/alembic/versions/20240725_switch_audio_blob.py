"""Store session audio binary instead of file path."""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9a6d0c739f5e"
down_revision = "bfb262d2abdd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.add_column(sa.Column("audio_data", sa.LargeBinary(), nullable=True))
        batch_op.drop_column("audio_path")


def downgrade() -> None:
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.add_column(sa.Column("audio_path", sa.String(length=512), nullable=True))
        batch_op.drop_column("audio_data")
