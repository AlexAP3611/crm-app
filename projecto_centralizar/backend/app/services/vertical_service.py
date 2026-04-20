from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.vertical import Vertical

async def resolve_by_name(session: AsyncSession, name: str, auto_create: bool = True) -> Vertical | None:
    """
    Resolve a Vertical by its name (case-insensitive).
    If it doesn't exist and auto_create is True, create it.
    """
    if not name:
        return None
        
    cleaned_name = name.strip()
    
    # 1. First attempt: Case-insensitive search
    stmt = select(Vertical).where(func.lower(Vertical.name) == cleaned_name.lower())
    result = await session.execute(stmt)
    vertical = result.scalars().first()
    
    if vertical:
        return vertical
        
    if not auto_create:
        return None
        
    # 2. Second attempt: Create new vertical using a savepoint to handle concurrency
    try:
        async with session.begin_nested():
            new_vertical = Vertical(name=cleaned_name)
            session.add(new_vertical)
            await session.flush()
            return new_vertical
    except IntegrityError:
        # Another process created it between step 1 and 2
        result = await session.execute(stmt)
        return result.scalars().first()
