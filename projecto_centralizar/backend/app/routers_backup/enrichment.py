from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import enrichment_service
from app.auth import get_current_user

router = APIRouter(
    prefix="/api/enrichment", 
    tags=["Enrichment"],
    dependencies=[Depends(get_current_user)]
)


class EnrichRequest(BaseModel):
    source: str  # e.g. "clearbit", "hunter", "apollo"
    data: dict[str, Any]


class BulkEnrichRequest(BaseModel):
    contact_ids: list[int]
    source: str
    data: dict[str, Any]  # Static data to merge into all contacts (e.g. from a batch lookup)


@router.post("/{contact_id}")
async def enrich_contact(
    contact_id: int,
    body: EnrichRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Merge enrichment data into a contact's notes JSONB.
    Data is stored under `notes[source]` so different providers don't overwrite each other.
    """
    contact = await enrichment_service.enrich_contact(db, contact_id, body.source, body.data)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {
        "id": contact.id,
        "company": contact.company,
        "notes": contact.notes,
        "message": f"Enriched with '{body.source}' data",
    }


@router.post("/bulk")
async def bulk_enrich(
    body: BulkEnrichRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Merge the same enrichment data block into multiple contacts.
    Useful for tagging a batch of contacts with campaign or provider metadata.
    """
    async def static_lookup(contact):  # noqa: ANN001
        return body.data

    result = await enrichment_service.bulk_enrich(db, body.contact_ids, body.source, static_lookup)
    return result
