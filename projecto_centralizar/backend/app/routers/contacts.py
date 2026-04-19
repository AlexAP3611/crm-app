from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.contact import (
    ContactBulkDelete,
    ContactBulkUpdate,
    ContactCreate,
    ContactFilterParams,
    ContactListResponse,
    ContactResponse,
    ContactUpdate,
)
from app.services import contact_service
from app.auth import get_current_user

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
        raise HTTPException(status_code=400, detail="Cannot create or update contact without email or linkedin")
        
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
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100000),
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
        page=page,
        page_size=page_size,
    )
    return await contact_service.list_contacts(db, filters)


# NOTE: Using POST instead of DELETE because many HTTP proxies (including
# Vite's dev proxy) strip the body from DELETE requests, causing validation
# errors. POST reliably carries request bodies.
@router.post("/bulk-delete")
async def delete_contacts_bulk(
    data: ContactBulkDelete = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple contacts by ID list."""
    count = await contact_service.delete_contacts_bulk(db, data.ids)
    return {"deleted": count}


@router.post("/bulk-update")
async def update_contacts_bulk(
    data: ContactBulkUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple contacts by ID list with the same data."""
    count = await contact_service.bulk_update_contacts(db, data.ids, data.data)
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
    contact = await contact_service.enrich_contact(db, contact_id, data)

    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")

    return contact


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(contact_id: int, db: AsyncSession = Depends(get_db)):
    deleted = await contact_service.delete_contact(db, contact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")
