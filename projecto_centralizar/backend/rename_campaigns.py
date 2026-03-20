import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def upgrade_campaigns():
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN name TO nombre;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN type TO tipo;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN status TO estado;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN start_date TO fecha_inicio;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN end_date TO fecha_fin;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN budget TO presupuesto;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN goal TO objetivo;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN responsible TO responsable;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN channel TO canal;"))
            await session.execute(text("ALTER TABLE campaigns RENAME COLUMN notes TO notas;"))
            await session.commit()
            print("Renamed columns successfully")
        except Exception as e:
            await session.rollback()
            print("Error or already renamed:", e)
                
asyncio.run(upgrade_campaigns())
