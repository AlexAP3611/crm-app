import asyncio
import sys
import os

# Add the current directory to sys.path to import app
sys.path.append(os.getcwd())

from sqlalchemy import text
from app.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Adding cargo_id column to contacts...")
        await conn.execute(text("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS cargo_id INTEGER REFERENCES cargos(id);"))
        
        print("Backfilling cargo_id from contact_cargos...")
        # Select the lowest cargo_id for each contact
        await conn.execute(text("""
            UPDATE contacts 
            SET cargo_id = (
                SELECT cargo_id 
                FROM contact_cargos 
                WHERE contact_id = contacts.id 
                ORDER BY cargo_id ASC 
                LIMIT 1
            )
            WHERE cargo_id IS NULL;
        """))
        
        print("Migration completed successfully.")

if __name__ == "__main__":
    asyncio.run(migrate())
