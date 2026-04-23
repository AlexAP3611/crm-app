import asyncio
import logging
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.contact import Contact
from app.core.resolve import normalize_linkedin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate():
    async with AsyncSessionLocal() as session:
        # Load contacts that have linkedin but haven't been normalized yet
        # or load all of them to be 100% sure the migration covers everything.
        result = await session.execute(
            select(Contact).where(Contact.linkedin.isnot(None))
        )
        contacts = result.scalars().all()
        
        updated = 0
        skipped = 0
        
        for c in contacts:
            norm = normalize_linkedin(c.linkedin)
            # Assigning this will trigger the ORM if we do updates, but since we modify it explicitly:
            # We must be careful about unique constraint violations in legacy data
            c.linkedin_normalized = norm
            
            if norm:
                updated += 1
            else:
                skipped += 1
                
        try:
            await session.commit()
            logger.info(f"Migration completed. Normalized values: {updated}, None/Empty values: {skipped}")
        except Exception as e:
            logger.error(f"Error during commit (possible duplicate linkedin): {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(migrate())
