"""
Logs — Endpoints para consulta y limpieza de logs de auditoría.

Este módulo proporciona:
1. GET  /api/logs          → Consultar logs con filtros (fecha, usuario)
2. DELETE /api/logs/cleanup → Eliminar logs más antiguos de X días (solo admin)

Limpieza automática de logs antiguos:
  - Criterio por defecto: logs con created_at > 90 días
  - La limpieza mantiene la tabla ligera y evita problemas de rendimiento
  - Los logs críticos seguirán disponibles los últimos 90 días
  - Se puede ejecutar manualmente vía endpoint o automáticamente vía cron

  ¿Por qué limpiar logs periódicamente?
  - Una tabla de logs que crece sin control degrada el rendimiento de:
    a) INSERT: más datos → índices más grandes → actualizaciones más lentas
    b) SELECT: más filas → queries más lentos aunque haya índices
    c) VACUUM: PostgreSQL necesita más tiempo para limpiar dead tuples
  - El borrado periódico mantiene la tabla en un tamaño manejable

Seguridad:
  - El endpoint de limpieza requiere autenticación JWT + rol admin
  - Se registra la propia acción de limpieza en los logs
  - El parámetro retention_days tiene un mínimo de 30 días por seguridad

  TODO: futura opción de archivado antes de borrado (exportar a CSV/S3)
  TODO: ajustar intervalo de retención según necesidades del negocio

Tablas involucradas:
  - logs: Lectura y eliminación de registros antiguos

Índices aprovechados:
  - idx_logs_user_id:    Para filtrar por usuario en GET /api/logs
  - idx_logs_created_at: Para filtrar por fecha y para el DELETE de limpieza
"""

import logging
from datetime import datetime, timezone

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, delete, func, text
from sqlalchemy.ext.asyncio import AsyncSession

# Importación de la sesión de base de datos
from app.database import get_db
# Importación del modelo de logs
from app.models.log import Log
# Importación de la dependencia de admin para proteger los endpoints
from app.auth import AdminUser
# Importación de la configuración centralizada
from app.config import settings as app_settings

# Logger para registrar eventos en la consola del servidor
logger = logging.getLogger("uvicorn.error")

# Router con prefijo /api y tag para la documentación OpenAPI
router = APIRouter(prefix="/api", tags=["Logs"])

# ── Configuración de retención ──
# Se lee de app.config.Settings.LOG_RETENTION_DAYS (configurable vía .env)
# TODO: ajustar según necesidades del negocio (30 mínimo por seguridad)
DEFAULT_RETENTION_DAYS = app_settings.LOG_RETENTION_DAYS


# ══════════════════════════════════════════════════════════════════════
# SCHEMAS — Definición de los modelos de entrada/salida
# ══════════════════════════════════════════════════════════════════════

class LogItem(BaseModel):
    """
    Schema de un log individual para la respuesta de listado.
    Cada log contiene la acción, el usuario que la realizó, y metadata.
    """
    id: int
    user_id: int | None
    action: str
    metadata: dict | None = None
    created_at: str           # ISO 8601 string

    model_config = {"from_attributes": True}


class LogListResponse(BaseModel):
    """
    Schema de respuesta para GET /api/logs.
    Contiene la lista de logs y el total de registros.
    """
    logs: list[LogItem]
    total: int


class CleanupResponse(BaseModel):
    """
    Schema de respuesta para DELETE /api/logs/cleanup.
    Informa cuántos registros se eliminaron y el criterio usado.
    """
    success: bool
    deleted_count: int
    retention_days: int
    message: str


# ══════════════════════════════════════════════════════════════════════
# FUNCIONES AUXILIARES
# ══════════════════════════════════════════════════════════════════════

def _serialize_log(log: Log) -> dict:
    """
    Convierte un objeto Log de SQLAlchemy a un diccionario
    compatible con el schema LogItem.
    """
    return {
        "id": log.id,
        "user_id": log.user_id,
        "action": log.action,
        "metadata": log.metadata_,
        "created_at": log.created_at.isoformat() if log.created_at else "",
    }


# ══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════


