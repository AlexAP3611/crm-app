from typing import Any
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.models.campaign import Campaign
from app.models.contact import Contact
from app.models.cargo import Cargo
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products
from app.schemas.contact import ContactCreate, ContactFilterParams, ContactUpdate
from app.services.merge import deep_merge
from app.services import cargo_service
from app.services.contact_mapper import build_contact_kwargs

from app.domain.relations import M2M_FIELD_MAP
from app.core.enrichment.rules import ENRICHMENT_PROTECTED_FIELDS
from app.core.utils import update_empresa_snapshot_in_contact
from app.core.resolve import normalize_email, normalize_linkedin, normalize_phone


async def _load_contact(session: AsyncSession, contact_id: int) -> Contact | None:
    result = await session.execute(
        select(Contact)
        .options(
            selectinload(Contact.cargo),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
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
        current_items = list(getattr(contact, relation_name, None) or [])
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
        current_items = list(getattr(contact, relation_name, None) or [])
        existing_ids = {item.id for item in current_items}
        new_items = [i for i in db_items if i.id not in existing_ids]
        setattr(contact, relation_name, current_items + new_items)
    else:
        setattr(contact, relation_name, db_items)


async def resolve_contact(session: AsyncSession, data: ContactCreate) -> Contact | None:
    """
    Implements the same resolution hierarchy as upsert_contact but without any writes.
    Deterministic Hierarchy: Email > LinkedIn > Phone.
    """
    norm_email = normalize_email(data.email) if data.email else None
    norm_linkedin = normalize_linkedin(data.linkedin) if data.linkedin else None

    # Priority 1: EMAIL
    if norm_email:
        result = await session.execute(
            select(Contact).where(func.lower(Contact.email) == norm_email)
        )
        contact = result.scalar_one_or_none()
        if contact: return contact

    # Priority 2: LINKEDIN
    if norm_linkedin:
        result = await session.execute(
            select(Contact).where(Contact.linkedin_normalized == norm_linkedin)
        )
        contact = result.scalar_one_or_none()
        if contact: return contact

    # Priority 3: PHONE
    norm_phone = normalize_phone(data.phone)
    if norm_phone:
        results = (await session.execute(
            select(Contact).where(Contact.phone == norm_phone)
        )).scalars().all()
        
        if len(results) == 1:
            return results[0]
        # Ambiguity detected -> No resolution
        
    return None


async def upsert_contact(
    session: AsyncSession,
    data: ContactCreate,
    from_enrichment: bool = False,
    auto_commit: bool = True,
) -> tuple[Contact | None, str]:
    """
    Upsert logic using hierarchical identity resolution.
    
    Architectural Rules applied:
    - job_title resolved to cargo_id via cargo_service.get_or_create_cargo
    - no raw string persistence for job_title
    - notes deep-merged
    """
    # ── 1. Resolve dependencies (cargo, normalize identity) ──
    emp_id = data.empresa_id

    norm_email = normalize_email(data.email) if data.email else None
    norm_linkedin = normalize_linkedin(data.linkedin) if data.linkedin else None

    cargo_id = data.cargo_id
    if data.job_title:
        # AUTHORITATIVE: Only cargo_service resolves titles
        cargo_obj = await cargo_service.get_or_create_cargo(session, data.job_title)
        if cargo_obj:
            cargo_id = cargo_obj.id

    # ── 2. Build ORM-safe kwargs via mapper ──
    kwargs = build_contact_kwargs(data)
    # Override with resolved/normalized values
    if emp_id:
        kwargs["empresa_id"] = emp_id
    if norm_email:
        kwargs["email"] = norm_email
    if norm_linkedin:
        kwargs["linkedin"] = norm_linkedin
    if cargo_id:
        kwargs["cargo_id"] = cargo_id

    # Centralized update logic for both Happy Path and Recovery Path
    async def apply_update(contact_obj: Contact):
        """
        Applies non-destructive updates.
        Existing valid fields are NOT overwritten by null/empty values.
        """
        for field, value in kwargs.items():
            # Skip M2M or complex fields handled separately
            if field in ["notes", "merge_lists", "remove_lists"]:
                continue
                
            new_val = value
            existing_val = getattr(contact_obj, field, None)

            # Non-destructive rule: don't overwrite existing valid data with nothing
            if new_val is None or (isinstance(new_val, str) and not new_val.strip()):
                continue

            # Skip if same value
            if existing_val == new_val:
                continue
                
            setattr(contact_obj, field, new_val)

        if data.notes:
            contact_obj.notes = deep_merge(contact_obj.notes, data.notes)

        if contact_obj.empresa_rel:
            update_empresa_snapshot_in_contact(contact_obj, contact_obj.empresa_rel)
            
        if from_enrichment:
            contact_obj.enriched = True
            contact_obj.enriched_at = datetime.now(timezone.utc)
            
        for m2m_key, config in M2M_FIELD_MAP.items():
            ids_list = getattr(data, m2m_key, None)
            if ids_list is None and data.model_extra:
                ids_list = data.model_extra.get(m2m_key, None)
                
            model_class = globals()[config["model"]]
            await _sync_m2m(session, contact_obj, model_class, ids_list, config["relation_name"], False, False)

    # ── 3. Resolve identity (Strict Hierarchy: Email > LinkedIn > Phone) ──
    contact: Contact | None = None
    action = "skipped"
    match_type = None

    # Priority 1: EMAIL
    if norm_email:
        contact = (await session.execute(
            select(Contact).where(func.lower(Contact.email) == norm_email)
        )).scalar_one_or_none()
        if contact: match_type = "email"

    # Priority 2: LINKEDIN
    if not contact and norm_linkedin:
        contact = (await session.execute(
            select(Contact).where(Contact.linkedin_normalized == norm_linkedin)
        )).scalar_one_or_none()
        if contact: match_type = "linkedin"

    # Priority 3: PHONE (Fallback only if Email/LinkedIn are missing or not matched)
    if not contact:
        norm_phone = normalize_phone(data.phone)
        if norm_phone:
            # Query-based fallback
            results = (await session.execute(
                select(Contact).where(Contact.phone == norm_phone)
            )).scalars().all()
            
            if len(results) == 1:
                contact = results[0]
                match_type = "phone"
            elif len(results) > 1:
                # Ambiguity detected -> Safe choice: Create new (handled below)
                contact = None

    if contact:
        # Load relations for update
        contact = await _load_contact(session, contact.id)
        await apply_update(contact)
        action = "updated"

        final_id = contact.id
        if auto_commit:
            await session.commit()
        else:
            await session.flush()
        return await _load_contact(session, final_id), action

    try:
        if not norm_email and not norm_linkedin and not normalize_phone(data.phone):
            return None, "skipped"

        contact = Contact(**kwargs, notes=data.notes)
        session.add(contact)
        await session.flush()
        contact = await _load_contact(session, contact.id)
        action = "created"

        if contact and contact.empresa_rel:
            update_empresa_snapshot_in_contact(contact, contact.empresa_rel)

        if from_enrichment:
            contact.enriched = True
            contact.enriched_at = datetime.now(timezone.utc)

        # Sync M2M associations
        for m2m_key, config in M2M_FIELD_MAP.items():
            ids_list = getattr(data, m2m_key, None)
            if ids_list is None and data.model_extra:
                ids_list = data.model_extra.get(m2m_key, None)
                
            model_class = globals()[config["model"]]
            await _sync_m2m(session, contact, model_class, ids_list, config["relation_name"], False, False)

        final_id = contact.id
        if auto_commit:
            await session.commit()
        else:
            await session.flush()
        return await _load_contact(session, final_id), action
        
    except IntegrityError:
        await session.rollback()
        
        # Recovery path: re-query after collision
        contact = None
        if norm_email:
            contact = (await session.execute(select(Contact).where(Contact.email == norm_email))).scalar_one_or_none()
        if not contact and norm_linkedin:
            contact = (await session.execute(select(Contact).where(Contact.linkedin_normalized == norm_linkedin))).scalar_one_or_none()
            
        if contact:
            contact = await _load_contact(session, contact.id)
            await apply_update(contact)
            if auto_commit: await session.commit()
            else: await session.flush()
            return await _load_contact(session, contact.id), "updated"
        else:
            raise


async def get_contact(session: AsyncSession, contact_id: int) -> Contact | None:
    return await _load_contact(session, contact_id)


async def update_contact(
    session: AsyncSession, contact_id: int, data: ContactUpdate
) -> Contact | None:
    contact = await _load_contact(session, contact_id)
    if contact is None:
        return None

    # ── Build ORM-safe kwargs via mapper ──
    kwargs = build_contact_kwargs(data)

    base_notes = data.notes if "notes" in data.model_fields_set else contact.notes

    # Apply only valid ORM fields to the contact
    for field, value in kwargs.items():
        setattr(contact, field, value)

    # --- AUTHORITATIVE Cargo Resolution (on Update) ---
    if data.job_title:
        cargo_obj = await cargo_service.get_or_create_cargo(session, data.job_title)
        if cargo_obj:
            contact.cargo_id = cargo_obj.id

    contact.notes = base_notes

    final_emp_id = kwargs.get("empresa_id") or contact.empresa_id
    if final_emp_id:
        empresa_obj = await session.get(Empresa, final_emp_id)
        if empresa_obj:
            await session.refresh(empresa_obj, ["sectors", "verticals", "products_rel"])
            update_empresa_snapshot_in_contact(contact, empresa_obj)

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

 


def _apply_contact_filters(query, filters: ContactFilterParams):
    """
    Private utility to apply filters to a Contact query.
    Centralizes filtering logic for both paged views and unpaginated exports.
    """
    if filters.empresa_id is not None:
        query = query.where(Contact.empresa_id == filters.empresa_id)

    if filters.contacto_nombre:
        term = f"%{filters.contacto_nombre}%"
        query = query.where(
            or_(
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term)
            )
        )

    from sqlalchemy.sql import exists

    if filters.sector_id is not None:
        query = query.where(
            exists().where(
                (empresa_sectors.c.empresa_id == Contact.empresa_id) &
                (empresa_sectors.c.sector_id == filters.sector_id)
            )
        )
    if filters.vertical_id is not None:
        query = query.where(
            exists().where(
                (empresa_verticals.c.empresa_id == Contact.empresa_id) &
                (empresa_verticals.c.vertical_id == filters.vertical_id)
            )
        )
    if filters.product_id is not None:
        query = query.where(
            exists().where(
                (empresa_products.c.empresa_id == Contact.empresa_id) &
                (empresa_products.c.product_id == filters.product_id)
            )
        )

    if filters.cargo_id is not None:
        query = query.where(Contact.cargo_id == filters.cargo_id)
    if filters.campaign_id is not None:
        from app.models.campaign import contact_campaigns as ccamp_table
        query = query.where(
            exists().where(
                (ccamp_table.c.contact_id == Contact.id) &
                (ccamp_table.c.campaign_id == filters.campaign_id)
            )
        )

    if filters.email:
        term = f"%{filters.email}%"
        query = query.where(
            or_(
                Contact.email.ilike(term),
                Contact.empresa_rel.has(Empresa.email.ilike(term))
            )
        )
        
    if filters.search:
        term = f"%{filters.search}%"
        query = query.where(
            or_(
                Contact.empresa_rel.has(Empresa.nombre.ilike(term)),
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term),
                Contact.empresa_rel.has(Empresa.email.ilike(term)),
                Contact.email.ilike(term),
            )
        )

    if filters.is_enriched is True:
        query = query.where(Contact.enriched.is_(True))
    elif filters.is_enriched is False:
        query = query.where(Contact.enriched.is_(False))
        
    return query

