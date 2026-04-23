"""add_unique_empresa_nombre_lower

Revision ID: 719bf2f2027d
Revises: 648f9015338a
Create Date: 2026-04-16 16:58:41.473022

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '719bf2f2027d'
down_revision: Union[str, Sequence[str], None] = '648f9015338a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Note: Before creating the functional index, we might want to drop the 
    # standard unique index if we want it to be the only source of truth.
    # However, to be safe and avoid naming conflicts if it was auto-generated,
    # we just add the functional unique index as requested.
    op.execute("CREATE UNIQUE INDEX ix_unique_empresa_nombre_lower ON empresas (LOWER(nombre))")


def downgrade() -> None:
    op.execute("DROP INDEX ix_unique_empresa_nombre_lower")

