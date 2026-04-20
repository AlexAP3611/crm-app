"""07_event_system

Revision ID: 007_event_system
Revises: 006_relationships
Create Date: 2026-04-20 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '007_event_system'
down_revision: Union[str, Sequence[str], None] = '006_relationships'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Enrichment Logs ---
    op.create_table(
        'enrichment_logs',
        sa.Column('run_id', sa.UUID(), nullable=False),
        sa.Column('tool', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_log', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('run_id')
    )
    op.create_index('idx_enrichment_logs_tool_created', 'enrichment_logs', ['tool', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('enrichment_logs')
