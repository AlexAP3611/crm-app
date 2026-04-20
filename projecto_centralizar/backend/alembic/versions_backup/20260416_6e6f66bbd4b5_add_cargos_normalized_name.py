"""add_cargos_normalized_name

Revision ID: 6e6f66bbd4b5
Revises: b3928795493f
Create Date: 2026-04-16 16:15:26.204101

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


import re

# revision identifiers, used by Alembic.
revision: str = '6e6f66bbd4b5'
down_revision: Union[str, Sequence[str], None] = 'b3928795493f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ALIAS_MAP = {
    "cmo": "chief marketing officer",
    "c m o": "chief marketing officer",
    "ceo": "chief executive officer",
    "c e o": "chief executive officer",
    "cto": "chief technology officer",
    "c t o": "chief technology officer",
    "cfo": "chief financial officer",
    "c f o": "chief financial officer",
    "vp of engineering": "vice president of engineering",
    "head of marketing": "chief marketing officer",
}


def normalize_job_title(raw_value: str) -> str:
    """Standardize job title syntax (copied from app.services.cargo_service)."""
    if not raw_value:
        return ""
    val = raw_value.lower().strip()
    # Replace dots and other symbols with spaces
    val = val.replace(".", " ")
    val = re.sub(r'[^a-z0-9\s]', ' ', val)
    val = re.sub(r'\s+', ' ', val).strip()
    # Apply aliases
    val = ALIAS_MAP.get(val, val)
    return val


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add column as nullable first
    op.add_column('cargos', sa.Column('normalized_name', sa.String(length=100), nullable=True))
    
    # 2. Backfill data
    connection = op.get_bind()
    res = connection.execute(sa.text("SELECT id, name FROM cargos"))
    for row in res:
        cid, name = row
        norm = normalize_job_title(name)
        connection.execute(
            sa.text("UPDATE cargos SET normalized_name = :norm WHERE id = :id"),
            {"norm": norm, "id": cid}
        )
    
    # 3. Set NOT NULL and add unique index
    # Note: If there are duplicates that normalize to the same value, this will fail.
    # The manual script assumed no duplicates.
    op.alter_column('cargos', 'normalized_name', nullable=False)
    op.create_index('ix_cargos_normalized_name', 'cargos', ['normalized_name'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_cargos_normalized_name', table_name='cargos')
    op.drop_column('cargos', 'normalized_name')

