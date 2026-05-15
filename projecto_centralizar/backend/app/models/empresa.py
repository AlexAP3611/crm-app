from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, func, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# ── M2M association tables for Empresa ──
empresa_sectors = Table(
    "empresa_sectors",
    Base.metadata,
    Column("empresa_id", ForeignKey("empresas.id", ondelete="CASCADE"), primary_key=True),
    Column("sector_id", ForeignKey("sectors.id", ondelete="CASCADE"), primary_key=True),
)

empresa_verticals = Table(
    "empresa_verticals",
    Base.metadata,
    Column("empresa_id", ForeignKey("empresas.id", ondelete="CASCADE"), primary_key=True),
    Column("vertical_id", ForeignKey("verticals.id", ondelete="CASCADE"), primary_key=True),
)

empresa_products = Table(
    "empresa_products",
    Base.metadata,
    Column("empresa_id", ForeignKey("empresas.id", ondelete="CASCADE"), primary_key=True),
    Column("product_id", ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
)

class Competidor(Base):
    __tablename__ = "competidores"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empresa_id: Mapped[int] = mapped_column(
        ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    posicion: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3
    web: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    facebook: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationship back to empresa
    empresa: Mapped["Empresa"] = relationship(back_populates="competidores")

    __table_args__ = (
        UniqueConstraint("empresa_id", "posicion", name="uq_empresa_competidor_posicion"),
    )

class Empresa(Base):
    __tablename__ = "empresas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    web: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cif: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    numero_empleados: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    facturacion: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cnae: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pais_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("paises.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provincia_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("provincias.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # --- Social ---
    facebook: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # --- Relationships ---
    competidores: Mapped[list["Competidor"]] = relationship(
        "Competidor",
        back_populates="empresa",
        lazy="selectin",
        order_by="Competidor.posicion",
        cascade="all, delete-orphan",
    )

    # --- M2M Relationships ---
    sectors: Mapped[list["Sector"]] = relationship(  # noqa: F821
        secondary=empresa_sectors, back_populates="empresas", lazy="selectin"
    )
    verticals: Mapped[list["Vertical"]] = relationship(  # noqa: F821
        secondary=empresa_verticals, back_populates="empresas", lazy="selectin"
    )
    products_rel: Mapped[list["Product"]] = relationship(  # noqa: F821
        secondary=empresa_products, back_populates="empresas", lazy="selectin"
    )

    # --- Location Relationships ---
    pais_rel: Mapped[Optional["Pais"]] = relationship(  # noqa: F821
        "Pais", back_populates="empresas", lazy="selectin"
    )
    provincia_rel: Mapped[Optional["Provincia"]] = relationship(  # noqa: F821
        "Provincia", back_populates="empresas", lazy="selectin"
    )

    # --- Relationships ---
    contactos: Mapped[list["Contact"]] = relationship("Contact", back_populates="empresa_rel")

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # --- Enrichment Tracking ---
    last_enriched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_enrichment_tool: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    enrichment_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
