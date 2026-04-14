"""add index on contacts linkedin

Revision ID: 2a6246901e6f
Revises: 10d7fad11e98
Create Date: 2026-04-14 12:34:05.301332

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a6246901e6f'
down_revision: Union[str, Sequence[str], None] = '10d7fad11e98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Add a non-unique index on contacts.linkedin for resolve_contact lookups."""
    op.create_index('ix_contacts_linkedin', 'contacts', ['linkedin'])


def downgrade() -> None:
    """Remove the linkedin index."""
    op.drop_index('ix_contacts_linkedin', table_name='contacts')
