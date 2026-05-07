import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.auth import require_admin, AdminUser
from app.config import settings as app_settings
from app.models.log import Log
from app.models.enrichment_log import IntegrationLog
from app.schemas.activity import PaginatedIntegrations, PaginatedAudit

logger = logging.getLogger("uvicorn.error")

router = APIRouter(
    prefix="/api/activity",
    tags=["Activity"],
    dependencies=[Depends(require_admin)]
)


# ── Schemas ──

class CleanupResponse(BaseModel):
    """Response for log cleanup endpoints."""
    success: bool
    deleted_count: int
    retention_days: int
    message: str


# ── List endpoints ──

@router.get("/integrations", response_model=PaginatedIntegrations)
async def list_integration_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated enrichment/integration logs with user info.
    Only for admins.
    """
    offset = (page - 1) * page_size
    
    # Count total
    count_stmt = select(func.count(IntegrationLog.run_id))
    total = await db.scalar(count_stmt) or 0
    
    # Fetch items
    stmt = (
        select(IntegrationLog)
        .options(joinedload(IntegrationLog.user))
        .order_by(IntegrationLog.created_at.desc())
        .limit(page_size)
        .offset(offset)
    )
    result = await db.execute(stmt)
    items = result.scalars().unique().all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/audit", response_model=PaginatedAudit)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated general audit logs with user info.
    Only for admins.
    """
    offset = (page - 1) * page_size
    
    # Count total
    count_stmt = select(func.count(Log.id))
    total = await db.scalar(count_stmt) or 0
    
    # Fetch items
    stmt = (
        select(Log)
        .options(joinedload(Log.user))
        .order_by(Log.created_at.desc(), Log.id.desc())
        .limit(page_size)
        .offset(offset)
    )
    result = await db.execute(stmt)
    items = result.scalars().unique().all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }


# ── Cleanup endpoints ──

@router.delete("/integrations/cleanup", response_model=CleanupResponse)
async def cleanup_integration_logs(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    retention_days: int = Query(
        app_settings.LOG_RETENTION_DAYS,
        ge=30,
        le=365,
        description="Días de retención (mínimo 30, máximo 365)",
    ),
):
    """
    DELETE /api/activity/integrations/cleanup

    Purges enrichment_logs rows older than retention_days.
    Writes an audit entry to the logs table recording who ran the cleanup.
    Only for admins.

    SQL equivalent:
      DELETE FROM enrichment_logs WHERE created_at < NOW() - INTERVAL 'X days';
    """
    cutoff_interval = text(f"NOW() - INTERVAL '{retention_days} days'")

    result = await db.execute(
        delete(IntegrationLog).where(IntegrationLog.created_at < cutoff_interval)
    )
    deleted_count = result.rowcount

    logger.info(
        f"[activity/cleanup] Admin {admin.email} purged {deleted_count} "
        f"integration logs (retention: {retention_days} days)"
    )

    # Record the cleanup action in the audit log for traceability
    audit_entry = Log(
        user_id=admin.id,
        action="Limpieza de logs de integración",
        metadata_={
            "admin_email": admin.email,
            "retention_days": retention_days,
            "deleted_count": deleted_count,
            "endpoint": "/api/activity/integrations/cleanup",
        },
    )
    db.add(audit_entry)
    await db.commit()

    return CleanupResponse(
        success=True,
        deleted_count=deleted_count,
        retention_days=retention_days,
        message=(
            f"Se eliminaron {deleted_count} registros de integración con más de "
            f"{retention_days} días de antigüedad."
        ),
    )
