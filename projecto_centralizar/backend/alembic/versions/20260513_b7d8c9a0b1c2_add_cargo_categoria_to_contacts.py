"""add cargo_categoria to contacts

Revision ID: b7d8c9a0b1c2
Revises: 5d48b634302f
Create Date: 2026-05-13 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d8c9a0b1c2'
down_revision: Union[str, Sequence[str], None] = '5d48b634302f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Empresas
    op.add_column('empresas',
        sa.Column('provincia', sa.String(length=100), nullable=True)
    )
    op.add_column('empresas',
        sa.Column('pais', sa.String(length=100), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Empresas
    op.drop_column('empresas', 'pais')
    op.drop_column('empresas', 'provincia')
