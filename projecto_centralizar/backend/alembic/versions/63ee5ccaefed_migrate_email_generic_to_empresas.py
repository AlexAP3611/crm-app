"""migrate_email_generic_to_empresas

Revision ID: 63ee5ccaefed
Revises: ccf92f129246
Create Date: 2026-04-08 15:46:25.205684

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63ee5ccaefed'
down_revision: Union[str, Sequence[str], None] = 'ccf92f129246'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add email column to empresas
    op.add_column('empresas', sa.Column('email', sa.String(length=255), nullable=True))
    
    # 2. Transfer data from contacts.email_generic to empresas.email
    op.execute('''
        UPDATE empresas e
        SET email = sub.email_generic
        FROM (
            SELECT empresa_id, email_generic
            FROM (
                SELECT empresa_id, email_generic, ROW_NUMBER() OVER(PARTITION BY empresa_id ORDER BY id ASC) as rn
                FROM contacts
                WHERE email_generic IS NOT NULL AND empresa_id IS NOT NULL
            ) as subquery
            WHERE rn = 1
        ) as sub
        WHERE e.id = sub.empresa_id AND e.email IS NULL;
    ''')
    
    # 3. Drop email_generic from contacts
    op.drop_column('contacts', 'email_generic')


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Restore email_generic to contacts
    op.add_column('contacts', sa.Column('email_generic', sa.String(length=255), autoincrement=False, nullable=True))
    
    # 2. Transfer data back
    op.execute('''
        UPDATE contacts c
        SET email_generic = e.email
        FROM empresas e
        WHERE c.empresa_id = e.id AND e.email IS NOT NULL;
    ''')
    
    # 3. Drop email column from empresas
    op.drop_column('empresas', 'email')
