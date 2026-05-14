from sqlalchemy import String, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Pais(Base):
    __tablename__ = "paises"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Relationships
    provincias: Mapped[list["Provincia"]] = relationship(  # noqa: F821
        back_populates="pais", lazy="selectin"
    )
    empresas: Mapped[list["Empresa"]] = relationship(  # noqa: F821
        back_populates="pais_rel"
    )


Index("ix_paises_name_lower", func.lower(Pais.name), unique=True)
