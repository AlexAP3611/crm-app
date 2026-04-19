from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import io
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import csv_service
from app.models.empresa import Empresa

router = APIRouter()

@router.get("/export")
async def export_empresas_csv(
    db: AsyncSession = Depends(get_db),
):
    """Export all empresas as a CSV file download."""
    # For now, simple export all. We can add filtering later if needed.
    result = await db.execute(
        select(Empresa)
        .options(
            selectinload(Empresa.sectors),
            selectinload(Empresa.verticals),
            selectinload(Empresa.products_rel),
        )
        .order_by(Empresa.nombre)
    )
    items = result.scalars().unique().all()
    csv_content = await csv_service.export_empresas_csv(db, list(items))
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=empresas.csv"},
    )


@router.post("/import")
async def import_empresas_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Import empresas from a CSV file.
    Deduplication: CIF -> web -> email -> Name.
    """
    if file.content_type not in ["text/csv", "application/vnd.ms-excel"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only CSV allowed.")
    
    content = await file.read()
    from app.services import csv_service, import_service
    rows = csv_service.parse_csv(content)
    result = await import_service.import_empresas_from_rows(db, rows)
    return result
