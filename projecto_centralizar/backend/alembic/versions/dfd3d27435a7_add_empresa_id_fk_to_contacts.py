"""add empresa_id fk to contacts

Revision ID: dfd3d27435a7
Revises: c8ccacb90a06
Create Date: 2026-04-07 15:33:19.775115

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'dfd3d27435a7'
down_revision: Union[str, Sequence[str], None] = 'c8ccacb90a06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('contacts', sa.Column('empresa_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_contacts_empresa_id_empresas', 'contacts', 'empresas', ['empresa_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_contacts_empresa_id_empresas', 'contacts', type_='foreignkey')
    op.drop_column('contacts', 'empresa_id')
