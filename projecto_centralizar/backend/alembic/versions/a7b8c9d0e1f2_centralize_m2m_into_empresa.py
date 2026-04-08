"""Centralize sector/vertical/product M2M into Empresa

Revision ID: a7b8c9d0e1f2
Revises: 63ee5ccaefed
Create Date: 2026-04-08 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = '63ee5ccaefed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Migrate M2M relationships from Contact to Empresa."""

    # 1. Create new empresa M2M association tables (IF NOT EXISTS for idempotency)
    op.execute("""
        CREATE TABLE IF NOT EXISTS empresa_sectors (
            empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
            sector_id INTEGER NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
            PRIMARY KEY (empresa_id, sector_id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS empresa_verticals (
            empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
            vertical_id INTEGER NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
            PRIMARY KEY (empresa_id, vertical_id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS empresa_products (
            empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            PRIMARY KEY (empresa_id, product_id)
        )
    """)

    # 2. Migrate data from contact_* tables to empresa_* tables
    op.execute("""
        INSERT INTO empresa_sectors (empresa_id, sector_id)
        SELECT DISTINCT c.empresa_id, cs.sector_id
        FROM contact_sectors cs
        JOIN contacts c ON c.id = cs.contact_id
        WHERE c.empresa_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)
    op.execute("""
        INSERT INTO empresa_verticals (empresa_id, vertical_id)
        SELECT DISTINCT c.empresa_id, cv.vertical_id
        FROM contact_verticals cv
        JOIN contacts c ON c.id = cv.contact_id
        WHERE c.empresa_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)
    op.execute("""
        INSERT INTO empresa_products (empresa_id, product_id)
        SELECT DISTINCT c.empresa_id, cp.product_id
        FROM contact_products cp
        JOIN contacts c ON c.id = cp.contact_id
        WHERE c.empresa_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)

    # 3. Drop old scalar columns from empresas table
    op.drop_column('empresas', 'sector')
    op.drop_column('empresas', 'vertical')
    op.drop_column('empresas', 'producto')

    # 4. Drop old contact M2M association tables
    op.drop_table('contact_sectors')
    op.drop_table('contact_verticals')
    op.drop_table('contact_products')


def downgrade() -> None:
    """Reverse: restore contact M2M tables and scalar columns."""
    # 1. Recreate contact M2M tables
    op.create_table(
        'contact_sectors',
        sa.Column('contact_id', sa.Integer(), sa.ForeignKey('contacts.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('sector_id', sa.Integer(), sa.ForeignKey('sectors.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_table(
        'contact_verticals',
        sa.Column('contact_id', sa.Integer(), sa.ForeignKey('contacts.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('vertical_id', sa.Integer(), sa.ForeignKey('verticals.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_table(
        'contact_products',
        sa.Column('contact_id', sa.Integer(), sa.ForeignKey('contacts.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id', ondelete='CASCADE'), primary_key=True),
    )

    # 2. Restore scalar columns on empresas
    op.add_column('empresas', sa.Column('sector', sa.String(length=255), nullable=True))
    op.add_column('empresas', sa.Column('vertical', sa.String(length=255), nullable=True))
    op.add_column('empresas', sa.Column('producto', sa.String(length=255), nullable=True))

    # 3. Drop empresa M2M tables
    op.drop_table('empresa_sectors')
    op.drop_table('empresa_verticals')
    op.drop_table('empresa_products')
