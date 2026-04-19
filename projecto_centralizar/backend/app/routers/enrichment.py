from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.database import get_db
from app.auth import get_current_user
from app.services import enrichment_service, enrichment_ingest_service
from app.schemas.enrichment import (
    EnrichRequest,
    BulkEnrichRequest,
    BulkEnrichmentResponse,
    BulkEnrichmentResultItem,
    IngestRequest,
    IngestResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/enrichment",
    tags=["Enrichment"],
    dependencies=[Depends(get_current_user)]
)

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
            logger.error(f"Error bulk_enrich contact {contact_item.id_contacto}: {e}")
            results.append(BulkEnrichmentResultItem(
                id_contacto=contact_item.id_contacto,
                status="error",
                message=str(e)
            ))

    return BulkEnrichmentResponse(results=results)


@router.post("/contact/{contact_id}")
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


@router.post("/ingest", response_model=IngestResponse)
async def ingest_enrichment(
    body: IngestRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest bulk enrichment from n8n.
    Protected strictly by router-level Depends(get_current_user).
    Delegated completely to service layer.
    """
    return await enrichment_ingest_service.bulk_ingest(db, body)
