"""04_marketing

Revision ID: 004_marketing
Revises: 003_taxonomy
Create Date: 2026-04-20 12:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_marketing'
down_revision: Union[str, Sequence[str], None] = '003_taxonomy'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Campaigns (Simplified for labeling) ---
    op.create_table(
        'campaigns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )


def downgrade() -> None:
    op.drop_table('campaigns')
