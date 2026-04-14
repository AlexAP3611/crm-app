from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.campaign import Campaign
from app.models.contact import Contact
from app.models.cargo import Cargo
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products
from app.schemas.contact import ContactCreate, ContactFilterParams, ContactUpdate
from app.services.merge import deep_merge

from app.core.field_mapping import CONTACT_FIELD_MAP, M2M_FIELD_MAP, ENRICHMENT_PROTECTED_FIELDS
from app.core.utils import normalize_company_name, update_empresa_snapshot_in_contact
from app.core.resolve import resolve_contact, normalize_email, normalize_linkedin





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
            selectinload(Contact.cargos),
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


async def upsert_contact(session: AsyncSession, data: ContactCreate) -> Contact:
    """
    Upsert logic using hierarchical identity resolution:

    1. resolve_contact identifies an existing contact (email → linkedin → fuzzy)
    2. High-confidence match (email/linkedin) → update existing contact
    3. Low-confidence match (fuzzy) → return existing WITHOUT auto-merge
    4. No match → create new contact

    Notes are always deep-merged, never replaced.
    """
    payload = data.model_dump(
        exclude={
            "notes", "campaign_ids", "cargo_ids", "merge_lists", "remove_lists",
            "created_at", "updated_at", "sectors", "verticals", "products_rel",
            "cargos", "campaigns", "cif", "web", "email_generic",
            "sector_ids", "vertical_ids", "product_ids",
        },
        exclude_unset=True,
    )

    # Resolve empresa
    emp_id = payload.get("empresa_id") or getattr(data, "empresa_id", None)
    if emp_id:
        payload["empresa_id"] = emp_id

    # Normalize identity fields before resolution
    if "email_contact" in payload and payload["email_contact"]:
        payload["email_contact"] = normalize_email(payload["email_contact"])
    if "linkedin" in payload and payload["linkedin"]:
        payload["linkedin"] = normalize_linkedin(payload["linkedin"])

    # ── Resolve identity ──────────────────────────────────────────
    resolution = await resolve_contact(
        session,
        email_contact=payload.get("email_contact"),
        linkedin=payload.get("linkedin"),
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
        empresa_id=emp_id,
    )

    contact: Contact | None = None

    if resolution.confidence == "high":
        # ── Email or LinkedIn match → update existing ─────────────
        contact = resolution.contact
        for field, value in payload.items():
            if value is None:
                continue
            # Protect email_contact: don't overwrite an existing valid email
            if field == "email_contact" and contact.email_contact:
                continue
            setattr(contact, field, value)

        # Deep-merge notes
        if data.notes:
            contact.notes = deep_merge(contact.notes, data.notes)

        # Update empresa snapshot
        if contact.empresa_rel:
            update_empresa_snapshot_in_contact(contact, contact.empresa_rel)

    elif resolution.confidence == "low" and resolution.possible_match_id:
        # ── Fuzzy match → Update existing, but ONLY non-critical fields ─────────────
        contact = await _load_contact(session, resolution.possible_match_id)
        if contact:
            for field, value in payload.items():
                if value is None:
                    continue
                # Do NOT overwrite email_contact or linkedin from a fuzzy match
                if field in ("email_contact", "linkedin"):
                    continue
                setattr(contact, field, value)

            # Deep-merge notes
            if data.notes:
                contact.notes = deep_merge(contact.notes, data.notes)

            # Update empresa snapshot
            if contact.empresa_rel:
                update_empresa_snapshot_in_contact(contact, contact.empresa_rel)

    if contact is None:
        # ── No Match (or fuzzy match ID not found) ──────────
        # Only create if it's an "active" contact (has email or linkedin)
        if not payload.get("email_contact") and not payload.get("linkedin"):
            return None  # Discard/Ignore

        contact = Contact(**payload, notes=data.notes)
        session.add(contact)
        await session.flush()
        contact = await _load_contact(session, contact.id)

        # Inject datos_empresa snapshot into notes
        if contact and contact.empresa_rel:
            update_empresa_snapshot_in_contact(contact, contact.empresa_rel)

    # Sync M2M associations (only cargo_ids and campaign_ids remain on Contact)
    for m2m_key, config in M2M_FIELD_MAP.items():
        ids_list = getattr(data, m2m_key, None)
        if ids_list is None and data.model_extra:
            ids_list = data.model_extra.get(m2m_key, None)
            
        model_class = globals()[config["model"]]
        await _sync_m2m(session, contact, model_class, ids_list, config["relation_name"], False, False)

    await session.commit()
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
        exclude={"notes", "campaign_ids", "cargo_ids", "merge_lists", "remove_lists", "created_at", "updated_at", "sectors", "verticals", "products_rel", "cargos", "campaigns", "cif", "web", "email_generic", "sector_ids", "vertical_ids", "product_ids"}, 
        exclude_unset=True
    )



    base_notes = data.notes if "notes" in data.model_fields_set else contact.notes

    for field, value in payload.items():
        setattr(contact, field, value)

    # Set notes from user input (or keep existing)
    contact.notes = base_notes

    # Inject/update datos_empresa snapshot
    final_emp_id = payload.get("empresa_id") or contact.empresa_id
    if final_emp_id:
        empresa_obj = await session.get(Empresa, final_emp_id)
        if empresa_obj:
            # Need M2M loaded for snapshot
            await session.refresh(empresa_obj, ["sectors", "verticals", "products_rel"])
            update_empresa_snapshot_in_contact(contact, empresa_obj)

    # Sync M2M if provided (only cargo_ids and campaign_ids remain on Contact)
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
            selectinload(Contact.cargos),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        )
        .where(Contact.id.in_(contact_ids))
    )
    contacts = result.scalars().all()

    payload = data.model_dump(
        exclude={"notes", "campaign_ids", "cargo_ids", "merge_lists", "remove_lists", "created_at", "updated_at", "sectors", "verticals", "products_rel", "cargos", "campaigns", "cif", "web", "email_generic", "sector_ids", "vertical_ids", "product_ids"}, 
        exclude_unset=True
    )



    is_merge = data.merge_lists
    is_remove = getattr(data, 'remove_lists', False)

    for contact in contacts:
        base_notes = data.notes if "notes" in data.model_fields_set else contact.notes
        emp_id = payload.get("empresa_id") or contact.empresa_id
        
        contact_payload = payload.copy()
        
        for field, value in contact_payload.items():
            setattr(contact, field, value)

        contact.notes = base_notes

        # Inject/update datos_empresa snapshot
        if emp_id:
            empresa_obj = await session.get(Empresa, emp_id)
            if empresa_obj:
                await session.refresh(empresa_obj, ["sectors", "verticals", "products_rel"])
                update_empresa_snapshot_in_contact(contact, empresa_obj)

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

    # 🔹 2. actualizar campos estructurados (protegiendo company/web)
    protected_redirected: dict[str, str] = {}
    for field, value in structured.items():
        if value is not None:
            current_val = getattr(contact, field, None)
            if field in ENRICHMENT_PROTECTED_FIELDS and current_val:
                protected_redirected[f"_enrichment_{field}"] = str(value)
            else:
                setattr(contact, field, value)

    # 🔹 3. guardar el resto en notes (incluyendo campos protegidos redirigidos)
    all_extra = {**extra, **protected_redirected}
    if all_extra:
        contact.notes = deep_merge(contact.notes or {}, all_extra)

    await session.commit()

    return await _load_contact(session, contact_id)

