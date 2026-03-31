from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Vertical(Base):
    __tablename__ = "verticals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    contacts: Mapped[list["Contact"]] = relationship(secondary="contact_verticals", back_populates="verticals", lazy="selectin")  # noqa: F821
