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
from app.services import cargo_service, empresa_service
from app.services.contact_mapper import build_contact_kwargs

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


async def upsert_contact(
    session: AsyncSession,
    data: ContactCreate,
    from_enrichment: bool = False,
    strict_identity: bool = False,
    auto_commit: bool = True,
) -> tuple[Contact | None, str]:
    """
    Upsert logic using hierarchical identity resolution.

    Returns (contact, action) where action is "created", "updated", or "skipped".

    1. resolve_contact identifies an existing contact (email → linkedin → fuzzy)
    2. High-confidence match (email/linkedin) → update existing contact
    3. Low-confidence match (fuzzy) → update non-critical fields only
    4. No match → create new contact

    Notes are always deep-merged, never replaced.
    """
    # ── 1. Resolve dependencies (cargo, normalize identity) ──
    emp_id = data.empresa_id

    norm_email = normalize_email(data.email) if data.email else None
    norm_linkedin = normalize_linkedin(data.linkedin) if data.linkedin else None

    cargo_id = data.cargo_id
    job_title = data.job_title
    if job_title:
        resolved_cargo = await cargo_service.resolve_cargo(session, job_title)
        if resolved_cargo:
            cargo_id = resolved_cargo.id

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

    # ── 3. Resolve identity ──
    resolution = await resolve_contact(
        session,
        email=norm_email,
        linkedin=norm_linkedin,
        first_name=kwargs.get("first_name") if not strict_identity else None,
        last_name=kwargs.get("last_name") if not strict_identity else None,
        empresa_id=emp_id,
    )

    contact: Contact | None = None
    action = "skipped"

    if resolution.confidence == "high":
        # ── Email or LinkedIn match → update existing ─────────────
        contact = resolution.contact
        for field, value in kwargs.items():
            if value is None:
                continue
            # Protect email and phone: don't overwrite an existing valid value
            if field == "email" and contact.email:
                continue
            if field == "phone" and contact.phone:
                continue
            setattr(contact, field, value)

        action = "updated"

        # Deep-merge notes
        if data.notes:
            contact.notes = deep_merge(contact.notes, data.notes)

        # Update empresa snapshot
        if contact.empresa_rel:
            update_empresa_snapshot_in_contact(contact, contact.empresa_rel)
            
        if from_enrichment:
            contact.enriched = True
            contact.enriched_at = datetime.now(timezone.utc)

    elif resolution.confidence == "low" and resolution.possible_match_id:
        # ── Fuzzy match → Update existing, but ONLY non-critical fields ─────────────
        contact = await _load_contact(session, resolution.possible_match_id)
        if contact:
            for field, value in kwargs.items():
                if value is None:
                    continue
                # Do NOT overwrite email, phone or linkedin from a fuzzy match
                if field in ("email", "linkedin", "phone"):
                    continue
                setattr(contact, field, value)

            action = "updated"

            # Deep-merge notes
            if data.notes:
                contact.notes = deep_merge(contact.notes, data.notes)

            # Update empresa snapshot
            if contact.empresa_rel:
                update_empresa_snapshot_in_contact(contact, contact.empresa_rel)
                
            if from_enrichment:
                contact.enriched = True
                contact.enriched_at = datetime.now(timezone.utc)

    try:
        if contact is None:
            # ── No Match (or fuzzy match ID not found) ──────────
            # Only create if it's an "active" contact (has email or linkedin)
            if not norm_email and not norm_linkedin:
                return None, "skipped"

            contact = Contact(**kwargs, notes=data.notes)
            session.add(contact)
            await session.flush()
            contact = await _load_contact(session, contact.id)
            action = "created"

            # Inject datos_empresa snapshot into notes
            if contact and contact.empresa_rel:
                update_empresa_snapshot_in_contact(contact, contact.empresa_rel)

            if from_enrichment:
                contact.enriched = True
                contact.enriched_at = datetime.now(timezone.utc)
            else:
                contact.enriched = False
                contact.enriched_at = None

        # Sync M2M associations (only cargo_id and campaign_ids remain on Contact)
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
        return await _load_contact(session, final_id), action  # type: ignore[return-value]
    except IntegrityError:
        await session.rollback()
        
        # Fallback to retrieving the existing contact by normalized email
        if norm_email:
            result = await session.execute(select(Contact).where(Contact.email == norm_email))
            existing_contact = result.scalar_one_or_none()
            
            if existing_contact:
                # Update existing contact
                for field, value in kwargs.items():
                    if value is None:
                        continue
                    if field == "email" and existing_contact.email:
                        continue
                    if field == "phone" and existing_contact.phone:
                        continue
                    setattr(existing_contact, field, value)
                
                if data.notes:
                    existing_contact.notes = deep_merge(existing_contact.notes, data.notes)
                
                if existing_contact.empresa_rel:
                    update_empresa_snapshot_in_contact(existing_contact, existing_contact.empresa_rel)
                    
                if from_enrichment:
                    existing_contact.enriched = True
                    existing_contact.enriched_at = datetime.now(timezone.utc)
                    
                for m2m_key, config in M2M_FIELD_MAP.items():
                    ids_list = getattr(data, m2m_key, None)
                    if ids_list is None and data.model_extra:
                        ids_list = data.model_extra.get(m2m_key, None)
                        
                    model_class = globals()[config["model"]]
                    await _sync_m2m(session, existing_contact, model_class, ids_list, config["relation_name"], False, False)
                    
                final_id = existing_contact.id
                if auto_commit:
                    await session.commit()
                else:
                    await session.flush()
                return await _load_contact(session, final_id), "updated"
                
        raise  # Re-raise if we couldn't resolve the conflict




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

    # --- Cargo Resolution (on Update) ---
    if data.job_title:
        resolved_cargo = await cargo_service.resolve_cargo(session, data.job_title)
        if resolved_cargo:
            contact.cargo_id = resolved_cargo.id

    # Set notes from user input (or keep existing)
    contact.notes = base_notes

    # Inject/update datos_empresa snapshot
    final_emp_id = kwargs.get("empresa_id") or contact.empresa_id
    if final_emp_id:
        empresa_obj = await session.get(Empresa, final_emp_id)
        if empresa_obj:
            # Need M2M loaded for snapshot
            await session.refresh(empresa_obj, ["sectors", "verticals", "products_rel"])
            update_empresa_snapshot_in_contact(contact, empresa_obj)

    # Sync M2M if provided (only cargo_id and campaign_ids remain on Contact)
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
            selectinload(Contact.cargo),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        )
        .where(Contact.id.in_(contact_ids))
    )
    contacts = result.scalars().all()

    # ── Build ORM-safe kwargs via mapper (once for all contacts) ──
    kwargs = build_contact_kwargs(data)

    is_merge = data.merge_lists
    is_remove = getattr(data, 'remove_lists', False)

    for contact in contacts:
        base_notes = data.notes if "notes" in data.model_fields_set else contact.notes
        emp_id = kwargs.get("empresa_id") or contact.empresa_id

        # Apply only valid ORM fields
        for field, value in kwargs.items():
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
        selectinload(Contact.cargo),
        selectinload(Contact.campaigns),
        selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
        selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
        selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
    )

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
        query = query.where(Contact.cargo_id == filters.cargo_id)
    if filters.campaign_id is not None:
        from app.models.campaign import contact_campaigns as ccamp_table
        query = query.join(ccamp_table, Contact.id == ccamp_table.c.contact_id).where(
            ccamp_table.c.campaign_id == filters.campaign_id
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
