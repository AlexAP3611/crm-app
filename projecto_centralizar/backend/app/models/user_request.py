"""
Modelo UserRequest — Representa una solicitud de acceso de un nuevo usuario.

Cada vez que un usuario externo solicita acceso al CRM, se crea un registro
en esta tabla con estado 'pending'. Un administrador puede luego aprobar o
rechazar la solicitud, lo cual actualiza el status y los campos de revisión.

Campos:
  - id:          Clave primaria autoincremental
  - email:       Email del solicitante (no necesita ser único aquí,
                 porque el mismo email podría solicitar varias veces)
  - password:    Hash de la contraseña proporcionada por el solicitante.
                 Nunca se almacena en texto plano.
  - status:      Estado de la solicitud: 'pending', 'approved' o 'rejected'
  - created_at:  Fecha/hora de creación del registro (automática)
  - reviewed_by: ID del admin que revisó la solicitud (NULL si pendiente)
  - reviewed_at: Fecha/hora en que se revisó (NULL si pendiente)

Relaciones futuras:
  - reviewed_by podría tener FK a users.id cuando se implemente
    autenticación completa en los endpoints de admin.
"""

from datetime import datetime

from sqlalchemy import String, Text, Integer, DateTime, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRequest(Base):
    """
    Tabla 'user_requests' — Almacena solicitudes de acceso pendientes,
    aprobadas y rechazadas.

    El CHECK constraint en 'status' garantiza que solo se almacenen
    valores válidos ('pending', 'approved', 'rejected').
    """
    __tablename__ = "user_requests"

    # ── Restricciones a nivel de tabla ──
    # Asegura que el campo status solo admita valores permitidos
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_user_requests_status",
        ),
    )

    # ── Columnas ──

    # Identificador único de la solicitud (autoincremental)
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
        comment="ID único de la solicitud",
    )

    # Email proporcionado por el solicitante
    # No es UNIQUE porque un mismo email podría enviar múltiples solicitudes
    email: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Email del usuario que solicita acceso",
    )

    # Hash bcrypt de la contraseña proporcionada
    # IMPORTANTE: Nunca almacenar contraseñas en texto plano
    password: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Hash bcrypt de la contraseña del solicitante",
    )

    # Estado actual de la solicitud
    # Valores posibles: 'pending' (por defecto), 'approved', 'rejected'
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default="pending",
        comment="Estado: pending, approved o rejected",
    )

    # Timestamp de cuándo se creó la solicitud (automático vía DB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Fecha y hora de creación de la solicitud",
    )

    # ID del administrador que revisó la solicitud
    # NULL mientras esté en estado 'pending'
    # TODO: Añadir ForeignKey("users.id") cuando se integre autenticación admin
    reviewed_by: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
        comment="ID del admin que revisó (NULL si pendiente)",
    )

    # Timestamp de cuándo se revisó la solicitud
    # NULL mientras esté en estado 'pending'
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
        comment="Fecha y hora de la revisión (NULL si pendiente)",
    )

    def __repr__(self) -> str:
        """Representación legible para debugging."""
        return f"<UserRequest(id={self.id}, email='{self.email}', status='{self.status}')>"
