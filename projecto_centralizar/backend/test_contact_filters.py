import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.services.contact_service import list_contacts
from app.schemas.contact import ContactFilterParams

async def test():
    async with AsyncSessionLocal() as db:
        filters = ContactFilterParams(
            sector_id=1,
            vertical_id=1,
            product_id=1,
            cargo_id=1,
            campaign_id=1,
            search='test',
            empresa_nombre='test_company',
            empresa_numero_empleados_min=10,
            page=1,
            page_size=50
        )
        try:
            res = await list_contacts(db, filters)
            print("SUCCESS! Returned:", res["total"])
        except Exception as e:
            import traceback
            traceback.print_exc()

asyncio.run(test())
