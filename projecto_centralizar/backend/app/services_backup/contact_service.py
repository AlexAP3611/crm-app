from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.campaign import Campaign
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactFilterParams, ContactUpdate
from app.services.merge import deep_merge


async def _load_contact(session: AsyncSession, contact_id: int) -> Contact | None:
    result = await session.execute(
        select(Contact)
        .options(
            selectinload(Contact.sector),
            selectinload(Contact.vertical),
            selectinload(Contact.campaigns),
        )
        .where(Contact.id == contact_id)
    )
    return result.scalar_one_or_none()


async def upsert_contact(session: AsyncSession, data: ContactCreate) -> Contact:
    """
    Upsert logic:
    1. If cif provided → look up by cif
    2. Else if website provided → look up by website
    3. If no match → create new contact
    Notes are always deep-merged, never replaced.
    """
    contact: Contact | None = None

    if data.cif:
        result = await session.execute(
            select(Contact)
            .options(
                selectinload(Contact.sector),
                selectinload(Contact.vertical),
                selectinload(Contact.campaigns),
            )
            .where(Contact.cif == data.cif)
        )
        contact = result.scalar_one_or_none()

    if contact is None and data.website:
        result = await session.execute(
            select(Contact)
            .options(
                selectinload(Contact.sector),
                selectinload(Contact.vertical),
                selectinload(Contact.campaigns),
            )
            .where(Contact.website == data.website)
        )
        contact = result.scalar_one_or_none()

    payload = data.model_dump(exclude={"notes", "campaign_ids"}, exclude_unset=True)

    if contact is None:
        # Create
        contact = Contact(**payload, notes=data.notes)
        session.add(contact)
        await session.flush()
    else:
        # Update — completely replace notes
        for field, value in payload.items():
            setattr(contact, field, value)
        
        if "notes" in data.model_fields_set:
            contact.notes = data.notes

    # Sync campaigns
    if data.campaign_ids:
        campaigns_result = await session.execute(
            select(Campaign).where(Campaign.id.in_(data.campaign_ids))
        )
        contact.campaigns = list(campaigns_result.scalars().all())

    await session.commit()
    await session.refresh(contact)
    return await _load_contact(session, contact.id)  # type: ignore[return-value]


async def get_contact(session: AsyncSession, contact_id: int) -> Contact | None:
    return await _load_contact(session, contact_id)


async def update_contact(
    session: AsyncSession, contact_id: int, data: ContactUpdate
) -> Contact | None:
    contact = await _load_contact(session, contact_id)
    if contact is None:
        return None

    payload = data.model_dump(exclude={"notes", "campaign_ids"}, exclude_unset=True)
    for field, value in payload.items():
        setattr(contact, field, value)

    # Completely replace notes
    if "notes" in data.model_fields_set:
        contact.notes = data.notes

    # Sync campaigns if provided
    if data.campaign_ids is not None:
        campaigns_result = await session.execute(
            select(Campaign).where(Campaign.id.in_(data.campaign_ids))
        )
        contact.campaigns = list(campaigns_result.scalars().all())

    await session.commit()
    return await _load_contact(session, contact_id)


async def delete_contact(session: AsyncSession, contact_id: int) -> bool:
    contact = await session.get(Contact, contact_id)
    if contact is None:
        return False
    await session.delete(contact)
    await session.commit()
    return True


async def delete_contacts_bulk(session: AsyncSession, contact_ids: list[int]) -> int:
    result = await session.execute(select(Contact).where(Contact.id.in_(contact_ids)))
    contacts = result.scalars().all()
    count = 0
    for c in contacts:
        await session.delete(c)
        count += 1
    await session.commit()
    return count
    
async def enrich_contact(
    session: AsyncSession,
    contact_id: int,
    enrichment_data: dict
) -> Contact | None:

    contact = await _load_contact(session, contact_id)

    if contact is None:
        return None

    # Merge enrichment data into notes
    if contact.notes is None:
        contact.notes = enrichment_data
    else:
        contact.notes = deep_merge(contact.notes, enrichment_data)

    await session.commit()
    await session.refresh(contact)

    return await _load_contact(session, contact_id)


async def list_contacts(
    session: AsyncSession, filters: ContactFilterParams
) -> dict[str, Any]:
    query = select(Contact).options(
        selectinload(Contact.sector),
        selectinload(Contact.vertical),
        selectinload(Contact.campaigns),
    )

    if filters.sector_id is not None:
        query = query.where(Contact.sector_id == filters.sector_id)
    if filters.vertical_id is not None:
        query = query.where(Contact.vertical_id == filters.vertical_id)
    if filters.product:
        query = query.where(Contact.product.ilike(f"%{filters.product}%"))
    if filters.campaign_id is not None:
        from app.models.campaign import contact_campaigns as cc_table
        query = query.join(cc_table, Contact.id == cc_table.c.contact_id).where(
            cc_table.c.campaign_id == filters.campaign_id
        )
    if filters.search:
        term = f"%{filters.search}%"
        query = query.where(
            or_(
                Contact.company.ilike(term),
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term),
                Contact.email_generic.ilike(term),
                Contact.email_contact.ilike(term),
            )
        )

    # Total count
    count_result = await session.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    # Pagination
    offset = (filters.page - 1) * filters.page_size
    query = query.order_by(Contact.id.desc()).offset(offset).limit(filters.page_size)

    result = await session.execute(query)
    items = list(result.scalars().unique().all())

    return {
        "total": total,
        "page": filters.page,
        "page_size": filters.page_size,
        "items": items,
    }