@router.get(
    "/logs",
    response_model=LogListResponse,
    summary="Consultar logs de auditoría",
)
async def list_logs(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    user_id: int | None = Query(None, description="Filtrar por ID de usuario"),
    limit: int = Query(100, ge=1, le=1000, description="Número máximo de logs"),
    offset: int = Query(0, ge=0, description="Offset para paginación"),
):
    """
    Endpoint: GET /api/logs

    Flujo:
    1. Construye la query con filtros opcionales (user_id)
    2. Aplica paginación (limit/offset)
    3. Ordena por created_at descendente (más recientes primero)
    4. Retorna la lista de logs con el total

    Índices aprovechados:
    - idx_logs_user_id: Si se filtra por user_id, PostgreSQL usa este índice
      en lugar de un full table scan → O(log n) vs O(n)
    - idx_logs_created_at: El ORDER BY created_at DESC se beneficia del índice

    Parámetros de query:
    - user_id: Filtrar logs de un usuario específico (audit trail)
    - limit:   Máximo de resultados (default 100, max 1000)
    - offset:  Saltar N registros para paginación

    Seguridad: Solo admin (AdminUser dependency)
    """

    # ── Paso 1: Construir query base ──
    query = select(Log)
    count_query = select(func.count()).select_from(Log)

    # ── Paso 2: Aplicar filtros ──
    # Si se proporciona user_id, filtramos por él
    # Esto aprovecha el índice idx_logs_user_id
    if user_id is not None:
        query = query.where(Log.user_id == user_id)
        count_query = count_query.where(Log.user_id == user_id)

    # ── Paso 3: Contar total de registros (para paginación) ──
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # ── Paso 4: Aplicar orden y paginación ──
    # ORDER BY created_at DESC aprovecha el índice idx_logs_created_at
    query = query.order_by(Log.created_at.desc()).limit(limit).offset(offset)

    # ── Paso 5: Ejecutar query ──
    result = await db.execute(query)
    logs = result.scalars().all()

    logger.info(
        f"[logs] Consulta de logs — {len(logs)} de {total} total "
        f"(filtro user_id={user_id}, limit={limit}, offset={offset})"
    )

    return {
        "logs": [_serialize_log(log) for log in logs],
        "total": total,
    }


@router.delete(
    "/logs/cleanup",
    response_model=CleanupResponse,
    summary="Limpiar logs antiguos",
)
async def cleanup_old_logs(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    retention_days: int = Query(
        DEFAULT_RETENTION_DAYS,
        ge=30,
        le=365,
        description="Días de retención (mínimo 30, máximo 365)",
    ),
):
    """
    Endpoint: DELETE /api/logs/cleanup

    Limpieza manual de logs antiguos. Elimina todos los registros de la
    tabla 'logs' cuya fecha created_at sea anterior a NOW() - retention_days.

    Flujo:
    1. Calcula la fecha de corte (NOW() - retention_days)
    2. Ejecuta DELETE FROM logs WHERE created_at < fecha_de_corte
    3. Registra la propia acción de limpieza en los logs
    4. Retorna el número de registros eliminados

    SQL equivalente:
      DELETE FROM logs
      WHERE created_at < NOW() - INTERVAL '90 days';

    Índice aprovechado:
    - idx_logs_created_at: PostgreSQL usa este índice para localizar
      rápidamente las filas a eliminar sin recorrer toda la tabla.

    ¿Por qué mantener los logs limpios?
    - Una tabla que crece sin control degrada el rendimiento de INSERT, 
      SELECT y VACUUM paulatinamente.
    - Los logs más recientes (últimos 90 días por defecto) siguen disponibles
      para auditoría y cumplimiento.
    - Se registra la acción de limpieza como un log para trazabilidad.

    Seguridad:
    - Solo admin (AdminUser dependency)
    - Mínimo 30 días de retención (no se puede borrar todo)
    - Se registra quién ejecutó la limpieza

    TODO: futura opción de archivado antes de borrado (exportar a CSV/S3)
    TODO: ajustar intervalo de retención según necesidades del negocio
    """

    # ── Paso 1: Calcular la fecha de corte ──
    # Usamos la función SQL NOW() - INTERVAL para que sea el servidor de BD
    # quien calcule la fecha, evitando problemas de husos horarios
    cutoff_interval = text(f"NOW() - INTERVAL '{retention_days} days'")

    # ── Paso 2: Ejecutar el DELETE ──
    # DELETE FROM logs WHERE created_at < NOW() - INTERVAL 'X days'
    # El índice idx_logs_created_at acelera esta operación
    result = await db.execute(
        delete(Log).where(Log.created_at < cutoff_interval)
    )
    deleted_count = result.rowcount

    logger.info(
        f"[logs/cleanup] Admin {admin.email} ejecutó limpieza: "
        f"{deleted_count} logs eliminados (retención: {retention_days} días)"
    )

    # ── Paso 3: Registrar la acción de limpieza en los propios logs ──
    # Esto queda como registro de que se hizo una limpieza y quién la ejecutó
    cleanup_log = Log(
        user_id=admin.id,
        action="Limpieza de logs antiguos",
        metadata_={
            "admin_email": admin.email,
            "retention_days": retention_days,
            "deleted_count": deleted_count,
            "endpoint": "/api/logs/cleanup",
        },
    )
    db.add(cleanup_log)

    # ── Paso 4: Commit atómico ──
    await db.commit()

    return CleanupResponse(
        success=True,
        deleted_count=deleted_count,
        retention_days=retention_days,
        message=(
            f"Se eliminaron {deleted_count} logs con más de "
            f"{retention_days} días de antigüedad."
        ),
    )
