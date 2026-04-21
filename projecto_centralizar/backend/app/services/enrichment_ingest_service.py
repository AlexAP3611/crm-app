import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empresa import Empresa
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.models.product import Product
from app.schemas.contact import ContactCreate
from app.schemas.enrichment import IngestContactInput, IngestRequest, IngestResponse
from app.services import cargo_service, contact_service

logger = logging.getLogger(__name__)

async def process_contacts(db: AsyncSession, empresa_id: int, contactos: list[IngestContactInput], cargo_cache: dict[str, any]):
    created = 0
    updated = 0
    skipped = 0

    for contact_in in contactos:
        # Normalize empty strings to None
        email = contact_in.email if contact_in.email != "" else None
        linkedin = contact_in.linkedin if contact_in.linkedin != "" else None

        if not email and not linkedin:
            logger.warning(f"SKIP Contacto: Ni email ni linkedin. Payload: {contact_in.model_dump()}")
            skipped += 1
            continue

        # Resolve Cargo using the robust single source of truth
        cargo = await cargo_service.get_or_create_cargo(db, contact_in.job_title, cache=cargo_cache)
        cargo_id = cargo.id if cargo else None

        contact_data = ContactCreate(
            empresa_id=empresa_id,
            first_name=contact_in.first_name,
            last_name=contact_in.last_name,
            email=email,
            linkedin=linkedin,
            job_title=contact_in.job_title,
            cargo_id=cargo_id,
            phone=contact_in.phone
        )
        try:
            contact, action = await contact_service.upsert_contact(
                db,
                contact_data,
                from_enrichment=True,
                auto_commit=False,
            )
            if action == "created":
                created += 1
            elif action == "updated":
                updated += 1
            else:
                skipped += 1
        except Exception as e:
            logger.error(f"Error ingesting contact {contact_in.first_name} {contact_in.last_name}: {e}\nPayload: {contact_in.model_dump()}")
            skipped += 1
    return created, updated, skipped

async def validate_empresa(db: AsyncSession, empresa_id: int) -> Empresa | None:
    return await db.get(Empresa, empresa_id)

async def bulk_ingest(db: AsyncSession, body: IngestRequest) -> IngestResponse:
    # 1. Pre-warm Cargo Cache (Optimization only)
    unique_titles = {c.job_title for emp in body.empresas for c in emp.contactos if c.job_title}
    cargo_cache = await cargo_service.prefill_cargo_cache(db, unique_titles)
    
    if cargo_cache:
        logger.info(f"Ingest: Cargo cache pre-filled with {len(cargo_cache)} existing job titles.")

    empresa_processed = 0
    empresa_skipped = 0
    contact_created = 0
    contact_updated = 0
    contact_skipped = 0

    for emp_in in body.empresas:
        try:
            empresa = await validate_empresa(db, emp_in.empresa_id)
            
            if not empresa:
                logger.warning(f"SKIP Empresa: ID {emp_in.empresa_id} no existe en DB. Payload: {emp_in.model_dump()}")
                empresa_skipped += 1
                continue
                
            # Update fields selectively, only if not None and not empty string
            if emp_in.web not in (None, ""): empresa.web = emp_in.web
            if emp_in.email not in (None, ""): empresa.email = emp_in.email
            if emp_in.phone not in (None, ""): empresa.phone = emp_in.phone
            if emp_in.cif not in (None, ""): empresa.cif = emp_in.cif
            if emp_in.cnae not in (None, ""): empresa.cnae = emp_in.cnae
            if emp_in.numero_empleados not in (None, ""): empresa.numero_empleados = emp_in.numero_empleados
            if emp_in.facturacion not in (None, ""): empresa.facturacion = emp_in.facturacion
            
            # M2M relationships — merge-append only, never replace existing
            if emp_in.sector:
                res_sec = await db.execute(select(Sector).where(Sector.name.in_(emp_in.sector)))
                new_sectors = list(res_sec.scalars().all())
                existing_ids = {s.id for s in empresa.sectors}
                for s in new_sectors:
                    if s.id not in existing_ids:
                        empresa.sectors.append(s)
                
            if emp_in.vertical:
                res_ver = await db.execute(select(Vertical).where(Vertical.name.in_(emp_in.vertical)))
                new_verticals = list(res_ver.scalars().all())
                existing_ids = {v.id for v in empresa.verticals}
                for v in new_verticals:
                    if v.id not in existing_ids:
                        empresa.verticals.append(v)
                
            if emp_in.producto:
                res_prod = await db.execute(select(Product).where(Product.name.in_(emp_in.producto)))
                new_products = list(res_prod.scalars().all())
                existing_ids = {p.id for p in empresa.products_rel}
                for p in new_products:
                    if p.id not in existing_ids:
                        empresa.products_rel.append(p)

            await db.flush()
            empresa_processed += 1
            
            # Pass cargo_cache to maintain session-level performance
            created, updated, skipped = await process_contacts(db, empresa.id, emp_in.contactos, cargo_cache)
            contact_created += created
            contact_updated += updated
            contact_skipped += skipped
        except Exception as e:
            logger.error(
                f"[INGEST ERROR] Empresa {emp_in.empresa_id}: {e}",
                exc_info=True
            )
            await db.rollback()
            empresa_skipped += 1
            continue

    await db.commit()

    return IngestResponse(
        status="success",
        empresa_processed=empresa_processed,
        empresa_skipped=empresa_skipped,
        contact_created=contact_created,
        contact_updated=contact_updated,
        contact_skipped=contact_skipped
    )
