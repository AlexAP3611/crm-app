from sqlalchemy import String, ForeignKey, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Provincia(Base):
    __tablename__ = "provincias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    pais_id: Mapped[int] = mapped_column(ForeignKey("paises.id", ondelete="RESTRICT"), nullable=False)

    # Relationships
    pais: Mapped["Pais"] = relationship(back_populates="provincias")  # noqa: F821
    empresas: Mapped[list["Empresa"]] = relationship(  # noqa: F821
        back_populates="provincia_rel"
    )


Index("ix_provincias_name_pais_lower", func.lower(Provincia.name), Provincia.pais_id, unique=True)
