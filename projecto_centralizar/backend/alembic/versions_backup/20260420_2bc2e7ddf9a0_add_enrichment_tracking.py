"""add_enrichment_tracking

Revision ID: 2bc2e7ddf9a0
Revises: 3bb54436c3d7
Create Date: 2026-04-20 10:23:59.136074

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2bc2e7ddf9a0'
down_revision: Union[str, Sequence[str], None] = '3bb54436c3d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add columns to 'empresas'
    op.add_column('empresas', sa.Column('last_enriched_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('empresas', sa.Column('last_enrichment_tool', sa.String(length=50), nullable=True))
    op.add_column('empresas', sa.Column('enrichment_status', sa.String(length=20), nullable=True))

    # Create 'enrichment_logs' table
    op.create_table(
        'enrichment_logs',
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('tool', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('metrics', sa.JSON(), nullable=True),
        sa.Column('error_log', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('run_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('enrichment_logs')
    op.drop_column('empresas', 'enrichment_status')
    op.drop_column('empresas', 'last_enrichment_tool')
    op.drop_column('empresas', 'last_enriched_at')
