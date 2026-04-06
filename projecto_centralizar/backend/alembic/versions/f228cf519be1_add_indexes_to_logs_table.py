"""add_indexes_to_logs_table

Revision ID: f228cf519be1
Revises: c54ff94289e7
Create Date: 2026-04-06 12:38:15.472331

Migración: Índices de rendimiento en la tabla 'logs'

Índices creados:
1. idx_logs_user_id    → Acelera consultas de auditoría por usuario
2. idx_logs_created_at → Acelera consultas por rango de fechas y DELETE de logs antiguos

¿Por qué índices en logs?
- SELECT: Las consultas de audit trail por usuario (WHERE user_id = X) pasan
  de un full table scan O(n) a una búsqueda indexada O(log n).
- DELETE: La limpieza periódica de logs antiguos (WHERE created_at < X)
  también se beneficia del índice, ya que no necesita recorrer toda la tabla.
- INSERT: Cada INSERT tiene un costo mínimo adicional (~5-10%) por mantener
  los índices actualizados, pero es aceptable dado el beneficio en lectura.

TODO: Revisar periódicamente el tamaño de los índices con:
  SELECT pg_size_pretty(pg_relation_size('idx_logs_user_id'));
  SELECT pg_size_pretty(pg_relation_size('idx_logs_created_at'));
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f228cf519be1'
down_revision: Union[str, Sequence[str], None] = 'c54ff94289e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Crea índices en la tabla logs para mejorar rendimiento de consultas.

    Índice idx_logs_user_id:
    - Columna: user_id
    - Motivo: consultas por usuario serán rápidas (audit trail)
    - Uso típico: SELECT * FROM logs WHERE user_id = ?

    Índice idx_logs_created_at:
    - Columna: created_at
    - Motivo: consultas por rango de fechas y borrado de logs antiguos
    - Uso típico: DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days'
    """
    # Índice por usuario — acelera consultas de auditoría tipo:
    # "¿Qué acciones ha realizado el usuario X?"
    op.create_index('idx_logs_user_id', 'logs', ['user_id'], unique=False)

    # Índice por fecha — acelera consultas de rango y limpieza periódica tipo:
    # "¿Qué pasó entre el 1 y el 15 de marzo?" o "Borrar logs > 90 días"
    op.create_index('idx_logs_created_at', 'logs', ['created_at'], unique=False)


def downgrade() -> None:
    """
    Elimina los índices de la tabla logs.
    La tabla y sus datos no se ven afectados.
    """
    op.drop_index('idx_logs_user_id', table_name='logs')
    op.drop_index('idx_logs_created_at', table_name='logs')
