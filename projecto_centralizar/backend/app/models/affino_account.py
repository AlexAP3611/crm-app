from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base


class AffinoAccount(Base):
    __tablename__ = "affino_accounts"

    id         = Column(Integer, primary_key=True, index=True)
    nombre     = Column(String, nullable=False)
    x_user_id  = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
