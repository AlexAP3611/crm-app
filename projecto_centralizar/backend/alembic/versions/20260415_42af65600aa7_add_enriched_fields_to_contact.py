"""add enriched fields to contact

Revision ID: 42af65600aa7
Revises: 86d1b454f20f
Create Date: 2026-04-15 10:39:42.545188

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42af65600aa7'
down_revision: Union[str, Sequence[str], None] = '86d1b454f20f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("contacts", sa.Column("enriched", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("contacts", sa.Column("enriched_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("contacts", "enriched_at")
    op.drop_column("contacts", "enriched")
