"""
Modelo User — Representa un usuario registrado y aprobado en el CRM.

Los usuarios se crean automáticamente cuando un administrador aprueba
una solicitud de acceso (UserRequest). El email y password_hash se
copian desde la solicitud original.

Campos:
  - id:            Clave primaria autoincremental
  - email:         Email único del usuario (se usa para login)
  - password_hash: Hash bcrypt de la contraseña
  - role:          Rol del usuario: 'admin' o 'gestor' (default: 'gestor')
  - created_at:    Fecha/hora de creación (automática)

Roles disponibles:
  - 'admin':  Acceso completo. Puede gestionar solicitudes, usuarios, etc.
  - 'gestor': Acceso estándar. Puede operar el CRM pero no gestionar usuarios.

Nota: La UI aún no distingue entre roles. Esta columna se incluye
para preparar la estructura para futuro control de acceso basado en roles.
"""

from datetime import datetime

from sqlalchemy import String, Text, DateTime, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    """
    Tabla 'users' — Usuarios registrados y aprobados del CRM.

    Solo se crean usuarios a través del flujo de aprobación de solicitudes,
    o manualmente por un administrador. El CHECK constraint en 'role'
    garantiza valores válidos.
    """
    __tablename__ = "users"

    # ── Restricciones a nivel de tabla ──
    # Asegura que el campo role solo admita valores permitidos
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'gestor')",
            name="ck_users_role",
        ),
    )

    # ── Columnas ──

    # Identificador único del usuario (autoincremental)
    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
        comment="ID único del usuario",
    )

    # Email del usuario — debe ser único en todo el sistema
    # Se usa como identificador de login
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        comment="Email único del usuario (se usa para login)",
    )

    # Hash bcrypt de la contraseña del usuario
    # IMPORTANTE: Nunca almacenar contraseñas en texto plano
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Hash bcrypt de la contraseña",
    )

    # Rol del usuario en el sistema
    # 'gestor' es el valor por defecto para usuarios aprobados desde solicitudes
    # 'admin' se asigna manualmente o mediante lógica futura
    role: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default="gestor",
        comment="Rol del usuario: 'admin' o 'gestor'",
    )

    # Timestamp de cuándo se creó el usuario (automático vía DB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Fecha y hora de creación del usuario",
    )

    def __repr__(self) -> str:
        """Representación legible para debugging."""
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
