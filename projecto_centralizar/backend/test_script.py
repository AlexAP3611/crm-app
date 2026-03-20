import asyncio
from app.database import AsyncSessionLocal
from app.services.contact_service import get_contact
from app.schemas.contact import ContactCreate
from app.services.contact_service import upsert_contact
from sqlalchemy import text

async def test():
    async with AsyncSessionLocal() as session:
        # Create a test contact with product and cargo
        data = ContactCreate(
            company='Test App Co',
            product_id=1,  # Technology / Product 1
            cargo_id=1     # CEO / Cargo 1
        )
        contact = await upsert_contact(session, data)
        print(f'Contact ID: {contact.id}')
        if contact.product_rel:
            print(f'Product Rel Name: {contact.product_rel.name}')
        else:
            print('Product Rel is NONE')
            
        from app.routers.contacts import list_contacts
        res = await list_contacts(db=session)
        print("Done")

asyncio.run(test())
