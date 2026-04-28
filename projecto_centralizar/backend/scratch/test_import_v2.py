import asyncio
import logging
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.services.import_service import import_contacts_from_rows
from app.models.contact import Contact
from app.models.empresa import Empresa

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_import_logic():
    async with AsyncSessionLocal() as session:
        # Use unique name for test run
        import time
        ts = int(time.time())
        emp_name = f"Test Corp {ts}"
        
        # 2. Setup initial state
        test_empresa = Empresa(nombre=emp_name, web="testcorp.com")
        session.add(test_empresa)
        await session.flush()
        
        test_contact = Contact(
            first_name="Original",
            last_name="Contact",
            email=f"original_{ts}@example.com",
            phone=f"900{ts}",
            linkedin=f"linkedin.com/in/original_{ts}",
            linkedin_normalized=f"linkedin.com/in/original_{ts}",
            empresa_id=test_empresa.id
        )
        session.add(test_contact)
        await session.flush()
        
        rows = [
            # Row 1: No identifiers -> Should be skipped
            {"first_name": "NoID", "empresa": emp_name},
            
            # Row 2: Unresolvable Empresa -> Should be skipped (blocked name)
            {"email": f"no_empresa_{ts}@example.com", "empresa": "-"},
            
            # Row 3: Valid Email Match -> Should update
            {"email": f"original_{ts}@example.com", "first_name": "Updated", "empresa": emp_name},
            
            # Row 4: LinkedIn Match with variations -> Should update
            {"linkedin": f"https://www.linkedin.com/in/original_{ts}/", "last_name": "LinkedUpdated", "empresa": emp_name},
            
            # Row 5: Phone Match (Last resort) -> Should update
            {"phone": f"900-{ts}", "first_name": "PhoneUpdated", "empresa": emp_name},
            
            # Row 6: Non-destructive check (empty phone shouldn't clear existing)
            {"email": f"original_{ts}@example.com", "phone": "", "empresa": emp_name},
            
            # Row 7: New contact
            {"email": f"new_{ts}@example.com", "first_name": "New", "empresa": emp_name},
        ]
        
        logger.info("Starting import...")
        results = await import_contacts_from_rows(session, rows)
        logger.info(f"Import results: {results}")
        
        # Verify Row 1 & 2 skipped
        assert results["skipped"] >= 2
        
        # Verify Row 3, 4, 5, 7
        # Row 3 updates "original@example.com"
        # Row 4 updates same contact via LinkedIn
        # Row 5 updates same contact via Phone
        # Row 6 updates same contact (non-destructive)
        # Row 7 creates new
        
        await session.commit()
        
        # Re-fetch and check values
        async with AsyncSessionLocal() as session2:
            contact = (await session2.execute(
                select(Contact).where(Contact.email == f"original_{ts}@example.com")
            )).scalar_one()
            
            logger.info(f"Updated contact: {contact.first_name} {contact.last_name}, phone={contact.phone}")
            assert contact.first_name == "PhoneUpdated" # Last update wins
            assert contact.last_name == "LinkedUpdated"
            # Row 5 updated it to 900-ts. Row 6 had phone="", which should NOT have cleared it.
            assert contact.phone == f"900-{ts}" 
            
            new_contact = (await session2.execute(
                select(Contact).where(Contact.email == f"new_{ts}@example.com")
            )).scalar_one_or_none()
            assert new_contact is not None
            logger.info("New contact verified.")

if __name__ == "__main__":
    asyncio.run(test_import_logic())
