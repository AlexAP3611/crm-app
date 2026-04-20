"""add phone support

Revision ID: bf56b7ab9bdd
Revises: 42af65600aa7
Create Date: 2026-04-15 11:58:54.886209

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bf56b7ab9bdd'
down_revision: Union[str, Sequence[str], None] = '42af65600aa7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('contacts', 'phone', new_column_name='phone_contact')
    op.add_column('empresas', sa.Column('phone', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('empresas', 'phone')
    op.alter_column('contacts', 'phone_contact', new_column_name='phone')
