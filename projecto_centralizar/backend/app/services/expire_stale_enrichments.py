"""
Service to expire stale enrichment runs.
Used by both the admin API endpoint and the standalone cron script.
"""
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.enrichment_log import IntegrationLog as EnrichmentLog
from app.models.empresa import Empresa

logger = logging.getLogger(__name__)


async def expire_stale_runs(db: AsyncSession) -> dict:
    """
    Find enrichment_logs stuck in 'pending' or 'sent' (sent but no callback yet)
    older than ENRICHMENT_TIMEOUT_MINUTES and reset them.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.ENRICHMENT_TIMEOUT_MINUTES)

    # 1. Find stale logs
    result = await db.execute(
        select(EnrichmentLog)
        .where(EnrichmentLog.status.in_(["pending", "sent"]))
        .where(EnrichmentLog.created_at < cutoff)
    )

    stale_logs = list(result.scalars().all())

    if not stale_logs:
        return {"expired": 0}

    expired_count = 0
    for log in stale_logs:
        log.status = "expired"
        log.error_log = (log.error_log or "") + f"\nAuto-expired at {datetime.now(timezone.utc).isoformat()}"
        expired_count += 1

    # 2. Reset empresas stuck in "sent" or "pending" whose enrichment is older than cutoff
    await db.execute(
        update(Empresa)
        .where(Empresa.enrichment_status.in_(["sent", "pending"]))
        .where(Empresa.last_enriched_at < cutoff)
        .values(enrichment_status=None)
    )

    await db.commit()
    logger.info(f"Expired {expired_count} stale enrichment runs (cutoff: {cutoff})")
    return {"expired": expired_count}
