import asyncio
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.sector import Sector
from app.models.product import Product
from app.models.vertical import Vertical

async def check_duplicates(model, label):
    async with AsyncSessionLocal() as session:
        stmt = (
            select(func.lower(model.name), func.count(model.id))
            .group_by(func.lower(model.name))
            .having(func.count(model.id) > 1)
        )
        result = await session.execute(stmt)
        dupes = result.all()
        if dupes:
            print(f"Duplicates found in {label}: {dupes}")
        else:
            print(f"No duplicates found in {label}")

async def main():
    await check_duplicates(Sector, "Sectors")
    await check_duplicates(Product, "Products")
    await check_duplicates(Vertical, "Verticals")

if __name__ == "__main__":
    asyncio.run(main())
