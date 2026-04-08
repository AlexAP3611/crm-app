"""migrate_cif_to_empresas

Revision ID: eef38a14473a
Revises: ecde4a6ff54e
Create Date: 2026-04-08 13:20:01.615128

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eef38a14473a'
down_revision: Union[str, Sequence[str], None] = 'ecde4a6ff54e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
