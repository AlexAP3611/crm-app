from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sector import Sector

async def resolve_by_name(session: AsyncSession, name: str, auto_create: bool = True) -> Sector | None:
    """
    Resolve a Sector by its name (case-insensitive).
    If it doesn't exist and auto_create is True, create it.
    """
    if not name:
        return None
        
    cleaned_name = name.strip()
    
    # Case-insensitive search
    result = await session.execute(
        select(Sector).where(func.lower(Sector.name) == cleaned_name.lower())
    )
    sector = result.scalar_one_or_none()
    
    if sector:
        return sector
        
    if not auto_create:
        return None
        
    # Create new sector
    new_sector = Sector(name=cleaned_name)
    session.add(new_sector)
    await session.flush() # Ensure ID is generated
    return new_sector
