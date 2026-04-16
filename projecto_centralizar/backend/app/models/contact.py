from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func, Table, Column, BigInteger, Integer
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Boolean

from app.database import Base
from app.models.campaign import contact_campaigns

class Contact(Base):
    __tablename__ = "contacts"

    # --- Required fields ---
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empresa_id: Mapped[int | None] = mapped_column(ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True)
    cargo_id: Mapped[int | None] = mapped_column(ForeignKey("cargos.id", ondelete="SET NULL"), nullable=True)

    # --- Optional identity fields ---
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(150), nullable=True) # legacy, kept for migration compat

    # --- Unique business identifiers (delegated to Empresa) ---
    @property
    def web(self) -> str | None:
        return self.empresa_rel.web if self.empresa_rel else None

    @property
    def cif(self) -> str | None:
        return self.empresa_rel.cif if self.empresa_rel else None

    @property
    def email_generic(self) -> str | None:
        return self.empresa_rel.email if self.empresa_rel else None

    @property
    def phone_generic(self) -> str | None:
        return self.empresa_rel.phone if self.empresa_rel else None

    # --- Delegated M2M properties (sectors/verticals/products now live on Empresa) ---
    @property
    def sectors(self) -> list:
        return self.empresa_rel.sectors if self.empresa_rel else []

    @property
    def verticals(self) -> list:
        return self.empresa_rel.verticals if self.empresa_rel else []

    @property
    def products_rel(self) -> list:
        return self.empresa_rel.products_rel if self.empresa_rel else []

    # --- Contact channels ---
    email_contact: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    phone_contact: Mapped[str | None] = mapped_column(String(50), nullable=True)
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
    empresa_rel: Mapped[Any] = relationship(
        "Empresa", lazy="selectin"
    )
    cargo: Mapped["Cargo"] = relationship(  # noqa: F821
        back_populates="contacts", lazy="selectin"
    )
    campaigns: Mapped[list["Campaign"]] = relationship(  # noqa: F821
        secondary=contact_campaigns, back_populates="contacts", lazy="selectin"
    )

    # --- Enrichment tracking ---
    enriched: Mapped[bool] = mapped_column(Boolean, default=False, server_default= "false", nullable=False)
    enriched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
