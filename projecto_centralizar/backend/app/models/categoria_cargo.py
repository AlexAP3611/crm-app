from sqlalchemy import String, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CategoriaCargo(Base):
    __tablename__ = "categorias_cargo"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Back-reference: all cargos with this category
    cargos: Mapped[list["Cargo"]] = relationship(back_populates="categoria", lazy="selectin")  # noqa: F821


# Case-insensitive unique index (same pattern as sectors, verticals, products)
Index("ix_categorias_cargo_name_lower", func.lower(CategoriaCargo.name), unique=True)
