"""Add empresas table

Revision ID: c8ccacb90a06
Revises: a1b2c3d4e5f6
Create Date: 2026-04-07 15:05:10.207820

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c8ccacb90a06'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('empresas',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('nombre', sa.String(length=255), nullable=False),
    sa.Column('dominio', sa.String(length=255), nullable=True),
    sa.Column('cif', sa.String(length=50), nullable=True),
    sa.Column('numero_empleados', sa.Integer(), nullable=True),
    sa.Column('ingresos_totales', sa.BigInteger(), nullable=True),
    sa.Column('cnae', sa.String(length=20), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_empresas_nombre'), 'empresas', ['nombre'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_empresas_nombre'), table_name='empresas')
    op.drop_table('empresas')
