"""Add account roles and allow one primary admin."""

import sqlalchemy as sa
from alembic import op

revision = "0003_user_roles"
down_revision = "0002_optional_attempt_audio"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(20), server_default="user", nullable=False))
    op.create_check_constraint("ck_users_role", "users", "role IN ('user', 'admin', 'primary_admin')")
    op.create_index(
        "uq_users_primary_admin", "users", ["role"], unique=True,
        postgresql_where=sa.text("role = 'primary_admin'"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_primary_admin", table_name="users")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "role")
