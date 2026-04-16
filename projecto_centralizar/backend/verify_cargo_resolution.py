import asyncio
import sys
import os

sys.path.append(os.getcwd())

from sqlalchemy import select
from app.database import engine, AsyncSession
from app.services import contact_service, cargo_service
from app.schemas.contact import ContactCreate
from app.models.contact import Contact
from app.models.cargo import Cargo

async def test_resolution():
    async with AsyncSession(engine) as session:
        print("--- Testing Cargo Service Directly ---")
        c1 = await cargo_service.resolve_cargo(session, "CMO")
        print(f"CMO resolved to: {c1.name} (normalized: {c1.normalized_name})")
        
        c2 = await cargo_service.resolve_cargo(session, "chief marketing officer")
        print(f"'chief marketing officer' resolved to: {c2.name} (ID: {c2.id})")
        assert c1.id == c2.id, "Should resolve to same Cargo entity"
        
        c3 = await cargo_service.resolve_cargo(session, "  Chief   Marketing   Officer  ")
        print(f"Messy string resolved to ID: {c3.id}")
        assert c1.id == c3.id, "Should handle whitespace and casing"

        print("\n--- Testing Contact Integration ---")
        # Need an empresa for contact creation
        from app.models.empresa import Empresa
        res = await session.execute(select(Empresa).limit(1))
        empresa = res.scalar_one_or_none()
        if not empresa:
            empresa = Empresa(nombre="Test Co")
            session.add(empresa)
            await session.flush()

        data = ContactCreate(
            first_name="Test",
            last_name="Resolution",
            email_contact="test_res@example.com",
            empresa_id=empresa.id,
            job_title="CTO"
        )
        contact = await contact_service.upsert_contact(session, data)
        print(f"Contact created with job_title='CTO'. Resolved cargo_id: {contact.cargo_id}")
        
        # Load cargo to check
        res_cargo = await session.get(Cargo, contact.cargo_id)
        print(f"Resolved Cargo name: {res_cargo.name}, normalized: {res_cargo.normalized_name}")
        assert res_cargo.normalized_name == "chief technology officer"

        print("\nVerification successful!")

if __name__ == "__main__":
    asyncio.run(test_resolution())
