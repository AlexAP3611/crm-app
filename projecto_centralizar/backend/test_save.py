import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models.setting import Setting
from sqlalchemy import select

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession)
    
    async with async_session() as session:
        result = await session.execute(select(Setting))
        for row in result.scalars():
            print(f"Key: {row.key}, Value: {row.value}, Type: {type(row.value)}")

asyncio.run(main())
