"""add_contact_cargo_fk

Revision ID: 648f9015338a
Revises: 6e6f66bbd4b5
Create Date: 2026-04-16 16:16:07.051316

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '648f9015338a'
down_revision: Union[str, Sequence[str], None] = '6e6f66bbd4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add column
    op.add_column('contacts', sa.Column('cargo_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_contacts_cargo_id_cargos', 'contacts', 'cargos', ['cargo_id'], ['id'], ondelete='SET NULL')
    
    # 2. Backfill from contact_cargos (lowest ID)
    connection = op.get_bind()
    connection.execute(sa.text("""
        UPDATE contacts 
        SET cargo_id = (
            SELECT cargo_id 
            FROM contact_cargos 
            WHERE contact_id = contacts.id 
            ORDER BY cargo_id ASC 
            LIMIT 1
        )
        WHERE cargo_id IS NULL
    """))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_contacts_cargo_id_cargos', 'contacts', type_='foreignkey')
    op.drop_column('contacts', 'cargo_id')