async def list_contacts(
    session: AsyncSession, filters: ContactFilterParams
) -> dict[str, Any]:
    query = select(Contact).options(
        selectinload(Contact.cargos),
        selectinload(Contact.campaigns),
        selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
        selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
        selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
    )

    if filters.empresa_id is not None:
        query = query.where(Contact.empresa_id == filters.empresa_id)

    if filters.empresa_nombre:
        query = query.where(Contact.empresa_rel.has(Empresa.nombre.ilike(f"%{filters.empresa_nombre}%")))

    if filters.contacto_nombre:
        term = f"%{filters.contacto_nombre}%"
        query = query.where(
            or_(
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term)
            )
        )

    has_empresa_filters = any(x is not None for x in [
        filters.empresa_numero_empleados_min, 
        filters.empresa_numero_empleados_max,
        filters.sector_id,
        filters.vertical_id,
        filters.product_id,
        filters.cnae
    ])
    
    if has_empresa_filters:
        query = query.join(Empresa, Contact.empresa_id == Empresa.id)
        if filters.cnae:
            query = query.where(Empresa.cnae.startswith(filters.cnae))
        if filters.empresa_numero_empleados_min is not None:
            query = query.where(Empresa.numero_empleados >= filters.empresa_numero_empleados_min)
        if filters.empresa_numero_empleados_max is not None:
            query = query.where(Empresa.numero_empleados <= filters.empresa_numero_empleados_max)

        # Sector/Vertical/Product filters route through Empresa's M2M tables
        if filters.sector_id is not None:
            query = query.join(
                empresa_sectors, Empresa.id == empresa_sectors.c.empresa_id
            ).where(empresa_sectors.c.sector_id == filters.sector_id)
        if filters.vertical_id is not None:
            query = query.join(
                empresa_verticals, Empresa.id == empresa_verticals.c.empresa_id
            ).where(empresa_verticals.c.vertical_id == filters.vertical_id)
        if filters.product_id is not None:
            query = query.join(
                empresa_products, Empresa.id == empresa_products.c.empresa_id
            ).where(empresa_products.c.product_id == filters.product_id)

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

    if filters.email:
        term = f"%{filters.email}%"
        query = query.where(
            or_(
                Contact.email_contact.ilike(term),
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
