"""restore audio_path column and remove audio_data blob

Revision ID: 20240729_restore_audio_path
Revises: 20240725_switch_audio_blob
Create Date: 2024-07-29 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20240729_restore_audio_path"
down_revision = "20240725_switch_audio_blob"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("audio_path", sa.String(length=512), nullable=True))
        batch_op.drop_column("audio_data")


def downgrade() -> None:
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("audio_data", sa.LargeBinary(), nullable=True))
        batch_op.drop_column("audio_path")
