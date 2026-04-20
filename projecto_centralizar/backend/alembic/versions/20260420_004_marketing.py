"""04_marketing

Revision ID: 004_marketing
Revises: 003_taxonomy
Create Date: 2026-04-20 12:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_marketing'
down_revision: Union[str, Sequence[str], None] = '003_taxonomy'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Campaigns ---
    op.create_table(
        'campaigns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('tipo', sa.String(length=100), nullable=True),
        sa.Column('estado', sa.String(length=50), nullable=False),
        sa.Column('fecha_inicio', sa.DateTime(timezone=True), nullable=False),
        sa.Column('fecha_fin', sa.DateTime(timezone=True), nullable=True),
        sa.Column('presupuesto', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('objetivo', sa.String(length=500), nullable=True),
        sa.Column('responsable', sa.String(length=150), nullable=True),
        sa.Column('canal', sa.String(length=100), nullable=True),
        sa.Column('notas', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('campaigns')
