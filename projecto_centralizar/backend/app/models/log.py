"""
Modelo Log — Registro de auditoría de acciones del sistema.

Cada acción relevante del CRM (solicitudes, aprobaciones, rechazos,
consultas de admin, etc.) se registra aquí para tener trazabilidad
completa de lo que ocurre en el sistema.

Campos:
  - id:         Clave primaria autoincremental
  - user_id:    ID del usuario que realizó la acción (NULL para acciones
                de usuarios no autenticados, como solicitar acceso)
  - action:     Descripción de la acción realizada (texto libre)
  - metadata:   Datos adicionales en formato JSONB (email, IDs, etc.)
  - created_at: Fecha/hora del registro (automática)

Índices:
  - idx_logs_user_id:    Acelera consultas de auditoría por usuario.
                         Ejemplo: "¿Qué acciones ha realizado el usuario X?"
  - idx_logs_created_at: Acelera consultas por rango de fechas y la limpieza
                         periódica de logs antiguos (DELETE WHERE created_at < X).

  Impacto de los índices:
  - SELECT/DELETE: Pasan de un full table scan O(n) a búsqueda indexada O(log n).
  - INSERT: Costo mínimo adicional (~5-10%) por mantener los índices actualizados,
    pero es aceptable dado el mayor beneficio en lectura y borrado.

  TODO: Revisar periódicamente el tamaño de los índices con:
    SELECT pg_size_pretty(pg_relation_size('idx_logs_user_id'));
    SELECT pg_size_pretty(pg_relation_size('idx_logs_created_at'));

Uso futuro:
  - Se puede usar para auditoría, reportes de actividad, detección
    de patrones, etc.
  - El campo metadata permite almacenar información flexible sin
    necesidad de añadir columnas adicionales.
"""

from datetime import datetime

from sqlalchemy import Integer, Text, DateTime, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Log(Base):
    """
    Tabla 'logs' — Registro de auditoría de todas las acciones del sistema.

    Cada entrada representa una acción específica con su contexto.
    El campo metadata (JSONB) permite almacenar información adicional
    de forma flexible sin alterar el esquema.

    Índices definidos en __table_args__:
    - idx_logs_user_id:    Para consultas rápidas de audit trail por usuario
    - idx_logs_created_at: Para consultas por rango de fechas y limpieza automática
    """
    __tablename__ = "logs"

    # ── Índices ──
    # Se declaran aquí para que Alembic los detecte automáticamente al generar
    # migraciones futuras. Los índices ya existen en la DB (migración f228cf519be1).
    __table_args__ = (
        # Índice por usuario — acelera: SELECT ... WHERE user_id = ?
        Index("idx_logs_user_id", "user_id"),
        # Índice por fecha — acelera: SELECT/DELETE ... WHERE created_at < ?
        Index("idx_logs_created_at", "created_at"),
    )

    # ── Columnas ──

    # Identificador único del registro de log (autoincremental)
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
        comment="ID único del registro de log",
    )

    # ID del usuario que realizó la acción
    # NULL cuando la acción es de un usuario no autenticado
    # (por ejemplo, enviar una solicitud de acceso)
    # TODO: Añadir ForeignKey("users.id") cuando se necesite integridad referencial
    user_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
        comment="ID del usuario que ejecutó la acción (NULL si anónimo)",
    )

    # Descripción textual de la acción realizada
    # Ejemplos: "Nueva solicitud de usuario", "Solicitud aprobada", etc.
    action: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Descripción de la acción realizada",
    )

    # Datos adicionales en formato JSON
    # Permite almacenar contexto variable sin cambiar el esquema
    # Ejemplos: {"email": "user@example.com"}, {"request_id": 5}
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata",  # Nombre real de la columna en la DB es "metadata"
        JSONB,
        nullable=True,
        default=None,
        comment="Datos adicionales de la acción en formato JSONB",
    )

    # Timestamp de cuándo se registró la acción (automático vía DB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Fecha y hora del registro de la acción",
    )

    def __repr__(self) -> str:
        """Representación legible para debugging."""
        return f"<Log(id={self.id}, action='{self.action}', user_id={self.user_id})>"
