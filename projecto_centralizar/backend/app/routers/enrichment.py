from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.empresa import Empresa
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.models.product import Product
from app.schemas.contact import ContactCreate
from app.services import enrichment_service, contact_service
from app.core.resolve import resolve_contact
from app.auth import get_current_user

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
    - nombre_empresa -> company column
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
    email_contact: str | None = None
    linkedin: str | None = None
    job_title: str | None = None
    phone: str | None = None

class IngestEmpresaInput(BaseModel):
    empresa_id: int
    nombre_empresa: str
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
    empresa_count: int
    contact_created: int
    contact_updated: int
    contact_skipped: int

@router.post("/ingest", response_model=IngestResponse)
@router.post("/{contact_id}")
async def ingest_enrichment(
    body: IngestRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest bulk enrichment from n8n.
    Protected strictly by router-level Depends(get_current_user).
    """
    empresa_count = 0
    contact_created = 0
    contact_updated = 0
    contact_skipped = 0

    for emp_in in body.empresas:
        # Lookup Empresa using empresa_id (Priority 1)
        empresa = await db.get(Empresa, emp_in.empresa_id)
        
        # Fallback to nombre_empresa (Exact String Match, NO lower, NO fuzzy)
        if not empresa:
            result = await db.execute(select(Empresa).where(Empresa.nombre == emp_in.nombre_empresa))
            empresa = result.scalar_one_or_none()
            
        if not empresa:
            # Create new if doesn't exist
            empresa = Empresa(
                nombre=emp_in.nombre_empresa,
                web=emp_in.web,
                email=emp_in.email,
                cif=emp_in.cif,
                cnae=emp_in.cnae,
                numero_empleados=emp_in.numero_empleados,
                facturacion=emp_in.facturacion
            )
            db.add(empresa)
            await db.flush()
        else:
            # Update fields selectively, only if not None
            if emp_in.nombre_empresa is not None: empresa.nombre = emp_in.nombre_empresa
            if emp_in.web is not None: empresa.web = emp_in.web
            if emp_in.email is not None: empresa.email = emp_in.email
            if emp_in.cif is not None: empresa.cif = emp_in.cif
            if emp_in.cnae is not None: empresa.cnae = emp_in.cnae
            if emp_in.numero_empleados is not None: empresa.numero_empleados = emp_in.numero_empleados
            if emp_in.facturacion is not None: empresa.facturacion = emp_in.facturacion
        
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
        empresa_count += 1
        
        # Upsert Contacts
        for contact_in in emp_in.contactos:
            contact_data = ContactCreate(
                empresa_id=empresa.id,
                first_name=contact_in.first_name,
                last_name=contact_in.last_name,
                email_contact=contact_in.email_contact,
                linkedin=contact_in.linkedin,
                job_title=contact_in.job_title,
                phone=contact_in.phone
            )
            try:
                # Pre-lookup to accurately measure created vs updated
                resolution = await resolve_contact(
                    db,
                    email_contact=contact_in.email_contact,
                    linkedin=contact_in.linkedin,
                    first_name=contact_in.first_name,
                    last_name=contact_in.last_name,
                    empresa_id=empresa.id
                )
                exists_before = (resolution.contact is not None) or (resolution.possible_match_id is not None)

                res = await contact_service.upsert_contact(db, contact_data)
                
                if res is None:
                    contact_skipped += 1
                else:
                    if exists_before:
                        contact_updated += 1
                    else:
                        contact_created += 1
            except Exception as e:
                # Log error or simply skip
                contact_skipped += 1

    await db.commit()

    return IngestResponse(
        status="success",
        empresa_count=empresa_count,
        contact_created=contact_created,
        contact_updated=contact_updated,
        contact_skipped=contact_skipped
    )
