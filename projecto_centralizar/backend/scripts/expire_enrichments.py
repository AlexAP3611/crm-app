"""
Standalone script for cron execution.
Usage: python scripts/expire_enrichments.py
Crontab: */15 * * * * cd /path/to/backend && venv/bin/python scripts/expire_enrichments.py
"""
import asyncio
import sys
sys.path.insert(0, ".")

from app.database import AsyncSessionLocal
from app.services.expire_stale_enrichments import expire_stale_runs


async def main():
    async with AsyncSessionLocal() as db:
        result = await expire_stale_runs(db)
        print(f"Result: {result}")


if __name__ == "__main__":
    asyncio.run(main())
