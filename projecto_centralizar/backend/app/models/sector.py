from sqlalchemy import String, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Sector(Base):
    __tablename__ = "sectors"



    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    empresas: Mapped[list["Empresa"]] = relationship(secondary="empresa_sectors", back_populates="sectors", lazy="selectin")  # noqa: F821

Index("ix_sectors_name_lower", func.lower(Sector.name), unique=True)

