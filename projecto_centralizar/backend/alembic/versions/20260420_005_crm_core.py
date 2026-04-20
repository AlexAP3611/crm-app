"""05_crm_core

Revision ID: 005_crm_core
Revises: 004_marketing
Create Date: 2026-04-20 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '005_crm_core'
down_revision: Union[str, Sequence[str], None] = '004_marketing'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Cargos ---
    op.create_table(
        'cargos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('normalized_name', sa.String(length=100), nullable=True),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        sa.UniqueConstraint('normalized_name')
    )

    # --- Empresas ---
    op.create_table(
        'empresas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('web', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('cif', sa.String(length=50), nullable=True),
        sa.Column('numero_empleados', sa.Integer(), nullable=True),
        sa.Column('facturacion', sa.Float(), nullable=True),
        sa.Column('cnae', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_enriched_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_enrichment_tool', sa.String(length=50), nullable=True),
        sa.Column('enrichment_status', sa.String(length=20), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    # Case-insensitive unique index on name
    op.create_index('ix_empresas_nombre_lower', 'empresas', [sa.text('lower(nombre)')], unique=True)
    # Generic index for search optimization
    op.create_index(op.f('ix_empresas_nombre'), 'empresas', ['nombre'], unique=False)

    # --- Contacts ---
    op.create_table(
        'contacts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('empresa_id', sa.Integer(), nullable=True),
        sa.Column('cargo_id', sa.Integer(), nullable=True),
        sa.Column('first_name', sa.String(length=100), nullable=True),
        sa.Column('last_name', sa.String(length=100), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('linkedin', sa.String(length=500), nullable=True),
        sa.Column('linkedin_normalized', sa.String(length=500), nullable=True),
        sa.Column('products', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('notes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('enriched', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('enriched_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['cargo_id'], ['cargos.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_contacts_linkedin_normalized'), 'contacts', ['linkedin_normalized'], unique=True)


def downgrade() -> None:
    op.drop_table('contacts')
    op.drop_index('ix_empresas_nombre_lower', table_name='empresas')
    op.drop_table('empresas')
    op.drop_table('cargos')
