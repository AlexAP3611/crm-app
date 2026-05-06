from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.contact import Contact
from app.models.empresa import Empresa
from app.schemas.contact import (
    ContactCreate,
    ContactFilterParams,
    ContactListResponse,
    ContactResponse,
    ContactUpdate,
)
from app.schemas.scope import ContactScopedDelete, ContactScopedUpdate
from app.schemas.enrichment import ContactEnrichRequest, ContactEnrichSuccessResponse
from app.schemas.tool import ToolExecutionRequest, ToolExecutionResponse, ToolKey
from app.services import contact_service
from app.services import enrichment_service
from app.services import integration_service
from app.services.scope import apply_scope
from app.services.contact_service import _apply_contact_filters
from app.auth import get_current_user
from app.services.validators import ToolValidationErrorException
from fastapi import Response

router = APIRouter(
    prefix="/api/contacts", 
    tags=["Contacts"],
    dependencies=[Depends(get_current_user)]
)


@router.post("", response_model=ContactResponse, status_code=200)
async def upsert_contact(
    data: ContactCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create or update a contact. Upsert key: CIF → web → create new."""
    if not data.email and not data.linkedin:
        raise HTTPException(status_code=400, detail="No se puede crear o actualizar un contacto sin correo o linkedin")
        
    contact, _ = await contact_service.upsert_contact(db, data)
    return contact


@router.get("", response_model=ContactListResponse)
async def list_contacts(
    sector_id: int | None = Query(None),
    vertical_id: int | None = Query(None),
    campaign_id: int | None = Query(None),
    product_id: int | None = Query(None),
    cargo_id: int | None = Query(None),
    search: str | None = Query(None),
    contacto_nombre: str | None = Query(None),
    email: str | None = Query(None),
    empresa_id: int | None = Query(None),
    is_enriched: bool | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    filters = ContactFilterParams(
        sector_id=sector_id,
        vertical_id=vertical_id,
        campaign_id=campaign_id,
        product_id=product_id,
        cargo_id=cargo_id,
        search=search,
        contacto_nombre=contacto_nombre,
        email=email,
        empresa_id=empresa_id,
        is_enriched=is_enriched,
        page=page,
        page_size=page_size,
    )
    return await contact_service.list_contacts(db, filters)


# NOTE: Using POST instead of DELETE because many HTTP proxies (including
# Vite's dev proxy) strip the body from DELETE requests, causing validation
# errors. POST reliably carries request bodies.
@router.post("/bulk-delete")
async def delete_contacts_bulk(
    data: ContactScopedDelete = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Delete contacts by scope. Rejects empty scope."""
    query = select(Contact)
    query = apply_scope(
        query, model=Contact,
        ids=data.ids, filters=data.filters,
        apply_filters_fn=_apply_contact_filters,
        allow_all=data.all is True,
    )

    result = await db.execute(query)
    contacts = result.scalars().all()
    for c in contacts:
        await db.delete(c)
    await db.commit()
    return {"deleted": len(contacts)}


@router.post("/bulk-update")
async def update_contacts_bulk(
    data: ContactScopedUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Update contacts by scope. Rejects empty scope."""
    query = select(Contact).options(
        selectinload(Contact.cargo),
        selectinload(Contact.campaigns),
        selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
        selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
        selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
    )
    query = apply_scope(
        query, model=Contact,
        ids=data.ids, filters=data.filters,
        apply_filters_fn=_apply_contact_filters,
        allow_all=data.all is True,
    )

    result = await db.execute(query)
    contacts = result.scalars().all()
    contact_ids = [c.id for c in contacts]

    if not contact_ids:
        return {"updated": 0}

    count = await contact_service.bulk_update_contacts(db, contact_ids, data.data)
    return {"updated": count}


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(contact_id: int, db: AsyncSession = Depends(get_db)):
    contact = await contact_service.get_contact(db, contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int,
    data: ContactUpdate,
    db: AsyncSession = Depends(get_db),
):
    

    """Update a contact by ID. JSONB notes are deep-merged, not replaced."""
    contact = await contact_service.update_contact(db, contact_id, data)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact
    
@router.post("/{contact_id}/enrich", response_model=ContactResponse)
async def enrich_contact(
    contact_id: int,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Enrich contact notes using deep merge.
    Used by enrichment tools or background processes.
    """
    contact = await enrichment_service.enrich_contact(db, contact_id, "manual", data)

    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")

    return contact


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(contact_id: int, db: AsyncSession = Depends(get_db)):
    deleted = await contact_service.delete_contact(db, contact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")


@router.post("/enrich", response_model=ContactEnrichSuccessResponse)
async def enrich_contacts(
    request: ContactEnrichRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    [DEPRECATED] Use /tools/execute or semantic aliases instead.
    Enrich a set of contacts using an external tool.
    """
    # Map legacy request to new service
    tool_req = ToolExecutionRequest(
        tool_key=ToolKey(request.tool_key),
        enrichment_run_id=request.enrichment_run_id,
        ids=request.ids,
        filters=request.filters,
        all=getattr(request, 'all', False)
    )
    try:
        res = await integration_service.execute_contact_tool(db, tool_req)
        return ContactEnrichSuccessResponse(
            enrichment_run_id=res.run_id,
            total=0, # Legacy response doesn't match perfectly but it's deprecated
            sent=0
        )
    except ToolValidationErrorException as e:
        return Response(
            content=e.error.model_dump_json(),
            status_code=400,
            media_type="application/json"
        )

@router.post("/tools/execute", response_model=ToolExecutionResponse)
async def execute_tool(
    request: ToolExecutionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Execute an external tool (Integration Hub).
    Direction-agnostic (Inbound/Outbound).
    """
    try:
        return await integration_service.execute_contact_tool(db, request)
    except ToolValidationErrorException as e:
        return Response(
            content=e.error.model_dump_json(),
            status_code=400,
            media_type="application/json"
        )

@router.post("/export/affino", response_model=ToolExecutionResponse)
async def export_affino(
    request: ToolExecutionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Semantic alias for Affino Export.
    Forces tool_key to 'Affino'.
    """
    request.tool_key = ToolKey.AFFINO
    try:
        return await integration_service.execute_contact_tool(db, request)
    except ToolValidationErrorException as e:
        return Response(
            content=e.error.model_dump_json(),
            status_code=400,
            media_type="application/json"
        )
