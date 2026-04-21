import csv
import io
from openpyxl import load_workbook
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactFilterParams
from app.services import contact_service

from app.models.empresa import Empresa
from app.schemas.empresa import EmpresaCreate

from app.core.view_fields.contact_view_fields import CONTACT_VIEW_FIELDS
from app.core.view_fields.empresa_view_fields import EMPRESA_VIEW_FIELDS
from app.domain.relations import M2M_FIELD_MAP, EMPRESA_M2M_FIELD_MAP

CSV_VERSION = "v1"

# Domain-specific M2M field maps
CONTACT_M2M_FIELDS = M2M_FIELD_MAP
EMPRESA_M2M_FIELDS = EMPRESA_M2M_FIELD_MAP

CSV_FIELDS = [
    "csv_version",
    "id",
    "empresa_id",
    "cargo_id",
    # Contact native fields
    *CONTACT_VIEW_FIELDS,
    # Empresa explicit fields
    "empresa_nombre",
    "empresa_cif",
    "empresa_web",
    "empresa_email",
    "empresa_phone",
    # M2M Relationships
    *CONTACT_M2M_FIELDS.keys(),
    *EMPRESA_M2M_FIELDS.keys(),
]

EMPRESA_CSV_FIELDS = ["csv_version", "id"] + EMPRESA_VIEW_FIELDS + list(EMPRESA_M2M_FIELDS.keys())

def _contact_to_row(contact: Contact) -> dict[str, Any]:
    row = {"csv_version": CSV_VERSION}

    # Core
    row["id"] = contact.id
    row["empresa_id"] = contact.empresa_id
    row["cargo_id"] = contact.cargo_id

    # Contact native fields
    for field in CONTACT_VIEW_FIELDS:
        row[field] = getattr(contact, field, "") or ""

    # Empresa explicit fields (Decoupled access)
    empresa = getattr(contact, "empresa_rel", None)
    row["empresa_nombre"] = empresa.nombre if empresa else ""
    row["empresa_cif"] = empresa.cif if empresa else ""
    row["empresa_web"] = empresa.web if empresa else ""
    row["empresa_email"] = empresa.email if empresa else ""
    row["empresa_phone"] = empresa.phone if empresa else ""

    # Contact M2M
    for key, config in CONTACT_M2M_FIELDS.items():
        rel_list = getattr(contact, config["relation_name"], [])
        row[key] = ",".join(str(item.id) for item in rel_list)

    # Empresa M2M
    if empresa:
        for key, config in EMPRESA_M2M_FIELDS.items():
            rel_list = getattr(empresa, config["relation_name"], [])
            row[key] = ",".join(str(item.id) for item in rel_list)
    else:
        for key in EMPRESA_M2M_FIELDS.keys():
            row[key] = ""

    return row


def _empresa_to_row(empresa: Empresa) -> dict[str, Any]:
    row = {"csv_version": CSV_VERSION}
    row["id"] = empresa.id

    for field in EMPRESA_VIEW_FIELDS:
        row[field] = getattr(empresa, field, "") or ""

    for key, config in EMPRESA_M2M_FIELDS.items():
        rel_list = getattr(empresa, config["relation_name"], [])
        row[key] = ",".join(str(item.id) for item in rel_list)

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

def parse_xlsx(content: bytes) -> list[dict]:
    """
    Parses XLSX bytes and returns a list of dictionaries.
    Headers are normalized (stripped and lowercased).
    Data values are stripped if they are strings.
    """
    wb = load_workbook(io.BytesIO(content))
    ws = wb.active

    # Safe header extraction with normalization
    headers = [
        (str(cell.value).strip().lower() if cell.value is not None else None)
        for cell in next(ws.iter_rows(min_row=1, max_row=1))
    ]

    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        clean_row = {}
        for k, v in zip(headers, row):
            if not k:
                continue
            if isinstance(v, str):
                v = v.strip()
            clean_row[k] = v
        rows.append(clean_row)

    return rows

def parse_file(content: bytes, filename: str) -> list[dict]:
    """Unified parser that handles CSV and XLSX based on filename extension."""
    filename = filename.lower()
    if filename.endswith(".csv"):
        return parse_csv(content)
    if filename.endswith(".xlsx"):
        return parse_xlsx(content)
    raise ValueError("Unsupported file format. Only .csv and .xlsx are supported.")

async def export_empresas_csv(session: AsyncSession, items: list[Empresa]) -> str:
    """Return CSV string for a list of enterprises."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=EMPRESA_CSV_FIELDS, extrasaction="ignore")
    writer.writeheader()
    for empresa in items:
        writer.writerow(_empresa_to_row(empresa))
    return output.getvalue()
