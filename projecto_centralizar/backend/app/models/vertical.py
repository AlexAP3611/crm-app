from sqlalchemy import String, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Vertical(Base):
    __tablename__ = "verticals"



    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    empresas: Mapped[list["Empresa"]] = relationship(secondary="empresa_verticals", back_populates="verticals", lazy="selectin")  # noqa: F821

Index("ix_verticals_name_lower", func.lower(Vertical.name), unique=True)

