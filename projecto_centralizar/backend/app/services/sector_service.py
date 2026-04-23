from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.sector import Sector
from app.core.exceptions import DuplicateEntityError

def normalize_name(name: str) -> str:
    """Synchronous normalization."""
    return name.strip()

async def get_by_name(session: AsyncSession, name: str) -> Sector | None:
    """Case-insensitive lookup matching DB index."""
    if not name:
        return None
    normalized = normalize_name(name)
    stmt = select(Sector).where(func.lower(Sector.name) == normalized.lower())
    result = await session.execute(stmt)
    return result.scalars().first()

async def create_strict(session: AsyncSession, name: str) -> Sector:
    """Strict creation with race condition handling."""
    if not name:
        raise ValueError("El nombre no puede estar vacío")
        
    normalized = normalize_name(name)
    if not normalized:
        raise ValueError("El nombre no puede estar vacío")
    
    # 1. Pre-emptive check
    existing = await get_by_name(session, normalized)
    if existing:
        raise DuplicateEntityError(f"El sector '{normalized}' ya existe")
        
    # 2. Try to create
    try:
        async with session.begin_nested():
            entity = Sector(name=normalized)
            session.add(entity)
            await session.flush()
        return entity
    except IntegrityError:
        existing = await get_by_name(session, normalized)
        if existing:
            raise DuplicateEntityError(f"El sector '{normalized}' ya existe")
        raise


async def get_or_create(session: AsyncSession, name: str) -> Sector | None:
    """Idempotent get or create for imports/enrichment."""
    if not name:
        return None
        
    normalized = normalize_name(name)
    
    # 1. Attempt to find
    sector = await get_by_name(session, normalized)
    if sector:
        return sector
        
    # 2. Attempt to create
    try:
        return await create_strict(session, normalized)
    except DuplicateEntityError:
        return await get_by_name(session, normalized)


