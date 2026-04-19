import csv
import io
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactFilterParams
from app.services import contact_service

from app.models.empresa import Empresa
from app.schemas.empresa import EmpresaCreate

from app.core.field_mapping import CORE_COLUMNS, M2M_FIELD_MAP, EMPRESA_M2M_FIELD_MAP

# Combine both maps for CSV export/import purposes
_ALL_M2M = {**M2M_FIELD_MAP, **EMPRESA_M2M_FIELD_MAP}
CSV_FIELDS = ["id", "empresa_id", "cargo_id"] + CORE_COLUMNS + list(_ALL_M2M.keys())

EMPRESA_CORE_COLUMNS = ["nombre", "web", "email", "phone", "cif", "numero_empleados", "facturacion", "cnae"]
EMPRESA_CSV_FIELDS = ["id"] + EMPRESA_CORE_COLUMNS + list(EMPRESA_M2M_FIELD_MAP.keys())

def _contact_to_row(contact: Contact) -> dict[str, Any]:
    row = {field: getattr(contact, field, None) for field in ["id", "empresa_id", "cargo_id"] + CORE_COLUMNS}
    for m2m_key, config in _ALL_M2M.items():
        # Check if attribute exists on contact (it might be on Empresa instead)
        rel_list = getattr(contact, config["relation_name"], None)
        if rel_list is not None:
            row[m2m_key] = ",".join(str(item.id) for item in rel_list)
        else:
            row[m2m_key] = ""
    return row


def _empresa_to_row(empresa: Empresa) -> dict[str, Any]:
    row = {field: getattr(empresa, field, None) for field in ["id"] + EMPRESA_CORE_COLUMNS}
    for m2m_key, config in EMPRESA_M2M_FIELD_MAP.items():
        rel_list = getattr(empresa, config["relation_name"], [])
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

def parse_csv(content: bytes) -> list[dict]:
    """
    Decodes CSV bytes and returns a list of dictionaries with stripped keys and values.
    Empty strings are converted to None.
    """
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows = []

    for row in reader:
        row = {k.strip(): (v.strip() if v else None) for k, v in row.items()}
        rows.append(row)

    return rows

async def export_empresas_csv(session: AsyncSession, items: list[Empresa]) -> str:
    """Return CSV string for a list of enterprises."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=EMPRESA_CSV_FIELDS, extrasaction="ignore")
    writer.writeheader()
    for empresa in items:
        writer.writerow(_empresa_to_row(empresa))
    return output.getvalue()

