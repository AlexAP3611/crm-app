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
    """Blocks placeholder names like N/A, Unknown, etc. to prevent DB pollution."""
    if not name:
        return False
    placeholders = {"n/a", "unknown", "desconocido", "desconocida", "-", "."}
    return name.strip().lower() not in placeholders

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

async def import_contacts_from_rows(session: AsyncSession, rows: list[dict]) -> dict[str, int]:
    created = 0
    updated = 0
    skipped = 0

    for row_idx, row in enumerate(rows):
        try:
            # 1. Resolve Empresa
            empresa_id = None
            emp_id_raw = row.get("empresa_id")
            
            # Extract resolution candidates
            emp_name = safe_str(row.get("empresa_nombre") or row.get("empresa"))
            emp_cif = safe_str(row.get("empresa_cif"))
            emp_web = safe_str(row.get("empresa_web"))
            
            if emp_id_raw:
                try:
                    empresa_id = int(emp_id_raw)
                except ValueError:
                    pass

            if not empresa_id and (emp_cif or emp_web or emp_name):
                # Only attempt creation if name is valid
                auto_create = is_valid_name(emp_name)
                
                resolution = await empresa_service.resolve_empresa(
                    session,
                    cif=emp_cif,
                    web=emp_web,
                    empresa_nombre=emp_name,
                    auto_create=auto_create
                )
                
                if resolution:
                    # Strict consistency check
                    if STRICT_IMPORT and resolution.matched_by != "new":
                        emp = resolution.empresa
                        # If we matched by CIF, but Names are provided and different, warn or skip
                        if emp_cif and emp.cif == emp_cif.strip():
                            if emp_name and normalize_company_name(emp.nombre).lower() != normalize_company_name(emp_name).lower():
                                logger.warning(f"Row {row_idx}: Potential mismatch. Row Name '{emp_name}' != DB Name '{emp.nombre}' for CIF {emp_cif}. Using DB entity.")

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

            for col in CONTACT_VIEW_FIELDS:
                val = row.get(col)
                if val is not None and val != "":
                    payload[col] = val
                    
            for m2m_key, config in M2M_FIELD_MAP.items():
                val = row.get(m2m_key)
                if val:
                    try:
                        # Append strategy: merge with existing (handled by upsert logic if from_enrichment=True or similar, 
                        # but here we pass it to ContactCreate which goes to upsert_contact)
                        payload[m2m_key] = [int(x.strip()) for x in str(val).split(",") if x.strip()]
                        payload["merge_lists"] = True # Explicitly signal non-destructive merge
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

    try:
        for row_idx, row in enumerate(rows):
            try:
                # 1. Map row keys to internal field names
                mapped = normalize_empresa_row(row)
                
                nombre = mapped.get("nombre")
                if not is_valid_name(nombre):
                    skipped += 1
                    logger.warning(f"Row {row_idx}: Skipped due to missing or invalid 'nombre' (placeholder detection). Original row: {row}")
                    continue

                # 2. Build Payload
                payload = {}
                
                # Core columns mapping
                for col in EMPRESA_VIEW_FIELDS:
                    val = mapped.get(col)
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

                # 3. Resolve human-readable names to IDs (Sectors, Verticals, Products)
                if mapped.get("sector_name"):
                    sector = await sector_service.resolve_by_name(session, mapped["sector_name"])
                    if sector:
                        payload["sector_ids"] = [sector.id]
                
                if mapped.get("vertical_name"):
                    vertical = await vertical_service.resolve_by_name(session, mapped["vertical_name"])
                    if vertical:
                        payload["vertical_ids"] = [vertical.id]
                        
                if mapped.get("product_name"):
                    product = await product_service.resolve_by_name(session, mapped["product_name"])
                    if product:
                        payload["product_ids"] = [product.id]

                # 4. Fallback for direct IDs if present
                for m2m_key in EMPRESA_M2M_FIELD_MAP.keys():
                    if m2m_key not in payload: # Don't overwrite if already resolved by name
                        val = mapped.get(m2m_key)
                        if val:
                            try:
                                payload[m2m_key] = [int(x.strip()) for x in str(val).split(",") if x.strip()]
                            except Exception:
                                pass

                # 5. Robust type normalization before validation
                STRING_FIELDS = ["nombre", "phone", "email", "web", "cif", "cnae"]
                for field in STRING_FIELDS:
                    if field in payload:
                        payload[field] = safe_str(payload[field])

                if "numero_empleados" in payload:
                    try:
                        payload["numero_empleados"] = int(payload["numero_empleados"])
                    except (ValueError, TypeError):
                        payload["numero_empleados"] = None

                if "facturacion" in payload:
                    try:
                        payload["facturacion"] = float(payload["facturacion"])
                    except (ValueError, TypeError):
                        payload["facturacion"] = None

                data = EmpresaCreate(**payload)

                # 6. Call Domain Service (state base only)
                empresa, action = await empresa_service.upsert_empresa(session, data)
                
                # 7. IMMEDIATE FLUSH to ensure we have empresa.id for M2M sync
                await session.flush()
                
                # 8. Sync M2M in Application Layer (using explicit ID to avoid ORM traps)
                await empresa_mapper._sync_empresa_m2m(session, empresa.id, data.sector_ids, data.vertical_ids, data.product_ids)
                
                if action == "created":
                    created += 1
                elif action == "updated":
                    updated += 1
                else:
                    skipped += 1

            except Exception as row_error:
                # We log the row error but the outer try-except will catch and rollback the entire batch
                logger.error(f"Error processing empresa row {row_idx}: {row_error}")
                raise row_error

        await session.commit()
        return {"created": created, "updated": updated, "skipped": skipped}

    except Exception as e:
        await session.rollback()
        logger.error(f"Import failed, rolling back entire batch. Error: {str(e)}")
        raise e
