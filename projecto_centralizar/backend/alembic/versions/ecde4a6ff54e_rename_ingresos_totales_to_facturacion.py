"""rename ingresos_totales to facturacion

Revision ID: ecde4a6ff54e
Revises: 64195549f84e
Create Date: 2026-04-08 11:58:07.285016

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ecde4a6ff54e'
down_revision: Union[str, Sequence[str], None] = '64195549f84e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute('ALTER TABLE empresas RENAME COLUMN ingresos_totales TO facturacion;')

def downgrade() -> None:
    """Downgrade schema."""
    op.execute('ALTER TABLE empresas RENAME COLUMN facturacion TO ingresos_totales;')
