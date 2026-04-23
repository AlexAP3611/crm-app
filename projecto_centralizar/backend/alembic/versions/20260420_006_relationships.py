"""06_relationships

Revision ID: 006_relationships
Revises: 005_crm_core
Create Date: 2026-04-20 12:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006_relationships'
down_revision: Union[str, Sequence[str], None] = '005_crm_core'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Empresa Sectors (M2M) ---
    op.create_table(
        'empresa_sectors',
        sa.Column('empresa_id', sa.Integer(), nullable=False),
        sa.Column('sector_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('empresa_id', 'sector_id')
    )

    # --- Empresa Verticals (M2M) ---
    op.create_table(
        'empresa_verticals',
        sa.Column('empresa_id', sa.Integer(), nullable=False),
        sa.Column('vertical_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['vertical_id'], ['verticals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('empresa_id', 'vertical_id')
    )

    # --- Empresa Products (M2M) ---
    op.create_table(
        'empresa_products',
        sa.Column('empresa_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('empresa_id', 'product_id')
    )

    # --- Contact Campaigns (M2M) ---
    op.create_table(
        'contact_campaigns',
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('campaign_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['campaign_id'], ['campaigns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['contact_id'], ['contacts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('contact_id', 'campaign_id')
    )


def downgrade() -> None:
    op.drop_table('contact_campaigns')
    op.drop_table('empresa_products')
    op.drop_table('empresa_verticals')
    op.drop_table('empresa_sectors')
