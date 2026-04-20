from sqlalchemy import String, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Sector(Base):
    __tablename__ = "sectors"
    __table_args__ = (
        Index("ix_sectors_name_lower", func.lower("name"), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    empresas: Mapped[list["Empresa"]] = relationship(secondary="empresa_sectors", back_populates="sectors", lazy="selectin")  # noqa: F821
