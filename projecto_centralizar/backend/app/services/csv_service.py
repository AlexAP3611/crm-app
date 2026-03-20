import csv
import io
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactFilterParams
from app.services import contact_service


CSV_FIELDS = [
    "id", "company", "first_name", "last_name", "job_title",
    "cif", "dominio", "email_generic", "email_contact", "phone",
    "product", "sector_id", "vertical_id",
]


def _contact_to_row(contact: Contact) -> dict[str, Any]:
    return {field: getattr(contact, field, None) for field in CSV_FIELDS}


async def export_csv(session: AsyncSession, filters: ContactFilterParams) -> str:
    """Return CSV string for all contacts matching filters."""
    result = await contact_service.list_contacts(session, filters)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, extrasaction="ignore")
    writer.writeheader()
    for contact in result["items"]:
        writer.writerow(_contact_to_row(contact))
    return output.getvalue()


async def import_csv(session: AsyncSession, content: bytes) -> dict[str, int]:
    """Parse CSV bytes and upsert each row. Returns counts."""
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    updated = 0

    for row in reader:
        # Strip whitespace from all values
        row = {k.strip(): (v.strip() if v else None) for k, v in row.items()}

        company = row.get("company")
        if not company:
            continue  # Skip rows without company

        existing_count_before = None

        data = ContactCreate(
            company=company,
            first_name=row.get("first_name") or None,
            last_name=row.get("last_name") or None,
            job_title=row.get("job_title") or None,
            cif=row.get("cif") or None,
            dominio=row.get("dominio") or None,
            email_generic=row.get("email_generic") or None,
            email_contact=row.get("email_contact") or None,
            phone=row.get("phone") or None,
            product=row.get("product") or None,
        )

        # Track whether upsert created or updated
        cif = data.cif
        dominio = data.dominio
        is_new = True

        if cif:
            from sqlalchemy import select
            res = await session.execute(
                select(Contact.id).where(Contact.cif == cif)
            )
            if res.scalar_one_or_none():
                is_new = False
        elif dominio:
            from sqlalchemy import select
            res = await session.execute(
                select(Contact.id).where(Contact.dominio == dominio)
            )
            if res.scalar_one_or_none():
                is_new = False

        await contact_service.upsert_contact(session, data)

        if is_new:
            created += 1
        else:
            updated += 1

    return {"created": created, "updated": updated}
