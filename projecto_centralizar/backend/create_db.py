import asyncio
import asyncpg
import sys

async def main():
    try:
        conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/postgres")
        await conn.execute("CREATE DATABASE crm;")
        print("Database crm created")
        await conn.close()
    except asyncpg.exceptions.DuplicateDatabaseError:
        print("Database crm already exists")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
