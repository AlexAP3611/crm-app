"""add categorias_cargo table and migrate categoria from contacts to cargos

Revision ID: 20260515_categorias_cargo
Revises: 5df2ed5a489d
Create Date: 2026-05-15

Steps:
  1. Create categorias_cargo table
  2. Seed from DISTINCT values in contacts.categoria
  3. Add cargos.categoria_id FK (nullable)
  4. Data-migrate: assign each cargo its most-frequent categoria from contacts
  5. Drop contacts.categoria column + index
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "20260515_categorias_cargo"
down_revision: Union[str, Sequence[str], None] = "5df2ed5a489d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()

    # ── Phase 1: Create categorias_cargo table ─────────────────────────────
    op.create_table(
        "categorias_cargo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_categorias_cargo_name_lower",
        "categorias_cargo",
        [sa.text("lower(name)")],
        unique=True,
    )

    # ── Phase 2: (Removed Default Seeding) ──────────────────────────────────


    # ── Phase 4: Add cargos.categoria_id (nullable FK) ────────────────────
    op.add_column(
        "cargos",
        sa.Column("categoria_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_cargos_categoria_id",
        "cargos",
        "categorias_cargo",
        ["categoria_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_cargos_categoria_id", "cargos", ["categoria_id"])


def downgrade() -> None:
    conn = op.get_bind()

    # ── Remove cargos FK ────────────────────────────────────────────────────
    op.drop_index("ix_cargos_categoria_id", table_name="cargos")
    op.drop_constraint("fk_cargos_categoria_id", "cargos", type_="foreignkey")
    op.drop_column("cargos", "categoria_id")

    # ── Drop categorias_cargo table ─────────────────────────────────────────
    op.drop_index("ix_categorias_cargo_name_lower", table_name="categorias_cargo")
    op.drop_table("categorias_cargo")
