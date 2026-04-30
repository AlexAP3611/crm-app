from sqlalchemy.ext.asyncio import AsyncSession
from app.models.product import Product
from app.services.m2m_base_service import M2MEntityService

# Initialize the generic service for Product
_service = M2MEntityService(Product)

def normalize_name(name: str) -> str | None:
    """Synchronous normalization."""
    return _service.normalize_name(name)

async def prefill_product_cache(session: AsyncSession, names: set[str]) -> dict[str, Product]:
    """Batch-fetch existing products."""
    return await _service.prefill_cache(session, names)

async def get_or_create(session: AsyncSession, name: str, cache: dict[str, Product] | None = None) -> Product | None:
    """Idempotent get-or-create for products."""
    return await _service.get_or_create(session, name, cache=cache)

async def create_strict(session: AsyncSession, name: str) -> Product:
    """Strict creation for products."""
    return await _service.create_strict(session, name)

async def get_by_name(session: AsyncSession, name: str) -> Product | None:
    """Legacy lookup support."""
    norm = normalize_name(name)
    if not norm:
        return None
    cache = await prefill_product_cache(session, {name})
    return cache.get(norm.lower())

