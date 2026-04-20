import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload

from app.models.campaign import Campaign
from app.models.contact import Contact
from app.models.empresa import Empresa
from app.schemas.contact import ContactCreate
from app.services import contact_service

DATABASE_URL = "postgresql+asyncpg://crm_user:abc123.@localhost:5432/crm_db"

async def test_campaign_flow():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        print("1. Creating a campaign...")
        campaign = Campaign(nombre="Testing Tag")
        session.add(campaign)
        await session.commit()
        await session.refresh(campaign)
        print(f"Created Campaign: {campaign.id} - {campaign.nombre}")

        print("\n2. Creating a sample Empresa and Contact...")
        empresa = Empresa(nombre="Test Corp")
        session.add(empresa)
        await session.flush()
        
        contact_data = ContactCreate(
            empresa_id=empresa.id,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            campaign_ids=[campaign.id]
        )
        
        contact, action = await contact_service.upsert_contact(session, contact_data)
        print(f"Upserted Contact: {contact.id} - {contact.first_name} (Action: {action})")
        print(f"Assigned campaigns: {[c.nombre for c in contact.campaigns]}")

        print("\n3. Verifying Filtering...")
        from app.schemas.contact import ContactFilterParams
        filters = ContactFilterParams(campaign_id=campaign.id)
        result = await contact_service.list_contacts(session, filters)
        
        print(f"Contacts filtered by campaign_id={campaign.id}: {result['total']} items")
        for item in result['items']:
            print(f" - Found: {item.first_name} {item.last_name}")

        assert result['total'] == 1
        assert result['items'][0].id == contact.id
        
        print("\n4. Verification Successful!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_campaign_flow())
