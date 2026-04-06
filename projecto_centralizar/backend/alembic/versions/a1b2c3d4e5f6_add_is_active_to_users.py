"""add_is_active_to_users

Revision ID: a1b2c3d4e5f6
Revises: f228cf519be1
Create Date: 2026-04-06 13:40:00.000000

Migración: Añadir columna is_active a la tabla 'users'

¿Por qué borrado lógico (soft delete)?
- Preserva el historial de logs asociados al user_id
- Mantiene la integridad referencial con la tabla 'logs'
- Permite auditar qué hizo el usuario antes de ser eliminado
- Posibilita la reactivación de la cuenta en el futuro

Columna añadida:
  - is_active (BOOLEAN, NOT NULL, DEFAULT TRUE)
  - Los usuarios existentes quedan con is_active = TRUE automáticamente
  - Al "eliminar" un usuario, se cambia a FALSE (DELETE /api/users/{id})

Endpoints afectados:
  - GET /api/users: solo devuelve usuarios con is_active = TRUE
  - DELETE /api/users/{id}: cambia is_active a FALSE
  - get_current_user() en auth.py: bloquea login si is_active = FALSE
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f228cf519be1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Añade la columna is_active a la tabla users.

    - Tipo: BOOLEAN (true/false)
    - Nullable: False (siempre debe tener valor)
    - Default: True (los usuarios existentes quedan activos)
    - server_default: 'true' (se aplica a filas existentes en la DB)

    Al ejecutar esta migración, TODOS los usuarios existentes
    automáticamente tendrán is_active = TRUE gracias al server_default.
    """
    op.add_column(
        'users',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true'),
            comment='False = usuario eliminado lógicamente (soft delete)',
        )
    )


def downgrade() -> None:
    """
    Elimina la columna is_active de la tabla users.
    ADVERTENCIA: Esto perderá toda la información de borrado lógico.
    """
    op.drop_column('users', 'is_active')
