from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func, Table, Column, BigInteger, Integer
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.campaign import contact_campaigns

contact_sectors = Table(
    "contact_sectors",
    Base.metadata,
    Column("contact_id", ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
    Column("sector_id", ForeignKey("sectors.id", ondelete="CASCADE"), primary_key=True),
)

contact_verticals = Table(
    "contact_verticals",
    Base.metadata,
    Column("contact_id", ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
    Column("vertical_id", ForeignKey("verticals.id", ondelete="CASCADE"), primary_key=True),
)

contact_products = Table(
    "contact_products",
    Base.metadata,
    Column("contact_id", ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
    Column("product_id", ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
)

contact_cargos = Table(
    "contact_cargos",
    Base.metadata,
    Column("contact_id", ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
    Column("cargo_id", ForeignKey("cargos.id", ondelete="CASCADE"), primary_key=True),
)


class Contact(Base):
    __tablename__ = "contacts"

    # --- Required fields ---
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(255), nullable=False)

    # --- Optional identity fields ---
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(150), nullable=True) # legacy, kept for migration compat

    # --- Unique business identifiers (nullable — multiple NULLs allowed by PostgreSQL) ---
    cif: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True, index=True)
    dominio: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)

    # --- Contact channels ---
    email_generic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # --- Business context ---
    product: Mapped[str | None] = mapped_column(String(255), nullable=True)  # legacy, kept for migration compat
    products: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # --- Legacy Foreign keys (can be queried before migration deletion) ---
    # scalar foreign keys are removed from the model explicitly to force M2M logic.


    # --- JSONB enrichment notes (merge-on-update) ---
    notes: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # --- Relationships ---
    sectors: Mapped[list["Sector"]] = relationship(  # noqa: F821
        secondary=contact_sectors, back_populates="contacts", lazy="selectin"
    )
    verticals: Mapped[list["Vertical"]] = relationship(  # noqa: F821
        secondary=contact_verticals, back_populates="contacts", lazy="selectin"
    )
    products_rel: Mapped[list["Product"]] = relationship(  # noqa: F821
        secondary=contact_products, back_populates="contacts", lazy="selectin"
    )
    cargos: Mapped[list["Cargo"]] = relationship(  # noqa: F821
        secondary=contact_cargos, back_populates="contacts", lazy="selectin"
    )
    campaigns: Mapped[list["Campaign"]] = relationship(  # noqa: F821
        secondary=contact_campaigns, back_populates="contacts", lazy="selectin"
    )
