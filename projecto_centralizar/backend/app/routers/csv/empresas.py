from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import csv
import io
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import csv_service
from app.services.scope import apply_scope
from app.services.empresa_service import _apply_empresa_filters
from app.models.empresa import Empresa
from app.schemas.empresa import EmpresaFilterFields

router = APIRouter()

@router.get("/export")
async def export_empresas_csv(
    filters: EmpresaFilterFields = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Export empresas matching filters as streaming CSV. No pagination leakage."""
    query = select(Empresa).options(
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
    ).order_by(Empresa.nombre)
    query = apply_scope(
        query,
        model=Empresa,
        filters=filters,
        apply_filters_fn=_apply_empresa_filters,
        allow_all=True,  # export all is safe (non-destructive)
    )

    result = await db.execute(query)
    items = list(result.scalars().unique().all())
    csv_content = await csv_service.export_empresas_csv(db, items)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=empresas.csv"},
    )


@router.post("/import", summary="Import Empresas via CSV/XLSX")
async def import_empresas_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Import empresas from a CSV or XLSX file.
    Deduplication: CIF -> web -> email -> Name.
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
    from app.services import csv_service, import_service
    rows = csv_service.parse_file(content, file.filename)
    result = await import_service.import_empresas_from_rows(db, rows)
    return result
