"""add_paises_provincias_and_migrate_empresa_fk

Revision ID: 20260514_add_paises_provincias
Revises: 20260513_b7d8c9a0b1c2_add_cargo_categoria_to_contacts
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "20260514_add_paises_provincias"
down_revision = "b7d8c9a0b1c2"
branch_labels = None
depends_on = None

# 52 provincias españolas (INE) + País España
SPAIN_NAME = "España"
def upgrade() -> None:
    conn = op.get_bind()

    # ── Phase 1: Create tables ──────────────────────────────────────────────
    op.create_table(
        "paises",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_paises_name_lower",
        "paises",
        [sa.text("lower(name)")],
        unique=True,
    )

    op.create_table(
        "provincias",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("pais_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["pais_id"], ["paises.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_provincias_name_pais_lower",
        "provincias",
        [sa.text("lower(name)"), "pais_id"],
        unique=True,
    )

    # ── Phase 2: Add nullable FK columns to empresas ────────────────────────
    op.add_column("empresas", sa.Column("pais_id", sa.Integer(), nullable=True))
    op.add_column("empresas", sa.Column("provincia_id", sa.Integer(), nullable=True))

    # ── Phase 3: Seed España ───────────────────────────────────────────────
    conn.execute(
        text("INSERT INTO paises (name) VALUES (:name) ON CONFLICT DO NOTHING"),
        {"name": SPAIN_NAME},
    )
    spain_row = conn.execute(
        text("SELECT id FROM paises WHERE lower(name) = lower(:name)"),
        {"name": SPAIN_NAME},
    ).fetchone()
    spain_id = spain_row[0] if spain_row else None

    # ── Phase 4: Migrate existing pais text data ────────────────────────────
    # Insert any unique non-null pais values not already seeded
    existing_paises = conn.execute(
        text("SELECT DISTINCT pais FROM empresas WHERE pais IS NOT NULL AND pais != ''")
    ).fetchall()

    for (pais_name,) in existing_paises:
        conn.execute(
            text("INSERT INTO paises (name) VALUES (:name) ON CONFLICT DO NOTHING"),
            {"name": pais_name},
        )

    # Update pais_id from the old text column
    conn.execute(
        text(
            """
            UPDATE empresas e
            SET pais_id = p.id
            FROM paises p
            WHERE lower(e.pais) = lower(p.name)
              AND e.pais IS NOT NULL
              AND e.pais != ''
            """
        )
    )

    # ── Phase 5: Migrate existing provincia text data ───────────────────────
    # For each unique province string, find the matching DB province (by name, case-insensitive)
    # and assign the provincia_id. We only match if the empresa also has a pais_id set.
    existing_provincias = conn.execute(
        text(
            """
            SELECT DISTINCT e.provincia, e.pais_id
            FROM empresas e
            WHERE e.provincia IS NOT NULL AND e.provincia != ''
            """
        )
    ).fetchall()

    for (prov_name, emp_pais_id) in existing_provincias:
        if not emp_pais_id:
            # empresa has province but no country — try to match España by default
            if spain_id:
                match_pais_id = spain_id
            else:
                continue
        else:
            match_pais_id = emp_pais_id

        # Insert province if not yet in DB
        conn.execute(
            text(
                "INSERT INTO provincias (name, pais_id) VALUES (:name, :pais_id) "
                "ON CONFLICT DO NOTHING"
            ),
            {"name": prov_name, "pais_id": match_pais_id},
        )

    # Update provincia_id
    conn.execute(
        text(
            """
            UPDATE empresas e
            SET provincia_id = pv.id
            FROM provincias pv
            WHERE lower(e.provincia) = lower(pv.name)
              AND (
                  (e.pais_id IS NOT NULL AND pv.pais_id = e.pais_id)
                  OR (e.pais_id IS NULL)
              )
              AND e.provincia IS NOT NULL
              AND e.provincia != ''
            """
        )
    )

    # ── Phase 6: Create FK constraints and indexes ──────────────────────────
    op.create_foreign_key(
        "fk_empresas_pais_id",
        "empresas", "paises",
        ["pais_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_empresas_provincia_id",
        "empresas", "provincias",
        ["provincia_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_empresas_pais_id", "empresas", ["pais_id"])
    op.create_index("ix_empresas_provincia_id", "empresas", ["provincia_id"])

    # ── Phase 7: Drop old text columns ─────────────────────────────────────
    op.drop_column("empresas", "provincia")
    op.drop_column("empresas", "pais")


def downgrade() -> None:
    # Re-add text columns
    op.add_column("empresas", sa.Column("pais", sa.String(100), nullable=True))
    op.add_column("empresas", sa.Column("provincia", sa.String(100), nullable=True))

    conn = op.get_bind()

    # Restore text values from FK relations
    conn.execute(
        text(
            """
            UPDATE empresas e
            SET pais = p.name
            FROM paises p
            WHERE e.pais_id = p.id
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE empresas e
            SET provincia = pv.name
            FROM provincias pv
            WHERE e.provincia_id = pv.id
            """
        )
    )

    # Drop FK constraints and indexes
    op.drop_index("ix_empresas_provincia_id", table_name="empresas")
    op.drop_index("ix_empresas_pais_id", table_name="empresas")
    op.drop_constraint("fk_empresas_provincia_id", "empresas", type_="foreignkey")
    op.drop_constraint("fk_empresas_pais_id", "empresas", type_="foreignkey")
    op.drop_column("empresas", "provincia_id")
    op.drop_column("empresas", "pais_id")

    # Drop tables
    op.drop_index("ix_provincias_name_pais_lower", table_name="provincias")
    op.drop_table("provincias")
    op.drop_index("ix_paises_name_lower", table_name="paises")
    op.drop_table("paises")
