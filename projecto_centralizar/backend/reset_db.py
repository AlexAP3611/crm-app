import asyncio
from sqlalchemy import text
from app.database import engine

async def reset_db():
    async with engine.connect() as conn:
        print("Dropping all tables...")
        # Get all tables in public schema
        result = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        ))
        tables = [row[0] for row in result.fetchall()]
        
        if tables:
            # Drop tables with CASCADE to handle foreign keys
            tables_str = ", ".join(f'"{t}"' for t in tables)
            await conn.execute(text(f"DROP TABLE {tables_str} CASCADE"))
            print(f"Dropped tables: {tables_str}")
        else:
            print("No tables found to drop.")
            
        # Drop alembic_version table specifically if it wasn't in public or just to be sure
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
        
        await conn.commit()
    print("Database reset complete.")

if __name__ == "__main__":
    asyncio.run(reset_db())
