import csv
import io
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactFilterParams
from app.services import contact_service

from app.core.field_mapping import CORE_COLUMNS, M2M_FIELD_MAP

CSV_FIELDS = ["id"] + CORE_COLUMNS + list(M2M_FIELD_MAP.keys())

def _contact_to_row(contact: Contact) -> dict[str, Any]:
    row = {field: getattr(contact, field, None) for field in ["id"] + CORE_COLUMNS}
    for m2m_key, config in M2M_FIELD_MAP.items():
        rel_list = getattr(contact, config["relation_name"], [])
        row[m2m_key] = ",".join(str(item.id) for item in rel_list)
    return row


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

        payload = {}
        for col in CORE_COLUMNS:
            val = row.get(col)
            if val:
                payload[col] = val
                
        for m2m_key in M2M_FIELD_MAP.keys():
            val = row.get(m2m_key)
            if val:
                try:
                    payload[m2m_key] = [int(x.strip()) for x in str(val).split(",") if x.strip()]
                except Exception:
                    pass

        data = ContactCreate(**payload)

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
