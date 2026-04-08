"""rename_dominio_to_web

Revision ID: 64195549f84e
Revises: 1b0c15b12028
Create Date: 2026-04-08 11:44:20.647534

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '64195549f84e'
down_revision: Union[str, Sequence[str], None] = '1b0c15b12028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('contacts', 'dominio', new_column_name='web')
    op.alter_column('empresas', 'dominio', new_column_name='web')
    
    op.drop_index('ix_contacts_dominio', table_name='contacts')
    op.create_index(op.f('ix_contacts_web'), 'contacts', ['web'], unique=True)

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_contacts_web'), table_name='contacts')
    op.create_index('ix_contacts_dominio', 'contacts', ['dominio'], unique=True)

    op.alter_column('contacts', 'web', new_column_name='dominio')
    op.alter_column('empresas', 'web', new_column_name='dominio')
