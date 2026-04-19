import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.schemas.contact import ContactCreate
from app.schemas.empresa import EmpresaCreate
from app.services import contact_service, empresa_service, empresa_mapper
from app.core.utils import normalize_web, normalize_company_name
from app.core.field_mapping import CORE_COLUMNS, M2M_FIELD_MAP, EMPRESA_CORE_COLUMNS, EMPRESA_M2M_FIELD_MAP

logger = logging.getLogger(__name__)

async def import_contacts_from_rows(session: AsyncSession, rows: list[dict]) -> dict[str, int]:
    created = 0
    updated = 0
    skipped = 0

    for row_idx, row in enumerate(rows):
        try:
            # 1. Resolve Empresa
            empresa_id = None
            emp_id_raw = row.get("empresa_id")
            emp_name = row.get("empresa_nombre") or row.get("empresa")
            
            if emp_id_raw:
                try:
                    empresa_id = int(emp_id_raw)
                except ValueError:
                    pass
            elif emp_name:
                # Semantic auto-resolution. email is NOT used.
                resolution = await empresa_service.resolve_empresa(
                    session,
                    empresa_nombre=emp_name,
                    auto_create=True
                )
                if resolution:
                    empresa_id = resolution.empresa.id
            
            if not empresa_id:
                skipped += 1
                logger.warning(f"Row {row_idx}: Skipped due to missing/unresolvable Empresa info.")
                continue

            # 2. Build Payload
            payload = {"empresa_id": empresa_id}
            
            cargo_id_raw = row.get("cargo_id")
            if cargo_id_raw:
                try: payload["cargo_id"] = int(cargo_id_raw)
                except ValueError: pass

            for col in CORE_COLUMNS:
                val = row.get(col)
                if val is not None and val != "":
                    payload[col] = val
                    
            for m2m_key in M2M_FIELD_MAP.keys():
                val = row.get(m2m_key)
                if val:
                    try:
                        payload[m2m_key] = [int(x.strip()) for x in str(val).split(",") if x.strip()]
                    except Exception:
                        pass

            data = ContactCreate(**payload)
            
            # 3. Call Service
            contact, action = await contact_service.upsert_contact(session, data, auto_commit=False)
            
            # 4. Immediate Constraint Check
            await session.flush()

            if action == "created":
                created += 1
            elif action == "updated":
                updated += 1
            else:
                skipped += 1

        except Exception as e:
            await session.rollback()
            skipped += 1
            logger.error(f"Failed to import contact row {row_idx} ({row.get('email', 'N/A')}): {str(e)}")

    await session.commit()
    return {"created": created, "updated": updated, "skipped": skipped}


async def import_empresas_from_rows(session: AsyncSession, rows: list[dict]) -> dict[str, int]:
    created = 0
    updated = 0
    skipped = 0

    for row_idx, row in enumerate(rows):
        try:
            nombre = row.get("nombre")
            if not nombre:
                skipped += 1
                logger.warning(f"Row {row_idx}: Skipped due to missing 'nombre'.")
                continue

            # 1. Build Payload
            payload = {}
            for col in EMPRESA_CORE_COLUMNS:
                val = row.get(col)
                if val is not None and val != "":
                    if col == "web":
                        payload[col] = normalize_web(val)
                    elif col == "nombre":
                        payload[col] = normalize_company_name(val)
                    elif col == "numero_empleados":
                        try: payload[col] = int(val)
                        except ValueError: pass
                    elif col == "facturacion":
                        try: payload[col] = float(val)
                        except ValueError: pass
                    else:
                        payload[col] = val

            for m2m_key in EMPRESA_M2M_FIELD_MAP.keys():
                val = row.get(m2m_key)
                if val:
                    try:
                        payload[m2m_key] = [int(x.strip()) for x in str(val).split(",") if x.strip()]
                    except Exception:
                        pass

            data = EmpresaCreate(**payload)

            # 2. Call Domain Service (state base only)
            empresa, action = await empresa_service.upsert_empresa(session, data)
            
            # 3. Sync M2M in Application Layer
            await empresa_mapper._sync_empresa_m2m(session, empresa, data.sector_ids, data.vertical_ids, data.product_ids)
            
            # 4. Immediate Check per row
            await session.flush()

            if action == "created":
                created += 1
            elif action == "updated":
                updated += 1
            else:
                skipped += 1

        except Exception as e:
            await session.rollback()
            skipped += 1
            logger.error(f"Failed to import empresa row {row_idx} ({row.get('nombre', 'N/A')}): {str(e)}")

    await session.commit()
    return {"created": created, "updated": updated, "skipped": skipped}
