from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.campaign import Campaign

async def resolve_by_name(session: AsyncSession, name: str, auto_create: bool = True) -> Campaign | None:
    """
    Resolve a Campaign by its name (case-insensitive).
    If it doesn't exist and auto_create is True, create it.
    """
    if not name:
        return None
        
    cleaned_name = name.strip()
    
    # 1. First attempt: Case-insensitive search
    stmt = select(Campaign).where(func.lower(Campaign.nombre) == cleaned_name.lower())
    result = await session.execute(stmt)
    campaign = result.scalars().first()
    
    if campaign:
        return campaign
        
    if not auto_create:
        return None
        
    # 2. Second attempt: Create new campaign using a savepoint to handle concurrency
    try:
        async with session.begin_nested():
            new_campaign = Campaign(nombre=cleaned_name)
            session.add(new_campaign)
            await session.flush()
            return new_campaign
    except IntegrityError:
        # Another process created it between step 1 and 2
        result = await session.execute(stmt)
        return result.scalars().first()
