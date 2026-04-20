from sqlalchemy import Column, ForeignKey, String, Table, Index, func
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
    __table_args__ = (
        Index("ix_campaigns_nombre_lower", func.lower("nombre"), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)

    contacts: Mapped[list["Contact"]] = relationship(  # noqa: F821
        secondary=contact_campaigns, back_populates="campaigns", lazy="selectin"
    )
