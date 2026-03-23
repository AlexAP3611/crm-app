from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.campaign import Campaign
from app.models.contact import Contact
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.models.cargo import Cargo
from app.models.product import Product
from app.schemas.contact import ContactCreate, ContactFilterParams, ContactUpdate
from app.services.merge import deep_merge

from app.core.field_mapping import CONTACT_FIELD_MAP, M2M_FIELD_MAP

def split_enrichment_data(data: dict):
    structured = {}
    extra = {}

    for key, value in data.items():
        if key in CONTACT_FIELD_MAP.values():
            structured[key] = value
        else:
            extra[key] = value

    return structured, extra
#

async def _load_contact(session: AsyncSession, contact_id: int) -> Contact | None:
    result = await session.execute(
        select(Contact)
        .options(
            selectinload(Contact.sectors),
            selectinload(Contact.verticals),
            selectinload(Contact.products_rel),
            selectinload(Contact.cargos),
            selectinload(Contact.campaigns),
        )
        .where(Contact.id == contact_id)
    )
    return result.scalar_one_or_none()

async def _sync_m2m(session: AsyncSession, contact: Contact, ModelClass, ids_list: list[int], relation_name: str, merge_lists: bool = False, remove_lists: bool = False):
    """Generic helper to sync Many-to-Many lists."""
    if ids_list is None:
        return

    if remove_lists:
        if not ids_list:
            return  # Nothing to remove
        current_items = getattr(contact, relation_name)
        ids_to_remove = set(ids_list)
        new_items = [i for i in current_items if i.id not in ids_to_remove]
        setattr(contact, relation_name, new_items)
        return

    if not ids_list:
        if not merge_lists:
            setattr(contact, relation_name, [])
        return
        
    result = await session.execute(select(ModelClass).where(ModelClass.id.in_(ids_list)))
    db_items = list(result.scalars().all())

    if merge_lists:
        current_items = getattr(contact, relation_name)
        existing_ids = {item.id for item in current_items}
        new_items = [i for i in db_items if i.id not in existing_ids]
        current_items.extend(new_items)
    else:
        setattr(contact, relation_name, db_items)


async def upsert_contact(session: AsyncSession, data: ContactCreate) -> Contact:
    """
    Upsert logic:
    1. If cif provided → look up by cif
    2. Else if dominio provided → look up by dominio
    3. If no match → create new contact
    Notes are always deep-merged, never replaced.
    """
    contact: Contact | None = None

    if data.cif:
        result = await session.execute(
            select(Contact)
            .options(
                selectinload(Contact.sectors),
                selectinload(Contact.verticals),
                selectinload(Contact.campaigns),
                selectinload(Contact.cargos),
                selectinload(Contact.products_rel),
            )
            .where(Contact.cif == data.cif)
        )
        contact = result.scalar_one_or_none()

    if contact is None and data.dominio:
        result = await session.execute(
            select(Contact)
            .options(
                selectinload(Contact.sectors),
                selectinload(Contact.verticals),
                selectinload(Contact.campaigns),
                selectinload(Contact.cargos),
                selectinload(Contact.products_rel),
            )
            .where(Contact.dominio == data.dominio)
        )
        contact = result.scalar_one_or_none()

    payload = data.model_dump(exclude={"notes", "campaign_ids", "sector_ids", "vertical_ids", "cargo_ids", "product_ids", "merge_lists", "remove_lists"}, exclude_unset=True)

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

    # Sync M2M associations
    extra_fields = payload.keys() | data.model_extra.keys() if data.model_extra else payload.keys()
    
    for m2m_key, config in M2M_FIELD_MAP.items():
        ids_list = getattr(data, m2m_key, None)
        if ids_list is None and data.model_extra:
            ids_list = data.model_extra.get(m2m_key, None)
            
        model_class = globals()[config["model"]]
        await _sync_m2m(session, contact, model_class, ids_list, config["relation_name"], False, False)

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

    payload = data.model_dump(
        exclude={"notes", "campaign_ids", "sector_ids", "vertical_ids", "cargo_ids", "product_ids", "merge_lists", "remove_lists", "created_at", "updated"}, 
        exclude_unset=True
    )
    for field, value in payload.items():
        setattr(contact, field, value)

    # Completely replace notes
    if "notes" in data.model_fields_set:
        contact.notes = data.notes

    # Sync M2M if provided
    is_merge = data.merge_lists
    is_remove = getattr(data, 'remove_lists', False)
    
    for m2m_key, config in M2M_FIELD_MAP.items():
        ids_list = getattr(data, m2m_key, None)
        if ids_list is None and data.model_extra:
            ids_list = data.model_extra.get(m2m_key, None)
            
        if ids_list is not None:
            model_class = globals()[config["model"]]
            await _sync_m2m(session, contact, model_class, ids_list, config["relation_name"], is_merge, is_remove)

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


