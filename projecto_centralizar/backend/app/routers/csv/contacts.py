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


@router.post("/import", summary="Import Contacts via CSV/XLSX")
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Import contacts from a CSV or XLSX file.
    The file should have columns matching the Contact model fields.
    Relationships like id and empresa_id should be integers.
    """
    # Allowed types: CSV, Excel (legacy), Excel (modern)
    allowed_types = [
        "text/csv", 
        "application/vnd.ms-excel", 
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ]
    if file.content_type not in allowed_types:
        # Fallback check for extensions in case content_type is generic
        if not (file.filename.lower().endswith(".csv") or file.filename.lower().endswith(".xlsx")):
            raise HTTPException(status_code=400, detail="Invalid file type. Only CSV and XLSX allowed.")

    content = await file.read()
    from app.services import import_service
    rows = csv_service.parse_file(content, file.filename)
    result = await import_service.import_contacts_from_rows(db, rows)

    return result
