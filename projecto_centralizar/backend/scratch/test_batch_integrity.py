import asyncio
import logging
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.services.import_service import import_contacts_from_rows
from app.models.contact import Contact
from app.models.empresa import Empresa
from app.schemas.import_schema import ImportSummary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_batch_and_preview():
    async with AsyncSessionLocal() as session:
        import time
        ts = int(time.time())
        emp_name = f"BatchTest Corp {ts}"
        
        # Setup initial state
        emp = Empresa(nombre=emp_name, web=f"batch{ts}.com")
        session.add(emp)
        await session.flush()
        await session.commit()
        
        rows = [
            {"first_name": "P1", "last_name": "T1", "email": f"p1_{ts}@test.com", "empresa": emp_name},
            {"first_name": "P2", "last_name": "T2", "email": f"p2_{ts}@test.com", "empresa": emp_name},
            {"first_name": "Skip", "empresa": emp_name}, # No email, phone, or linkedin
        ]
        
        # 1. Test Preview Mode
        logger.info("Running PREVIEW mode...")
        # Re-open session to be clean
        async with AsyncSessionLocal() as preview_session:
            summary = await import_contacts_from_rows(preview_session, rows, mode="preview")
            assert isinstance(summary, ImportSummary)
            logger.info(f"Preview Summary: {summary}")
            assert summary.to_create == 2
            assert summary.skipped == 1
            
            # Verify ZERO persistence
            count = (await preview_session.execute(select(func.count(Contact.id)).where(Contact.email.like(f"%_{ts}@test.com")))).scalar()
            assert count == 0
            logger.info("Preview safety verified: 0 contacts persisted.")

        # 2. Test Commit Mode
        logger.info("Running COMMIT mode...")
        async with AsyncSessionLocal() as commit_session:
            result = await import_contacts_from_rows(commit_session, rows, mode="commit")
            logger.info(f"Commit Result: {result}")
            assert result["created"] == 2
            assert result["skipped"] == 1
            
            # Verify persistence
            count = (await commit_session.execute(select(func.count(Contact.id)).where(Contact.email.like(f"%_{ts}@test.com")))).scalar()
            assert count == 2
            logger.info("Commit persistence verified: 2 contacts created.")

if __name__ == "__main__":
    asyncio.run(verify_batch_and_preview())
