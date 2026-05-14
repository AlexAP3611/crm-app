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
    # Contacts
    op.add_column('contacts',
        sa.Column('categoria', sa.String(length=100), nullable=True)
    )
    op.create_index('ix_contacts_categoria', 'contacts', ['categoria'], unique=False)

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

    # Contacts
    op.drop_index('ix_contacts_categoria', table_name='contacts')
    op.drop_column('contacts', 'categoria')
