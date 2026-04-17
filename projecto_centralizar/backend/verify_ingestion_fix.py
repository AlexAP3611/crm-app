import asyncio
import sys
import os

sys.path.append(os.getcwd())

from sqlalchemy import select
from app.database import engine, AsyncSession
from app.routers.enrichment import IngestRequest, IngestEmpresaInput, IngestContactInput
from app.routers.enrichment import ingest_enrichment
from app.models.contact import Contact
from app.models.empresa import Empresa

async def test_ingestion_fix():
    print("--- Testing Ingestion Fix ---")
    
    # Mock request body matching the user's curl
    body = IngestRequest(
        empresas=[
            IngestEmpresaInput(
                empresa_id=0,
                nombre_empresa="Test Ingestion Fix Co",
                web="https://testfix.es",
                email="info@testfix.es",
                cif="B99999999",
                cnae="1234",
                numero_empleados=10,
                facturacion=100000,
                contactos=[
                    IngestContactInput(
                        first_name="Marcos",
                        last_name="Pereira",
                        email="marcos.fix@testfix.es",
                        job_title="CMO",
                        phone="+34 600 000 000"
                    )
                ]
            )
        ]
    )

    async with AsyncSession(engine) as session:
        # We need to manually handle the session because ingest_enrichment 
        # normally gets it from Depends(get_db)
        
        # We call the function directly
        # Note: We pass the session we just created
        res = await ingest_enrichment(body, session)
        
        print(f"Ingestion result: {res}")
        assert res.contact_created == 1, f"Expected 1 contact created, got {res.contact_created}"
        assert res.contact_skipped == 0, f"Expected 0 contacts skipped, got {res.contact_skipped}"
        
        # Verify contact in DB
        result = await session.execute(
            select(Contact).where(Contact.email == "marcos.fix@testfix.es")
        )
        contact = result.scalar_one_or_none()
        assert contact is not None, "Contact should exist in DB"
        print(f"Contact created with ID: {contact.id}")
        print(f"Contact phone: {contact.phone}")
        assert contact.phone == "+34 600 000 000", "Phone should be correctly mapped"

        print("\nVerification successful!")

if __name__ == "__main__":
    asyncio.run(test_ingestion_fix())
