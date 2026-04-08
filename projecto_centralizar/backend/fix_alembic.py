import asyncio
from app.database import engine
from sqlalchemy import text

async def reset():
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM alembic_version WHERE version_num = '1dc23fa160ea';"))

if __name__ == "__main__":
    asyncio.run(reset())
