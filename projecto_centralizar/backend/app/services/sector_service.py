from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.sector import Sector

async def resolve_by_name(session: AsyncSession, name: str, auto_create: bool = True) -> Sector | None:
    """
    Resolve a Sector by its name (case-insensitive).
    If it doesn't exist and auto_create is True, create it.
    """
    if not name:
        return None
        
    cleaned_name = name.strip()
    
    # 1. First attempt: Case-insensitive search
    stmt = select(Sector).where(func.lower(Sector.name) == cleaned_name.lower())
    result = await session.execute(stmt)
    sector = result.scalars().first()
    
    if sector:
        return sector
        
    if not auto_create:
        return None
        
    # 2. Second attempt: Create new sector using a savepoint to handle concurrency
    try:
        async with session.begin_nested():
            new_sector = Sector(name=cleaned_name)
            session.add(new_sector)
            await session.flush()
            return new_sector
    except IntegrityError:
        # Another process created it between step 1 and 2
        result = await session.execute(stmt)
        return result.scalars().first()
