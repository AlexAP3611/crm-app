"""migrate_web_to_empresas

Revision ID: ccf92f129246
Revises: eef38a14473a
Create Date: 2026-04-08 13:44:45.429011

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ccf92f129246'
down_revision: Union[str, Sequence[str], None] = 'eef38a14473a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute('''
        UPDATE empresas e
        SET web = sub.web
        FROM (
            SELECT empresa_id, web
            FROM (
                SELECT empresa_id, web, ROW_NUMBER() OVER(PARTITION BY empresa_id ORDER BY id ASC) as rn
                FROM contacts
                WHERE web IS NOT NULL AND empresa_id IS NOT NULL
            ) as subquery
            WHERE rn = 1
        ) as sub
        WHERE e.id = sub.empresa_id AND e.web IS NULL;
    ''')
    
    op.execute("DROP INDEX IF EXISTS ix_contacts_web;")
    op.execute("ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_web_key;")
    op.drop_column('contacts', 'web')

def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('contacts', sa.Column('web', sa.String(length=255), autoincrement=False, nullable=True))
    op.create_unique_constraint('contacts_web_key', 'contacts', ['web'])
    op.create_index('ix_contacts_web', 'contacts', ['web'], unique=True)
    
    op.execute('''
        UPDATE contacts c
        SET web = e.web
        FROM empresas e
        WHERE c.empresa_id = e.id AND e.web IS NOT NULL;
    ''')
