import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.services.import_service import import_empresas_from_rows
import os

DATABASE_URL = "postgresql+asyncpg://crm_user:abc123.@localhost:5432/crm_db"

async def test_import():
    engine = create_async_engine(DATABASE_URL)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with SessionLocal() as session:
        rows = [
            {
                "nombre": "Empresa Fix Test", 
                "web": "fix.com", 
                "facebook": "NaN",  # Should be cleaned to None
                "extra_field_garbage": "should be ignored",
                "facturacion": "" # Should be cleaned to None
            }
        ]
        try:
            result = await import_empresas_from_rows(session, rows, mode="preview")
            print("Import Preview Success:")
            print(result)
        except Exception as e:
            print(f"Import Failed with error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_import())
