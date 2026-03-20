"""Add linkedin and products columns to contacts

Revision ID: a1b2c3d4e5f6
Revises: 54490104d159
Create Date: 2026-03-13 11:19:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '54490104d159'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add linkedin column
    op.add_column('contacts', sa.Column('linkedin', sa.String(length=500), nullable=True))

    # Add products (JSONB array) column
    op.add_column('contacts', sa.Column('products', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Migrate existing 'product' (single string) values to 'products' (JSON array)
    op.execute("""
        UPDATE contacts
        SET products = to_jsonb(ARRAY[product])
        WHERE product IS NOT NULL AND product != ''
    """)


def downgrade() -> None:
    op.drop_column('contacts', 'products')
    op.drop_column('contacts', 'linkedin')