async def list_contacts(
    session: AsyncSession, filters: ContactFilterParams
) -> dict[str, Any]:
    query = select(Contact).options(
        selectinload(Contact.cargo),
        selectinload(Contact.campaigns),
        selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
        selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
        selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
    )

    query = _apply_contact_filters(query, filters)

    # Precise Count using DISTINCT to handle joins in search/filters
    count_stmt = select(func.count()).select_from(query.distinct(Contact.id).subquery())
    total = await session.scalar(count_stmt) or 0

    offset = (filters.page - 1) * filters.page_size
    # Order by ID DESC is already stable
    query = query.order_by(Contact.id.desc()).offset(offset).limit(filters.page_size)

    result = await session.execute(query)
    items = list(result.scalars().unique().all())

    return {
        "total": total,
        "page": filters.page,
        "page_size": filters.page_size,
        "items": items,
    }


# ── Explicit model map for bulk M2M resolution (avoids fragile globals()) ──
_BULK_MODEL_MAP = {
    "Campaign": Campaign,
}


async def bulk_update_contacts(
    session: AsyncSession, contact_ids: list[int], data: ContactUpdate
) -> int:
    """Batch update contacts by IDs. Handles scalar fields + M2M merge/remove/replace."""
    result = await session.execute(
        select(Contact)
        .options(selectinload(Contact.campaigns))
        .where(Contact.id.in_(contact_ids))
    )
    contacts = list(result.scalars().unique().all())

    is_merge = data.merge_lists
    is_remove = getattr(data, "remove_lists", False)

    # ── Scalar fields (FK updates like cargo_id) ──
    SCALAR_FIELDS = ("cargo_id",)

    for contact in contacts:
        # Apply scalar updates
        for field in SCALAR_FIELDS:
            if field in data.model_fields_set:
                setattr(contact, field, getattr(data, field))

        # Apply M2M updates (campaigns)
        for m2m_key, config in M2M_FIELD_MAP.items():
            if not hasattr(data, m2m_key):
                continue
            ids_list = getattr(data, m2m_key, None)
            if ids_list is not None:
                model_class = _BULK_MODEL_MAP[config["model"]]
                await _sync_m2m(
                    session, contact, model_class,
                    ids_list, config["relation_name"],
                    is_merge, is_remove,
                )

    await session.commit()
    return len(contacts)

