from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

import logging

from app.database import get_db
from app.models.empresa import Empresa
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.models.product import Product
from app.schemas.contact import ContactCreate
from app.services import enrichment_service, contact_service
from app.core.resolve import resolve_contact
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/enrichment",
    tags=["Enrichment"],
    dependencies=[Depends(get_current_user)]
)


class EnrichRequest(BaseModel):
    source: str
    data: dict[str, Any]


class BulkContactItem(BaseModel):
    """
    Only id_contacto is required. All other fields are optional and handled
    dynamically — known columns are written to DB, the rest go into notes[source].
    """
    model_config = {"extra": "allow"}

    id_contacto: int


class BulkContactData(BaseModel):
    contacts: list[BulkContactItem]


class BulkEnrichRequest(BaseModel):
    source: str
    data: BulkContactData


class BulkEnrichmentResultItem(BaseModel):
    id_contacto: int
    status: str
    message: str | None = None


class BulkEnrichmentResponse(BaseModel):
    results: list[BulkEnrichmentResultItem]


@router.post("/bulk", response_model=BulkEnrichmentResponse)
async def bulk_enrich(
    body: BulkEnrichRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Enrich multiple contacts:
    - web -> web column
    - vertical -> M2M relationship
    - everything else -> notes[source] as strings
    """
    results: list[BulkEnrichmentResultItem] = []

    for contact_item in body.data.contacts:
        try:
            # Merge declared fields and any extra fields captured by extra='allow'
            data = contact_item.model_dump(exclude={"id_contacto"})
            # Also include undeclared extra fields
            data.update(contact_item.model_extra or {})
            # Remove None values
            data = {k: v for k, v in data.items() if v is not None}

            res = await enrichment_service.enrich_contact_smart(
                db, contact_item.id_contacto, body.source, data
            )

            if res is None:
                results.append(BulkEnrichmentResultItem(
                    id_contacto=contact_item.id_contacto,
                    status="error",
                    message="Contact not found"
                ))
            else:
                results.append(BulkEnrichmentResultItem(
                    id_contacto=contact_item.id_contacto,
                    status="success"
                ))
        except Exception as e:
            results.append(BulkEnrichmentResultItem(
                id_contacto=contact_item.id_contacto,
                status="error",
                message=str(e)
            ))

    return BulkEnrichmentResponse(results=results)



async def enrich_contact(
    contact_id: int,
    body: EnrichRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Merge enrichment data into a contact's notes JSONB.
    Data is stored under notes[source] so different providers don't overwrite each other.
    """
    contact = await enrichment_service.enrich_contact(db, contact_id, body.source, body.data)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {
        "id": contact.id,
        "empresa_id": contact.empresa_id,
        "notes": contact.notes,
        "message": f"Enriched with '{body.source}' data",
    }


class IngestContactInput(BaseModel):
    first_name: str
    last_name: str
    email: str | None = None
    linkedin: str | None = None
    job_title: str | None = None
    phone: str | None = None

class IngestEmpresaInput(BaseModel):
    empresa_id: int
    web: str
    email: str | None = None
    cif: str | None = None
    cnae: str | None = None
    numero_empleados: int | None = None
    facturacion: float | None = None
    sector: list[str] = []
    vertical: list[str] = []
    producto: list[str] = []
    contactos: list[IngestContactInput] = []

class IngestRequest(BaseModel):
    empresas: list[IngestEmpresaInput]

class IngestResponse(BaseModel):
    status: str
    empresa_processed: int
    empresa_skipped: int
    contact_created: int
    contact_updated: int
    contact_skipped: int

async def process_contacts(db: AsyncSession, empresa_id: int, contactos: list[IngestContactInput]):
    created = 0
    updated = 0
    skipped = 0
    for contact_in in contactos:
        # 1 & 2 Normalization and Identity Pre-check
        email = contact_in.email if contact_in.email != "" else None
        linkedin = contact_in.linkedin if contact_in.linkedin != "" else None

        if not email and not linkedin:
            logger.warning(f"SKIP Contacto: Ni email ni linkedin. Payload: {contact_in.model_dump()}")
            skipped += 1
            continue

        contact_data = ContactCreate(
            empresa_id=empresa_id,
            first_name=contact_in.first_name,
            last_name=contact_in.last_name,
            email=email,
            linkedin=linkedin,
            job_title=contact_in.job_title,
            phone=contact_in.phone
        )
        try:
            # Enforce exact identity. Explicitly disable fuzzy matcher by sending None for first/last name
            resolution = await resolve_contact(
                db,
                email=email,
                linkedin=linkedin,
                first_name=None,
                last_name=None,
                empresa_id=empresa_id
            )
            exists_before = (resolution.contact is not None)
            
            # Send strict control flag to upsert
            res = await contact_service.upsert_contact(
                db, 
                contact_data, 
                from_enrichment=True,
                strict_identity=True
            )
            if res is None:
                skipped += 1
            else:
                if exists_before:
                    updated += 1
                else:
                    created += 1
        except Exception as e:
            logger.error(f"Error ingesting contact {contact_in.first_name} {contact_in.last_name}: {e}\nPayload: {contact_in.model_dump()}")
            skipped += 1
    return created, updated, skipped

async def validate_empresa(db: AsyncSession, empresa_id: int) -> Empresa | None:
    return await db.get(Empresa, empresa_id)

@router.post("/ingest")
@router.post("/{contact_id}")
async def ingest_enrichment(
    body: IngestRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest bulk enrichment from n8n.
    Protected strictly by router-level Depends(get_current_user).
    """
    empresa_processed = 0
    empresa_skipped = 0
    contact_created = 0
    contact_updated = 0
    contact_skipped = 0

    for emp_in in body.empresas:
        empresa = await validate_empresa(db, emp_in.empresa_id)
        
        if not empresa:
            logger.warning(f"SKIP Empresa: ID {emp_in.empresa_id} no existe en DB. Payload: {emp_in.model_dump()}")
            empresa_skipped += 1
            continue
            
        # Update fields selectively, only if not None and not empty string
        if emp_in.web not in (None, ""): empresa.web = emp_in.web
        if emp_in.email not in (None, ""): empresa.email = emp_in.email
        if emp_in.cif not in (None, ""): empresa.cif = emp_in.cif
        if emp_in.cnae not in (None, ""): empresa.cnae = emp_in.cnae
        if emp_in.numero_empleados not in (None, ""): empresa.numero_empleados = emp_in.numero_empleados
        if emp_in.facturacion not in (None, ""): empresa.facturacion = emp_in.facturacion
        
        # M2M relationships (Update only if present in input)
        if emp_in.sector:
            res_sec = await db.execute(select(Sector).where(Sector.name.in_(emp_in.sector)))
            empresa.sectors = list(res_sec.scalars().all())
            
        if emp_in.vertical:
            res_ver = await db.execute(select(Vertical).where(Vertical.name.in_(emp_in.vertical)))
            empresa.verticals = list(res_ver.scalars().all())
            
        if emp_in.producto:
            res_prod = await db.execute(select(Product).where(Product.name.in_(emp_in.producto)))
            empresa.products_rel = list(res_prod.scalars().all())

        await db.flush()
        empresa_processed += 1
        
        created, updated, skipped = await process_contacts(db, empresa.id, emp_in.contactos)
        contact_created += created
        contact_updated += updated
        contact_skipped += skipped

    await db.commit()

    return IngestResponse(
        status="success",
        empresa_processed=empresa_processed,
        empresa_skipped=empresa_skipped,
        contact_created=contact_created,
        contact_updated=contact_updated,
        contact_skipped=contact_skipped
    )
