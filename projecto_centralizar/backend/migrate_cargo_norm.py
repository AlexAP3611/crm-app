import asyncio
import sys
import os
import re

sys.path.append(os.getcwd())

from sqlalchemy import text, select
from app.database import engine
from app.models.cargo import Cargo

def normalize_simple(val: str) -> str:
    if not val: return ""
    val = val.lower().strip()
    val = re.sub(r'\s+', ' ', val)
    return val

async def migrate():
    async with engine.begin() as conn:
        print("Adding normalized_name column (nullable)...")
        await conn.execute(text("ALTER TABLE cargos ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(100);"))
        
    async with engine.connect() as conn:
        print("Backfilling normalized_name for existing cargos...")
        res = await conn.execute(select(Cargo.id, Cargo.name))
        cargos = res.all()
        
        for cid, cname in cargos:
            norm = normalize_simple(cname)
            await conn.execute(
                text("UPDATE cargos SET normalized_name = :norm WHERE id = :id"),
                {"norm": norm, "id": cid}
            )
        await conn.commit()

    async with engine.begin() as conn:
        print("Setting normalized_name to NOT NULL and adding unique index...")
        await conn.execute(text("ALTER TABLE cargos ALTER COLUMN normalized_name SET NOT NULL;"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_cargos_normalized_name ON cargos (normalized_name);"))
        print("Migration completed.")

if __name__ == "__main__":
    asyncio.run(migrate())
