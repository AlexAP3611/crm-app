from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.product import Product

async def resolve_by_name(session: AsyncSession, name: str, auto_create: bool = True) -> Product | None:
    """
    Resolve a Product by its name (case-insensitive).
    If it doesn't exist and auto_create is True, create it.
    """
    if not name:
        return None
        
    cleaned_name = name.strip()
    
    # Case-insensitive search
    result = await session.execute(
        select(Product).where(func.lower(Product.name) == cleaned_name.lower())
    )
    product = result.scalar_one_or_none()
    
    if product:
        return product
        
    if not auto_create:
        return None
        
    # Create new product
    new_product = Product(name=cleaned_name)
    session.add(new_product)
    await session.flush() # Ensure ID is generated
    return new_product
