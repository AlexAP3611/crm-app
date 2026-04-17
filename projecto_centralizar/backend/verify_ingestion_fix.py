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

    async with AsyncSession(engine) as session:
        # Create a mock empresa to test ingest update
        empresa = Empresa(nombre="Test Ingestion Fix Co")
        session.add(empresa)
        await session.flush()
        
        # Test 1: Valid Ingest Request
        print("\n--- TEST 1: Valid Empresa ID ---")
        body_valid = IngestRequest(
            empresas=[
                IngestEmpresaInput(
                    empresa_id=empresa.id,
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

        res_valid = await ingest_enrichment(body_valid, session)
        print("Test 1 Result:", res_valid)

        # Test 2: Invalid Empresa ID - should trigger 422
        print("\n--- TEST 2: Invalid Empresa ID ---")
        body_invalid = IngestRequest(
            empresas=[
                IngestEmpresaInput(
                    empresa_id=999999, # Definitively non-existent
                    web="https://error.es"
                )
            ]
        )
        
        try:
            res_invalid = await ingest_enrichment(body_invalid, session)
            print("Test 2 Result (Unexpected Success):", res_invalid)
        except Exception as e:
            # We expect a JSONResponse to be returned, wait, ingest_enrichment returns a JSONResponse object directly, not an Exception!
            print("Test 2 Result (Expected Error Response):", e)
        
        print(f"Ingestion result valid: {res_valid}")
        # When successful, the return is typically a Pydantic object IngestResponse
        assert res_valid.contact_created == 1, f"Expected 1 contact created, got {res_valid.contact_created}"
        assert res_valid.contact_skipped == 0, f"Expected 0 contacts skipped, got {res_valid.contact_skipped}"
        
        # Verify contact in DB
        result = await session.execute(
            select(Contact).where(Contact.email == "marcos.fix@testfix.es")
        )
        contact = result.scalar_one_or_none()
        assert contact is not None, "Contact should exist in DB"
        print(f"Contact created with ID: {contact.id}")
        print(f"Contact phone: {contact.phone}")
        assert contact.phone == "+34 600 000 000", "Phone should be correctly mapped"

        # Verify Test 2 returned a 422 JSONResponse
        print("Checking JSONResponse for Invalid ID...")
        assert res_invalid.status_code == 422
        import json
        body_content = json.loads(res_invalid.body)
        print("Body Content:", body_content)
        assert body_content["error_code"] == "EMPRESA_NOT_FOUND"

        print("\nVerification successful!")

if __name__ == "__main__":
    asyncio.run(test_ingestion_fix())
