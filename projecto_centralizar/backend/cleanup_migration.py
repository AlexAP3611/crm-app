import asyncio
import sys
import os

sys.path.append(os.getcwd())

from sqlalchemy import text
from app.database import engine

async def cleanup():
    async with engine.begin() as conn:
        print("Dropping contact_cargos table...")
        await conn.execute(text("DROP TABLE IF EXISTS contact_cargos CASCADE;"))
        print("Cleanup completed.")

if __name__ == "__main__":
    asyncio.run(cleanup())
