import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath(os.curdir))

from app.database import AsyncSessionLocal
from app.services import cargo_service
from app.models.cargo import Cargo
from sqlalchemy import select, delete

async def verify_cargo_logic():
    async with AsyncSessionLocal() as db:
        # 1. Sequential Creation
        print("\nTesting Sequential Creation...")
        test_title = "Architect-Specialist-Test"
        c1 = await cargo_service.get_or_create_cargo(db, test_title)
        print(f"Created/Fetched: {c1.name} (ID: {c1.id})")
        
        c2 = await cargo_service.get_or_create_cargo(db, test_title.lower())
        print(f"Fetched again: {c2.name} (ID: {c2.id})")
        assert c1.id == c2.id, "Sequential lookup failed to return same ID"

        # 3. Cache performance
        print("\nTesting Cache usage...")
        cache = {}
        c3 = await cargo_service.get_or_create_cargo(db, "CEO", cache=cache)
        assert "chief executive officer" in cache, "Cache not populated"
        print(f"Cache populated: {list(cache.keys())}")

        # 4. Prefill cache
        print("\nTesting Prefill cache...")
        titles = {"Chief Marketing Officer", "VP of Sales"}
        prefilled = await cargo_service.prefill_cargo_cache(db, titles)
        print(f"Prefilled cache keys: {list(prefilled.keys())}")

        print("\nVerification successful!")

if __name__ == "__main__":
    asyncio.run(verify_cargo_logic())
