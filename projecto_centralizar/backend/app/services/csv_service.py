import csv
import io
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactFilterParams
from app.services import contact_service

from app.core.field_mapping import CORE_COLUMNS, M2M_FIELD_MAP, EMPRESA_M2M_FIELD_MAP

# Combine both maps for CSV export/import purposes
_ALL_M2M = {**M2M_FIELD_MAP, **EMPRESA_M2M_FIELD_MAP}
CSV_FIELDS = ["id"] + CORE_COLUMNS + list(_ALL_M2M.keys())

def _contact_to_row(contact: Contact) -> dict[str, Any]:
    row = {field: getattr(contact, field, None) for field in ["id"] + CORE_COLUMNS}
    for m2m_key, config in _ALL_M2M.items():
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
    """
    Parse CSV bytes and upsert each row via contact_service.upsert_contact.
    
    Deduplication is handled entirely by resolve_contact inside upsert_contact.
    No separate matching logic here — single source of truth.
    """
    from app.core.resolve import resolve_contact, normalize_email, normalize_linkedin

    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    updated = 0
    skipped = 0

    for row in reader:
        # Strip whitespace from all values
        row = {k.strip(): (v.strip() if v else None) for k, v in row.items()}

        company = row.get("company")
        if not company:
            skipped += 1
            continue  # Skip rows without company

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

        # Pre-check: will upsert_contact find an existing contact?
        resolution = await resolve_contact(
            session,
            email_contact=normalize_email(payload.get("email_contact")),
            linkedin=normalize_linkedin(payload.get("linkedin")),
            first_name=payload.get("first_name"),
            last_name=payload.get("last_name"),
        )

        data = ContactCreate(**payload)
        new_or_updated = await contact_service.upsert_contact(session, data)

        if new_or_updated is None:
            skipped += 1
        else:
            if resolution.contact is not None or resolution.possible_match_id is not None:
                updated += 1
            else:
                created += 1

    return {"created": created, "updated": updated, "skipped": skipped}

