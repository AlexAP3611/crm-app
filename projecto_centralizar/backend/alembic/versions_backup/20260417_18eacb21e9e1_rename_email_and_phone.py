"""Rename email and phone

Revision ID: 18eacb21e9e1
Revises: 719bf2f2027d
Create Date: 2026-04-17 10:03:38.619561

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '18eacb21e9e1'
down_revision: Union[str, Sequence[str], None] = '719bf2f2027d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Rename columns preserving data
    op.alter_column('contacts', 'email_contact', new_column_name='email')
    op.alter_column('contacts', 'phone_contact', new_column_name='phone')
    
    # Re-create unique constraint for email
    op.drop_constraint('contacts_email_contact_key', 'contacts', type_='unique')
    op.create_unique_constraint(None, 'contacts', ['email'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, 'contacts', type_='unique')
    op.create_unique_constraint('contacts_email_contact_key', 'contacts', ['email'])
    
    op.alter_column('contacts', 'email', new_column_name='email_contact')
    op.alter_column('contacts', 'phone', new_column_name='phone_contact')
