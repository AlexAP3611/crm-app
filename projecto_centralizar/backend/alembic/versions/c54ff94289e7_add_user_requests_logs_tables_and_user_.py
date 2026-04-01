"""add user_requests logs tables and user role column

Revision ID: c54ff94289e7
Revises: f0871be72a14
Create Date: 2026-04-01 17:08:01.046193

Migración Parte 3:
- Crea tabla 'user_requests' para solicitudes de acceso
- Crea tabla 'logs' para auditoría de acciones
- Añade columna 'role' a 'users' (admin/gestor)
- Añade columna 'created_at' a 'users'
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c54ff94289e7'
down_revision: Union[str, Sequence[str], None] = 'f0871be72a14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Upgrade: Crea tablas user_requests y logs, añade role y created_at a users.
    """

    # ── Tabla user_requests ──
    # Solo se crea si no existe (por si create_all ya la creó en dev)
    op.create_table(
        'user_requests',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='ID único de la solicitud'),
        sa.Column('email', sa.Text(), nullable=False, comment='Email del usuario que solicita acceso'),
        sa.Column('password', sa.Text(), nullable=False, comment='Hash bcrypt de la contraseña del solicitante'),
        sa.Column('status', sa.Text(), server_default='pending', nullable=False, comment='Estado: pending, approved o rejected'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Fecha y hora de creación de la solicitud'),
        sa.Column('reviewed_by', sa.Integer(), nullable=True, comment='ID del admin que revisó (NULL si pendiente)'),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True, comment='Fecha y hora de la revisión (NULL si pendiente)'),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_user_requests_status'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )

    # ── Tabla logs ──
    op.create_table(
        'logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='ID único del registro de log'),
        sa.Column('user_id', sa.Integer(), nullable=True, comment='ID del usuario que ejecutó la acción (NULL si anónimo)'),
        sa.Column('action', sa.Text(), nullable=False, comment='Descripción de la acción realizada'),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Datos adicionales de la acción en formato JSONB'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Fecha y hora del registro de la acción'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )

    # ── Nuevas columnas en users ──
    # Usamos batch_alter para manejar el caso de que la columna ya exista
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(
            sa.Column('role', sa.Text(), server_default='gestor', nullable=False, comment="Rol del usuario: 'admin' o 'gestor'")
        )
        batch_op.add_column(
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False, comment='Fecha y hora de creación del usuario')
        )


def downgrade() -> None:
    """
    Downgrade: Revierte los cambios de la Parte 3.
    """
    # Eliminar columnas añadidas a users
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('created_at')
        batch_op.drop_column('role')

    # Eliminar tablas creadas
    op.drop_table('logs')
    op.drop_table('user_requests')
