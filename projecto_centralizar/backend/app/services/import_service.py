import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.schemas.contact import ContactCreate
from app.schemas.empresa import EmpresaCreate
from app.services import contact_service, empresa_service, empresa_mapper, sector_service, vertical_service, product_service
from app.core.utils import normalize_web, normalize_company_name
from app.core.view_fields.contact_view_fields import CONTACT_VIEW_FIELDS
from app.core.view_fields.empresa_view_fields import EMPRESA_VIEW_FIELDS
from app.domain.relations import M2M_FIELD_MAP, EMPRESA_M2M_FIELD_MAP
from app.core.domain_mappers.empresa_mapper import normalize_empresa_row

logger = logging.getLogger(__name__)

# Enforce strict domain consistency during import
STRICT_IMPORT = True

def is_valid_name(name: str | None) -> bool:
    """
    Blocks placeholder names to prevent DB pollution.
    Hardened to skip N/A, -, test, client, etc.
    """
    if not name:
        return False
    blocked = {
        "n/a", "unknown", "desconocido", "desconocida", "-", ".", 
        "test", "prueba", "client", "cliente", "empresa", "company"
    }
    cleaned = name.strip().lower()
    return cleaned not in blocked and len(cleaned) > 1

def safe_str(val):
    """
    Safely convert any value to a trimmed string or None.
    Specifically handles Excel floats that should be integers (e.g. 986561216.0 -> "986561216").
    """
    if val is None:
        return None
    
    # Fix Excel floats like 986561216.0
    if isinstance(val, float) and val.is_integer():
        val = int(val)
        
    return str(val).strip() or None

def has_contact_identifier(row: dict) -> bool:
    """
    Deterministic check: contact must have at least one valid identity channel.
    """
    email = safe_str(row.get("email"))
    phone = safe_str(row.get("phone"))
    linkedin = safe_str(row.get("linkedin"))
    return bool(email or phone or linkedin)

async def resolve_empresa_for_contact(session: AsyncSession, row: dict, mode: str = "commit") -> tuple[int | None, str | None]:
    """
    Encapsulates Empresa resolution logic.
    In preview mode, it avoids DB writes and returns (None, name) if a new Empresa would be created.
    Returns (empresa_id, new_empresa_name_if_preview).
    """
    emp_id_raw = row.get("empresa_id")
    if emp_id_raw:
        try:
            return int(emp_id_raw), None
        except (ValueError, TypeError):
            pass

    emp_name = safe_str(row.get("empresa_nombre") or row.get("empresa"))
    emp_cif = safe_str(row.get("empresa_cif") or row.get("cif"))
    emp_web = safe_str(row.get("empresa_web") or row.get("web"))

    if not (emp_cif or emp_web or emp_name):
        return None, None

    # Resolve via service
    auto_create = is_valid_name(emp_name)
    
    # In preview mode, we NEVER auto-create in DB
    service_auto_create = auto_create if mode == "commit" else False
    
    resolution = await empresa_service.resolve_empresa(
        session,
        cif=emp_cif,
        web=emp_web,
        empresa_nombre=emp_name,
        auto_create=service_auto_create
    )

    if resolution:
        return resolution.empresa.id, None

    if mode == "preview" and auto_create:
        return None, emp_name

    return None, None

from typing import Literal, List
from app.schemas.import_schema import ImportSummary, SkipDetail, EmpresaPreview

async def import_contacts_from_rows(
    session: AsyncSession, 
    rows: list[dict], 
    mode: Literal["commit", "preview"] = "commit"
) -> dict | ImportSummary:
    """
    Optimized contact import pipeline.
    Unified logic for both modes. Zero DB writes in preview.
    """
    summary = {
        "total_rows": len(rows),
        "to_create": 0,
        "to_update": 0,
        "skipped": 0,
        "skip_details": [],
        "empresa_preview": []
    }

    # Track empresas that would be created in this batch (for preview consistency)
    preview_new_empresas = set()

    for row_idx, row in enumerate(rows):
        try:
            # 1. Identity Check
            if not has_contact_identifier(row):
                summary["skipped"] += 1
                summary["skip_details"].append(SkipDetail(row=row_idx, reason="Missing email, phone, or linkedin"))
                continue

            # 2. Empresa Resolution
            empresa_id, new_emp_name = await resolve_empresa_for_contact(session, row, mode=mode)
            
            if mode == "preview":
                if new_emp_name:
                    if new_emp_name not in preview_new_empresas:
                        preview_new_empresas.add(new_emp_name)
                        summary["empresa_preview"].append(EmpresaPreview(name=new_emp_name, action="would_create"))
                    # For preview, we treat the row as valid if it would create an empresa
                elif not empresa_id:
                    summary["skipped"] += 1
                    summary["skip_details"].append(SkipDetail(row=row_idx, reason="Could not resolve or create valid Empresa"))
                    continue
            else:
                if not empresa_id:
                    summary["skipped"] += 1
                    summary["skip_details"].append(SkipDetail(row=row_idx, reason="Could not resolve or create valid Empresa"))
                    continue

            # 3. Build Payload
            payload = {"empresa_id": empresa_id or 0} # 0 is placeholder for preview
            for col in CONTACT_VIEW_FIELDS:
                val = row.get(col)
                if val is not None and val != "":
                    payload[col] = val
            
            for m2m_key, config in M2M_FIELD_MAP.items():
                val = row.get(m2m_key)
                if val:
                    try:
                        payload[m2m_key] = [int(x.strip()) for x in str(val).split(",") if x.strip()]
                        payload["merge_lists"] = True
                    except Exception:
                        pass

            data = ContactCreate(**payload)
            
            # 4. Upsert Decisions (Logic Replay)
            if mode == "preview":
                existing = await contact_service.resolve_contact(session, data)
                if existing:
                    summary["to_update"] += 1
                else:
                    summary["to_create"] += 1
                continue

            # 5. Commit Mode: Prepare for Persistence
            contact, action = await contact_service.upsert_contact(session, data, auto_commit=False)
            if action == "created":
                summary["to_create"] += 1
            elif action == "updated":
                summary["to_update"] += 1
            else:
                summary["skipped"] += 1

        except Exception as e:
            if mode == "commit":
                await session.rollback()
            summary["skipped"] += 1
            summary["skip_details"].append(SkipDetail(row=row_idx, reason=str(e)))

    if mode == "commit":
        await session.flush()
        await session.commit()
        return {
            "created": summary["to_create"], 
            "updated": summary["to_update"], 
            "skipped": summary["skipped"]
        }
    
    return ImportSummary(**summary)


