from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Cargo(Base):
    __tablename__ = "cargos"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)

    # FK to categorias_cargo — nullable, only set by humans via UI
    categoria_id: Mapped[int | None] = mapped_column(
        ForeignKey("categorias_cargo.id", ondelete="SET NULL"), nullable=True
    )
    categoria: Mapped["CategoriaCargo"] = relationship(  # noqa: F821
        back_populates="cargos", lazy="selectin"
    )


    contacts: Mapped[list["Contact"]] = relationship(back_populates="cargo", lazy="selectin")  # noqa: F821
