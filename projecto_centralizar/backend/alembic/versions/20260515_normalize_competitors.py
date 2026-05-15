"""normalize competitors
Revision ID: 20260515_normalize_competitors
Revises: 20260515_categorias_cargo
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '20260515_normalize_competitors'
down_revision = '20260515_categorias_cargo'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()

    # 1. Phase 1: Create competidores table
    op.create_table(
        'competidores',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('empresa_id', sa.Integer(), nullable=False),
        sa.Column('posicion', sa.Integer(), nullable=False),
        sa.Column('web', sa.String(length=255), nullable=True),
        sa.Column('facebook', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['empresa_id'], ['empresas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('empresa_id', 'posicion', name='uq_empresa_competidor_posicion')
    )
    op.create_index('ix_competidores_empresa_id', 'competidores', ['empresa_id'])

    # 2. Phase 2: Data Migration
    # Position 1
    conn.execute(text("""
        INSERT INTO competidores (empresa_id, posicion, web)
        SELECT id, 1, web_competidor_1 
        FROM empresas 
        WHERE web_competidor_1 IS NOT NULL AND web_competidor_1 != ''
    """))
    # Position 2
    conn.execute(text("""
        INSERT INTO competidores (empresa_id, posicion, web)
        SELECT id, 2, web_competidor_2 
        FROM empresas 
        WHERE web_competidor_2 IS NOT NULL AND web_competidor_2 != ''
    """))
    # Position 3
    conn.execute(text("""
        INSERT INTO competidores (empresa_id, posicion, web)
        SELECT id, 3, web_competidor_3 
        FROM empresas 
        WHERE web_competidor_3 IS NOT NULL AND web_competidor_3 != ''
    """))

    # 3. Phase 3: Drop old columns
    op.drop_column('empresas', 'web_competidor_1')
    op.drop_column('empresas', 'web_competidor_2')
    op.drop_column('empresas', 'web_competidor_3')


def downgrade() -> None:
    # 1. Re-add columns to empresas
    op.add_column('empresas', sa.Column('web_competidor_1', sa.String(255), nullable=True))
    op.add_column('empresas', sa.Column('web_competidor_2', sa.String(255), nullable=True))
    op.add_column('empresas', sa.Column('web_competidor_3', sa.String(255), nullable=True))

    conn = op.get_bind()

    # 2. Restore data from competidores to empresas
    for pos in [1, 2, 3]:
        conn.execute(text(f"""
            UPDATE empresas e
            SET web_competidor_{pos} = c.web
            FROM competidores c
            WHERE c.empresa_id = e.id AND c.posicion = {pos}
        """))

    # 3. Drop competidores table
    op.drop_table('competidores')
