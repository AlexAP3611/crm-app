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


@router.post("/{contact_id}")
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
        "company": contact.company,
        "notes": contact.notes,
        "message": f"Enriched with '{body.source}' data",
    }
