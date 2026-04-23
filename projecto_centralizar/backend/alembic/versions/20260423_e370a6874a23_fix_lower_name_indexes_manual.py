"""fix_lower_name_indexes_manual

Revision ID: e370a6874a23
Revises: 279e8598329b
Create Date: 2026-04-23 10:29:36.930304

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e370a6874a23'
down_revision: Union[str, Sequence[str], None] = '279e8598329b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop existing incorrect indices
    op.drop_index('ix_sectors_name_lower', table_name='sectors')
    op.drop_index('ix_products_name_lower', table_name='products')
    op.drop_index('ix_verticals_name_lower', table_name='verticals')

    # 2. Create correct functional indices
    op.create_index(
        'ix_sectors_name_lower',
        'sectors',
        [sa.text('lower(name)')],
        unique=True
    )
    op.create_index(
        'ix_products_name_lower',
        'products',
        [sa.text('lower(name)')],
        unique=True
    )
    op.create_index(
        'ix_verticals_name_lower',
        'verticals',
        [sa.text('lower(name)')],
        unique=True
    )


def downgrade() -> None:
    # Revert to incorrect indices (optional, but good for rollback consistency)
    op.drop_index('ix_sectors_name_lower', table_name='sectors')
    op.drop_index('ix_products_name_lower', table_name='products')
    op.drop_index('ix_verticals_name_lower', table_name='verticals')

    # Note: Re-creating as literal strings as they were before
    op.create_index('ix_sectors_name_lower', 'sectors', [sa.text("lower('name')")], unique=True)
    op.create_index('ix_products_name_lower', 'products', [sa.text("lower('name')")], unique=True)
    op.create_index('ix_verticals_name_lower', 'verticals', [sa.text("lower('name')")], unique=True)

