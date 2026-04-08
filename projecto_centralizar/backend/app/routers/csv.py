from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
import io

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.contact import ContactFilterParams
from app.services import csv_service
from app.auth import get_current_user

router = APIRouter(
    prefix="/api/csv", 
    tags=["CSV"],
    dependencies=[Depends(get_current_user)]
)


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


@router.post("/import")
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Import contacts from a CSV file.
    Required column: company.
    Upsert: CIF → web → create new.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")
    content = await file.read()
    result = await csv_service.import_csv(db, content)
    return result
