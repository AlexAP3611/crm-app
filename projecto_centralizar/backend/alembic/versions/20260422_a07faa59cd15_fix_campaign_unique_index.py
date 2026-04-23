"""fix campaign unique index

Revision ID: a07faa59cd15
Revises: 515c73b61450
Create Date: 2026-04-22 15:29:04.963698

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a07faa59cd15'
down_revision: Union[str, Sequence[str], None] = '515c73b61450'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index('ix_campaigns_nombre_lower', table_name='campaigns')
    op.create_index('ix_campaigns_nombre_lower', 'campaigns', [sa.text('lower(nombre)')], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_campaigns_nombre_lower', table_name='campaigns')
    op.create_index('ix_campaigns_nombre_lower', 'campaigns', [sa.text("'nombre'")], unique=True)