async def bulk_update_contacts(
    session: AsyncSession, contact_ids: list[int], data: ContactUpdate
) -> int:
    """Update multiple contacts by ID list with the same data."""
    result = await session.execute(
        select(Contact)
        .options(
            selectinload(Contact.sectors),
            selectinload(Contact.verticals),
            selectinload(Contact.products_rel),
            selectinload(Contact.cargos),
            selectinload(Contact.campaigns),
        )
        .where(Contact.id.in_(contact_ids))
    )
    contacts = result.scalars().all()

    payload = data.model_dump(
        exclude={"notes", "campaign_ids", "sector_ids", "vertical_ids", "cargo_ids", "product_ids", "merge_lists", "remove_lists"}, 
        exclude_unset=True
    )

    is_merge = data.merge_lists
    is_remove = getattr(data, 'remove_lists', False)

    for contact in contacts:
        for field, value in payload.items():
            setattr(contact, field, value)

        if "notes" in data.model_fields_set:
            contact.notes = data.notes

        for m2m_key, config in M2M_FIELD_MAP.items():
            ids_list = getattr(data, m2m_key, None)
            if ids_list is None and data.model_extra:
                ids_list = data.model_extra.get(m2m_key, None)
                
            if ids_list is not None:
                model_class = globals()[config["model"]]
                await _sync_m2m(session, contact, model_class, ids_list, config["relation_name"], is_merge, is_remove)

    await session.commit()
    return len(contacts)
    
async def enrich_contact(
    session: AsyncSession,
    contact_id: int,
    enrichment_data: dict
) -> Contact | None:

    contact = await _load_contact(session, contact_id)

    if contact is None:
        return None

    # 🔹 1. separar datos
    structured, extra = split_enrichment_data(enrichment_data)

    # 🔹 2. actualizar campos estructurados
    for field, value in structured.items():
        if value is not None:
            setattr(contact, field, value)

    # 🔹 3. guardar el resto en notes 
    if extra:
        contact.notes = deep_merge(contact.notes, extra)

    await session.commit()
    await session.refresh(contact)

    #return await _load_contact(session, contact_id)
    return contact

async def list_contacts(
    session: AsyncSession, filters: ContactFilterParams
) -> dict[str, Any]:
    query = select(Contact).options(
        selectinload(Contact.sectors),
        selectinload(Contact.verticals),
        selectinload(Contact.products_rel),
        selectinload(Contact.cargos),
        selectinload(Contact.campaigns),
    )

    if filters.sector_id is not None:
        from app.models.contact import contact_sectors as cs_table
        query = query.join(cs_table, Contact.id == cs_table.c.contact_id).where(
            cs_table.c.sector_id == filters.sector_id
        )
    if filters.vertical_id is not None:
        from app.models.contact import contact_verticals as cv_table
        query = query.join(cv_table, Contact.id == cv_table.c.contact_id).where(
            cv_table.c.vertical_id == filters.vertical_id
        )
    if filters.product_id is not None:
        from app.models.contact import contact_products as cp_table
        query = query.join(cp_table, Contact.id == cp_table.c.contact_id).where(
            cp_table.c.product_id == filters.product_id
        )
    if filters.cargo_id is not None:
        from app.models.contact import contact_cargos as ccargo_table
        query = query.join(ccargo_table, Contact.id == ccargo_table.c.contact_id).where(
            ccargo_table.c.cargo_id == filters.cargo_id
        )
    if filters.campaign_id is not None:
        from app.models.campaign import contact_campaigns as ccamp_table
        query = query.join(ccamp_table, Contact.id == ccamp_table.c.contact_id).where(
            ccamp_table.c.campaign_id == filters.campaign_id
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

    # Total count (using a count over the filtered subquery without stripping options from main query)
    count_query = select(func.count()).select_from(query.with_only_columns(Contact.id).subquery())
    count_result = await session.execute(count_query)
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
