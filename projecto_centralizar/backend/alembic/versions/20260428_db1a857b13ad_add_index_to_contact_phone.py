"""add_index_to_contact_phone

Revision ID: db1a857b13ad
Revises: e370a6874a23
Create Date: 2026-04-28 12:02:56.050465

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'db1a857b13ad'
down_revision: Union[str, Sequence[str], None] = 'e370a6874a23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index('ix_contacts_phone', 'contacts', ['phone'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_contacts_phone', table_name='contacts')
