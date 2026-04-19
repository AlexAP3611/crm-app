from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.vertical import Vertical

async def resolve_by_name(session: AsyncSession, name: str, auto_create: bool = True) -> Vertical | None:
    """
    Resolve a Vertical by its name (case-insensitive).
    If it doesn't exist and auto_create is True, create it.
    """
    if not name:
        return None
        
    cleaned_name = name.strip()
    
    # Case-insensitive search
    result = await session.execute(
        select(Vertical).where(func.lower(Vertical.name) == cleaned_name.lower())
    )
    vertical = result.scalar_one_or_none()
    
    if vertical:
        return vertical
        
    if not auto_create:
        return None
        
    # Create new vertical
    new_vertical = Vertical(name=cleaned_name)
    session.add(new_vertical)
    await session.flush() # Ensure ID is generated
    return new_vertical
