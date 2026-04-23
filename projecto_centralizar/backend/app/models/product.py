from sqlalchemy import String, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Product(Base):
    __tablename__ = "products"



    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    empresas: Mapped[list["Empresa"]] = relationship(secondary="empresa_products", back_populates="products_rel", lazy="selectin")  # noqa: F821

Index("ix_products_name_lower", func.lower(Product.name), unique=True)

