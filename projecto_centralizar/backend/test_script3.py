import asyncio
from app.database import AsyncSessionLocal
from app.routers.contacts import list_contacts
from app.schemas.contact import ContactFilterParams

async def run():
    async with AsyncSessionLocal() as db:
        filters = ContactFilterParams(page=1, page_size=5)
        # Using the router function to get precisely what the frontend gets
        res = await list_contacts(db=db, **filters.model_dump())
        for c in res["items"][:2]:
            print(f'Contact ID: {c.id}')
            print(f'Product Rel Name: {c.product_rel.name if getattr(c, "product_rel", None) else None}')
            print(f'Cargo Rel Name: {c.cargo.name if getattr(c, "cargo", None) else None}')
            print(f'Raw Product Rel: {getattr(c, "product_rel", "MISSING")}')
            print(f'Raw Cargo: {getattr(c, "cargo", "MISSING")}')
            
asyncio.run(run())