async def import_empresas_from_rows(
    session: AsyncSession, 
    rows: list[dict],
    mode: Literal["commit", "preview"] = "commit"
) -> dict | ImportSummary:
    """
    Optimized empresa import pipeline.
    Unified logic for both modes. Zero DB writes in preview.
    """
    summary = {
        "total_rows": len(rows),
        "to_create": 0,
        "to_update": 0,
        "skipped": 0,
        "skip_details": [],
        "empresa_preview": []
    }
    
    # Defer M2M sync until after batch flush (Commit mode only)
    m2m_sync_queue = []

    for row_idx, row in enumerate(rows):
        try:
            mapped = normalize_empresa_row(row)
            nombre = mapped.get("nombre")
            if not is_valid_name(nombre):
                summary["skipped"] += 1
                summary["skip_details"].append(SkipDetail(row=row_idx, reason="Missing or invalid 'nombre' (placeholder)"))
                continue

            payload = {}
            for col in EMPRESA_VIEW_FIELDS:
                val = mapped.get(col)
                if val is not None and val != "":
                    if col == "web": payload[col] = normalize_web(val)
                    elif col == "nombre": payload[col] = normalize_company_name(val)
                    elif col == "numero_empleados":
                        try: payload[col] = int(val)
                        except ValueError: pass
                    elif col == "facturacion":
                        try: payload[col] = float(val)
                        except ValueError: pass
                    else: payload[col] = val

            # Resolve readable names (In-memory/Read-only for preview)
            sector_ids, vertical_ids, product_ids = [], [], []
            if mapped.get("sector_name"):
                sector = await sector_service.get_or_create(session, mapped["sector_name"], auto_create=(mode=="commit"))
                if sector: sector_ids = [sector.id]
            if mapped.get("vertical_name"):
                vertical = await vertical_service.get_or_create(session, mapped["vertical_name"], auto_create=(mode=="commit"))
                if vertical: vertical_ids = [vertical.id]
            if mapped.get("product_name"):
                product = await product_service.get_or_create(session, mapped["product_name"], auto_create=(mode=="commit"))
                if product: product_ids = [product.id]

            data = EmpresaCreate(**payload, sector_ids=sector_ids, vertical_ids=vertical_ids, product_ids=product_ids)

            if mode == "preview":
                # Logic Replay
                existing = await empresa_service.resolve_empresa(session, cif=data.cif, web=data.web, empresa_nombre=data.nombre, auto_create=False)
                if existing:
                    summary["to_update"] += 1
                else:
                    summary["to_create"] += 1
                    summary["empresa_preview"].append(EmpresaPreview(name=data.nombre, action="would_create"))
                continue

            # Commit Mode
            empresa, action = await empresa_service.upsert_empresa(session, data)
            if action == "created":
                summary["to_create"] += 1
            elif action == "updated":
                summary["to_update"] += 1
            
            m2m_sync_queue.append((empresa, data))

        except Exception as e:
            if mode == "commit": await session.rollback()
            summary["skipped"] += 1
            summary["skip_details"].append(SkipDetail(row=row_idx, reason=str(e)))
            logger.error(f"Empresa row {row_idx}: {str(e)}")

    if mode == "commit":
        await session.flush()
        for emp, data_in in m2m_sync_queue:
            await empresa_mapper._sync_empresa_m2m(session, emp.id, data_in.sector_ids, data_in.vertical_ids, data_in.product_ids)

    return ImportSummary(**summary)
