from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sector import Sector
from app.services.m2m_base_service import M2MEntityService

# Initialize the generic service for Sector
_service = M2MEntityService(Sector)

def normalize_name(name: str) -> str | None:
    """Synchronous normalization."""
    return _service.normalize_name(name)

async def prefill_sector_cache(session: AsyncSession, names: set[str]) -> dict[str, Sector]:
    """Batch-fetch existing sectors."""
    return await _service.prefill_cache(session, names)

async def get_or_create(session: AsyncSession, name: str, cache: dict[str, Sector] | None = None) -> Sector | None:
    """Idempotent get-or-create for sectors."""
    return await _service.get_or_create(session, name, cache=cache)

async def create_strict(session: AsyncSession, name: str) -> Sector:
    """Strict creation for sectors."""
    return await _service.create_strict(session, name)

async def get_by_name(session: AsyncSession, name: str) -> Sector | None:
    """Legacy lookup support."""
    # We can use get_or_create without creating (by checking cache or DB)
    # or just implement a quick helper if needed. 
    # For now, let's just keep the signature if it's used elsewhere.
    norm = normalize_name(name)
    if not norm:
        return None
    cache = await prefill_sector_cache(session, {name})
    return cache.get(norm.lower())


