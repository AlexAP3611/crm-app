from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.auth import require_admin
from app.models.log import Log
from app.models.enrichment_log import IntegrationLog
from app.schemas.activity import PaginatedIntegrations, PaginatedAudit

router = APIRouter(
    prefix="/api/activity",
    tags=["Activity"],
    dependencies=[Depends(require_admin)]
)

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
    items = result.scalars().all()
    
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
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }
