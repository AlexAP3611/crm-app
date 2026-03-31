from datetime import datetime

from sqlalchemy import Column, ForeignKey, String, Table, DateTime, Numeric, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

contact_campaigns = Table(
    "contact_campaigns",
    Base.metadata,
    Column("contact_id", ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True),
    Column("campaign_id", ForeignKey("campaigns.id", ondelete="CASCADE"), primary_key=True),
)


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="Activa")
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    fecha_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    presupuesto: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    objetivo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    responsable: Mapped[str | None] = mapped_column(String(150), nullable=True)
    canal: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)

    contacts: Mapped[list["Contact"]] = relationship(  # noqa: F821
        secondary=contact_campaigns, back_populates="campaigns", lazy="selectin"
    )
