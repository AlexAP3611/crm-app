from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import io
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.contact import ContactFilterFields
from app.services import csv_service
from app.services.scope import apply_scope
from app.services.contact_service import _apply_contact_filters
from app.models.contact import Contact
from app.models.empresa import Empresa

router = APIRouter()

@router.get("/export")
async def export_csv(
    sector_id: int | None = Query(None),
    vertical_id: int | None = Query(None),
    campaign_id: int | None = Query(None),
    product_id: int | None = Query(None),
    cargo_id: int | None = Query(None),
    search: str | None = Query(None),
    contacto_nombre: str | None = Query(None),
    email: str | None = Query(None),
    empresa_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Export contacts matching filters as CSV. No pagination leakage."""
    filters = ContactFilterFields(
        sector_id=sector_id,
        vertical_id=vertical_id,
        campaign_id=campaign_id,
        product_id=product_id,
        cargo_id=cargo_id,
        search=search,
        contacto_nombre=contacto_nombre,
        email=email,
        empresa_id=empresa_id,
    )
    query = select(Contact).options(
        selectinload(Contact.cargo),
        selectinload(Contact.campaigns),
        selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
        selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
        selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
    ).order_by(Contact.id.desc())
    query = apply_scope(
        query,
        model=Contact,
        filters=filters,
        apply_filters_fn=_apply_contact_filters,
        allow_all=True,  # export all is safe (non-destructive)
    )

    result = await db.execute(query)
    items = list(result.scalars().unique().all())

    output = io.StringIO()
    import csv
    writer = csv.DictWriter(output, fieldnames=csv_service.CSV_FIELDS, extrasaction="ignore")
    writer.writeheader()
    for contact in items:
        writer.writerow(csv_service._contact_to_row(contact))

    return StreamingResponse(
        io.StringIO(output.getvalue()),
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
