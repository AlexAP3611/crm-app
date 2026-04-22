from sqlalchemy import String, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Vertical(Base):
    __tablename__ = "verticals"
    __table_args__ = (
        Index("ix_verticals_name_lower", func.lower("name"), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    empresas: Mapped[list["Empresa"]] = relationship(secondary="empresa_verticals", back_populates="verticals", lazy="selectin")  # noqa: F821
