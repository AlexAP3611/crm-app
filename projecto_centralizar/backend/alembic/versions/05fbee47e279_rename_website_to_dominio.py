"""rename_website_to_dominio

Revision ID: 05fbee47e279
Revises: c1891a272b29
Create Date: 2026-03-20 12:16:08.344411

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05fbee47e279'
down_revision: Union[str, Sequence[str], None] = 'c1891a272b29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('contacts', 'website', new_column_name='dominio')
    op.drop_index('ix_contacts_website', table_name='contacts')
    op.create_index(op.f('ix_contacts_dominio'), 'contacts', ['dominio'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_contacts_dominio'), table_name='contacts')
    op.create_index('ix_contacts_website', 'contacts', ['website'], unique=True)
    op.alter_column('contacts', 'dominio', new_column_name='website')
