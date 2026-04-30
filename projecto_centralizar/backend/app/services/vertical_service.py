from sqlalchemy.ext.asyncio import AsyncSession
from app.models.vertical import Vertical
from app.services.m2m_base_service import M2MEntityService

# Initialize the generic service for Vertical
_service = M2MEntityService(Vertical)

def normalize_name(name: str) -> str | None:
    """Synchronous normalization."""
    return _service.normalize_name(name)

async def prefill_vertical_cache(session: AsyncSession, names: set[str]) -> dict[str, Vertical]:
    """Batch-fetch existing verticals."""
    return await _service.prefill_cache(session, names)

async def get_or_create(session: AsyncSession, name: str, cache: dict[str, Vertical] | None = None) -> Vertical | None:
    """Idempotent get-or-create for verticals."""
    return await _service.get_or_create(session, name, cache=cache)

async def create_strict(session: AsyncSession, name: str) -> Vertical:
    """Strict creation for verticals."""
    return await _service.create_strict(session, name)

async def get_by_name(session: AsyncSession, name: str) -> Vertical | None:
    """Legacy lookup support."""
    norm = normalize_name(name)
    if not norm:
        return None
    cache = await prefill_vertical_cache(session, {name})
    return cache.get(norm.lower())

