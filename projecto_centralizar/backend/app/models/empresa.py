from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, func, Float
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


class Empresa(Base):
    __tablename__ = "empresas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    web: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cif: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    numero_empleados: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    facturacion: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cnae: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # --- M2M Relationships (formerly on Contact) ---
    sectors: Mapped[list["Sector"]] = relationship(  # noqa: F821
        secondary=empresa_sectors, back_populates="empresas", lazy="selectin"
    )
    verticals: Mapped[list["Vertical"]] = relationship(  # noqa: F821
        secondary=empresa_verticals, back_populates="empresas", lazy="selectin"
    )
    products_rel: Mapped[list["Product"]] = relationship(  # noqa: F821
        secondary=empresa_products, back_populates="empresas", lazy="selectin"
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
