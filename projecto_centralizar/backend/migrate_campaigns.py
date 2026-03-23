import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def upgrade_campaigns():
    async with AsyncSessionLocal() as session:
        try:
            # Add new columns
            await session.execute(text("ALTER TABLE campaigns ADD COLUMN type VARCHAR(100);"))
            await session.execute(text("ALTER TABLE campaigns ADD COLUMN budget NUMERIC(12, 2);"))
            await session.execute(text("ALTER TABLE campaigns ADD COLUMN goal VARCHAR(500);"))
            await session.execute(text("ALTER TABLE campaigns ADD COLUMN responsible VARCHAR(150);"))
            await session.execute(text("ALTER TABLE campaigns ADD COLUMN channel VARCHAR(100);"))
            await session.execute(text("ALTER TABLE campaigns ADD COLUMN notes TEXT;"))
        except Exception as e:
            print("Cols likely already exist", e)
        
        try:
            # Make status NOT NULL
            await session.execute(text("UPDATE campaigns SET status = 'Activa' WHERE status IS NULL;"))
            await session.execute(text("ALTER TABLE campaigns ALTER COLUMN status SET NOT NULL;"))
            
            # Make start_date NOT NULL
            await session.execute(text("UPDATE campaigns SET start_date = NOW() WHERE start_date IS NULL;"))
            await session.execute(text("ALTER TABLE campaigns ALTER COLUMN start_date SET NOT NULL;"))
        except Exception as e:
            print("Could not alter constraints", e)
            
        await session.commit()
        print("Done")
                
asyncio.run(upgrade_campaigns())
