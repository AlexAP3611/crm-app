import asyncio
import sys
import os
sys.path.append(os.getcwd())
try:
    from app.database import engine
except Exception as e:
    print(f"Failed to import base engine: {e}")
    sys.exit(1)

from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT conname FROM pg_constraint WHERE conrelid = 'contacts'::regclass;"))
        print("Constraints on contacts:")
        for row in res:
            print(row[0])
            
        print("Columns on contacts:")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts';"))
        for row in res:
            print(row[0])

if __name__ == "__main__":
    asyncio.run(main())
