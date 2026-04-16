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

        empresa_id_raw = row.get("empresa_id")
        if not empresa_id_raw:
            skipped += 1
            continue  # Skip rows without empresa_id
        try:
            empresa_id = int(empresa_id_raw)
        except ValueError:
            skipped += 1
            continue

        payload = {"empresa_id": empresa_id}
        
        # Handle cargo_id
        cargo_id_raw = row.get("cargo_id")
        if cargo_id_raw:
            try: payload["cargo_id"] = int(cargo_id_raw)
            except: pass

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


async def export_empresas_csv(session: AsyncSession, items: list[Empresa]) -> str:
    """Return CSV string for a list of enterprises."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=EMPRESA_CSV_FIELDS, extrasaction="ignore")
    writer.writeheader()
    for empresa in items:
        writer.writerow(_empresa_to_row(empresa))
    return output.getvalue()


async def import_empresas_csv(session: AsyncSession, content: bytes) -> dict[str, int]:
    """
    Parse CSV bytes and upsert each row for Empresas.
    Deduplication pattern: CIF -> Name (normalized).
    """
    from sqlalchemy import select, func
    from app.core.utils import normalize_company_name

    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    created = 0
    updated = 0
    skipped = 0

    for row in reader:
        # Strip whitespace from all values
        row = {k.strip(): (v.strip() if v else None) for k, v in row.items()}

        nombre = row.get("nombre")
        if not nombre:
            skipped += 1
            continue

        payload = {}
        for col in EMPRESA_CORE_COLUMNS:
            val = row.get(col)
            if val:
                if col == "numero_empleados":
                    try: payload[col] = int(val)
                    except: pass
                elif col == "facturacion":
                    try: payload[col] = float(val)
                    except: pass
                else:
                    payload[col] = val

        for m2m_key in EMPRESA_M2M_FIELD_MAP.keys():
            val = row.get(m2m_key)
            if val:
                try:
                    payload[m2m_key] = [int(x.strip()) for x in str(val).split(",") if x.strip()]
                except:
                    pass

        # Simple deduplication logic
        existing = None
        cif = payload.get("cif")
        if cif:
            res = await session.execute(select(Empresa).where(Empresa.cif == cif))
            existing = res.scalar_one_or_none()
        
        if not existing:
            norm_name = normalize_company_name(nombre)
            res = await session.execute(select(Empresa).where(func.lower(Empresa.nombre) == norm_name.lower()))
            existing = res.scalar_one_or_none()

        if existing:
            # Update
            for k, v in payload.items():
                if k not in ["sector_ids", "vertical_ids", "product_ids"]:
                    setattr(existing, k, v)
                
            # Handle M2M (Replacement strategy for simplicity in CSV import)
            from app.models.sector import Sector
            from app.models.vertical import Vertical
            from app.models.product import Product

            if "sector_ids" in payload:
                res = await session.execute(select(Sector).where(Sector.id.in_(payload["sector_ids"])))
                existing.sectors = list(res.scalars().all())
            if "vertical_ids" in payload:
                res = await session.execute(select(Vertical).where(Vertical.id.in_(payload["vertical_ids"])))
                existing.verticals = list(res.scalars().all())
            if "product_ids" in payload:
                res = await session.execute(select(Product).where(Product.id.in_(payload["product_ids"])))
                existing.products_rel = list(res.scalars().all())
            
            updated += 1
        else:
            # Create
            from app.routers.empresas import _sync_empresa_m2m
            
            company_data = {k: v for k, v in payload.items() if k not in ["sector_ids", "vertical_ids", "product_ids"]}
            new_empresa = Empresa(**company_data)
            await _sync_empresa_m2m(
                session, 
                new_empresa, 
                payload.get("sector_ids", []), 
                payload.get("vertical_ids", []), 
                payload.get("product_ids", [])
            )
            session.add(new_empresa)
            created += 1

    await session.commit()
    return {"created": created, "updated": updated, "skipped": skipped}

