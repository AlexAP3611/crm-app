from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.campaign import Campaign
from app.core.exceptions import DuplicateEntityError

def normalize_name(name: str) -> str:
    """Normalize campaign name: strip whitespace and collapse internal spaces."""
    import re
    name = name.strip()
    name = re.sub(r'\s+', ' ', name)
    return name

async def get_by_name(session: AsyncSession, name: str) -> Campaign | None:
    """Case-insensitive lookup matching DB index."""
    if not name:
        return None
    normalized = normalize_name(name)
    stmt = select(Campaign).where(func.lower(Campaign.nombre) == normalized.lower())
    result = await session.execute(stmt)
    return result.scalars().first()

async def create_strict(session: AsyncSession, name: str) -> Campaign:
    """Strict creation with race condition handling."""
    if not name:
        raise ValueError("El nombre no puede estar vacío")
        
    normalized = normalize_name(name)
    if not normalized:
        raise ValueError("El nombre no puede estar vacío")
    
    # 1. Pre-emptive check
    existing = await get_by_name(session, normalized)
    if existing:
        raise DuplicateEntityError(f"La campaña '{normalized}' ya existe")
        
    # 2. Try to create
    try:
        async with session.begin_nested():
            entity = Campaign(nombre=normalized)
            session.add(entity)
            await session.flush()
        return entity
    except IntegrityError:
        # Savepoint rolled back automatically. Re-check for duplicate.
        existing = await get_by_name(session, normalized)
        if existing:
            raise DuplicateEntityError(f"La campaña '{normalized}' ya existe")
        raise

async def get_or_create(session: AsyncSession, name: str) -> Campaign | None:
    """Idempotent get or create for imports/enrichment."""
    if not name:
        return None
        
    normalized = normalize_name(name)
    
    # 1. Attempt to find
    campaign = await get_by_name(session, normalized)
    if campaign:
        return campaign
        
    # 2. Attempt to create
    try:
        return await create_strict(session, normalized)
    except DuplicateEntityError:
        # Handle the race condition where another process created it
        return await get_by_name(session, normalized)


