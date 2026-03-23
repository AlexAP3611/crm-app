import asyncio
from app.database import AsyncSessionLocal
from app.schemas.contact import ContactCreate
from app.services.contact_service import upsert_contact
from app.routers.contacts import list_contacts
from app.schemas.contact import ContactFilterParams, ContactListResponse

async def test():
    async with AsyncSessionLocal() as session:
        # Check what the API actually returns
        filters = ContactFilterParams(page=1, page_size=5)
        res = await list_contacts(sector_id=None, vertical_id=None, campaign_id=None, product_id=None, cargo_id=None, search=None, page=1, page_size=5, db=session)
        schema = ContactListResponse.model_validate(res)
        for item in schema.items[:2]:
            print(f'Contact: {item.company}')
            print(f'Product Rel = {item.product_rel}')
            print(f'Cargo = {item.cargo}')

asyncio.run(test())
