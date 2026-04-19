from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import io
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.contact import ContactFilterParams
from app.services import csv_service

router = APIRouter()

@router.get("/export")
async def export_csv(
    sector_id: int | None = Query(None),
    vertical_id: int | None = Query(None),
    campaign_id: int | None = Query(None),
    product: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Export contacts matching current filters as a CSV file download."""
    filters = ContactFilterParams(
        sector_id=sector_id,
        vertical_id=vertical_id,
        campaign_id=campaign_id,
        product=product,
        search=search,
        page=1,
        page_size=100_000,  # export all matching
    )
    csv_content = await csv_service.export_csv(db, filters)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"},
    )


@router.post("/import", summary="Import Contacts via CSV")
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Import contacts from a CSV file.
    The CSV should have columns matching the Contact model fields.
    Relationships like id and empresa_id should be integers.
    """
    if file.content_type not in ["text/csv", "application/vnd.ms-excel"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV allowed.")

    content = await file.read()
    rows = csv_service.parse_csv(content)
    result = await import_service.import_contacts_from_rows(db, rows)

    return result
