"""add affino_accounts table

Revision ID: 20260518_affino_accounts
Revises: 20260515_normalize_competitors
Create Date: 2026-05-18
"""
from alembic import op
import sqlalchemy as sa

revision = "20260518_affino_accounts"
down_revision = "20260515_normalize_competitors"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "affino_accounts",
        sa.Column("id",        sa.Integer(),              nullable=False),
        sa.Column("nombre",    sa.String(),               nullable=False),
        sa.Column("x_user_id", sa.String(),               nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_affino_accounts_id"), "affino_accounts", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_affino_accounts_id"), table_name="affino_accounts")
    op.drop_table("affino_accounts")
