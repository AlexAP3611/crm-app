import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine('postgresql+asyncpg://crm_user:crm_password@localhost/crm_db')
    async with engine.connect() as conn:
        print("--- COLUMNS ---")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts';"))
        for row in res:
            print(row[0])
        print("--- CONSTRAINTS ---")
        res = await conn.execute(text("SELECT conname FROM pg_constraint WHERE conrelid = 'contacts'::regclass;"))
        for row in res:
            print(row[0])

asyncio.run(main())
