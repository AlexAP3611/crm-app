import logging
from typing import Literal, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.schemas.contact import ContactCreate
from app.schemas.empresa import EmpresaCreate
from app.schemas.import_schema import (
    ImportSummary, SkipDetail, EmpresaPreview, CargoPreview, CampaignPreview,
    SectorPreview, VerticalPreview, ProductPreview
)
from app.services import (
    contact_service, empresa_service, sector_service, 
    vertical_service, product_service, cargo_service, campaign_service
)
from app.core.utils import normalize_web, normalize_company_name
from app.core.view_fields.contact_view_fields import CONTACT_VIEW_FIELDS
from app.core.view_fields.empresa_view_fields import EMPRESA_VIEW_FIELDS
from app.domain.relations import M2M_FIELD_MAP, EMPRESA_M2M_FIELD_MAP
from app.core.domain_mappers.empresa_mapper import normalize_empresa_row
from app.core.domain_mappers.contact_mapper import normalize_contact_row

logger = logging.getLogger(__name__)


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

def has_contact_identifier(row: dict) -> bool:
    """
    Deterministic check: contact must have at least one valid identity channel.
    """
    email = row.get("email")
    phone = row.get("phone")
    linkedin = row.get("linkedin")
    return bool(email or phone or linkedin)


# ══════════════════════════════════════════════════════════════════════
# EMPRESA RESOLUTION — Name-only (architectural decision)
# ══════════════════════════════════════════════════════════════════════

async def resolve_empresa_for_contact(
    session: AsyncSession, row: dict, mode: str = "commit",
    empresa_cache: dict | None = None,
) -> tuple[int | None, str | None]:
    """
    Resolves empresa ONLY by name.
    CIF/web are NOT used for resolution (architectural decision).
    
    Returns (empresa_id, preview_name_if_would_create).
    Uses empresa_cache (keyed by lowered normalized name) to avoid N+1 queries.
    """
    emp_name = row.get("empresa_nombre")

    if not emp_name or not is_valid_name(emp_name):
        return None, None

    # Cache key: lowered normalized company name
    cache_key = normalize_company_name(emp_name).lower()

    # Check cache first
    if empresa_cache is not None and cache_key in empresa_cache:
        return empresa_cache[cache_key]

    # Single entry point: resolve_empresa handles search + create + race conditions
    resolution = await empresa_service.resolve_empresa(
        session,
        empresa_nombre=emp_name,
        auto_create=(mode == "commit"),
    )

    if resolution:
        result = (resolution.empresa.id, None)
        if empresa_cache is not None:
            empresa_cache[cache_key] = result
        return result

    # Preview mode: empresa would be created
    if mode == "preview":
        result = (None, emp_name)
        if empresa_cache is not None:
            empresa_cache[cache_key] = result
        return result

    result = (None, None)
    if empresa_cache is not None:
        empresa_cache[cache_key] = result
    return result


# ══════════════════════════════════════════════════════════════════════
# CONTACT IMPORT PIPELINE — 6-stage intelligent ingestion
# ══════════════════════════════════════════════════════════════════════

async def import_contacts_from_rows(
    session: AsyncSession, 
    rows: list[dict], 
    mode: Literal["commit", "preview"] = "commit"
) -> ImportSummary:
    """
    Intelligent CRM ingestion pipeline for contacts.
    
    6-stage pipeline per row:
      0. Normalize   → Translate aliases to canonical fields
      1. Validate    → Require at least one identity channel (email/phone/linkedin)
      2. Empresa     → Resolve or create by name only
      3. Cargo       → Resolve or create via cargo_service (enrichment)
      4. Campaign    → Resolve or create by name (not IDs)
      5. Upsert      → Create or update contact with all resolved references
    
    Modes:
      - "commit":  Persists all changes to database
      - "preview": Zero DB writes, returns impact summary
    
    Caches:
      - empresa_cache: dict[normalized_name, (empresa_id, preview_name)]
      - cargo_cache:   dict[normalized_name, Cargo] (caller-owned, service-populated)
      - campaign_cache: dict[normalized_name, Campaign | None]
    """
    summary = {
        "total_rows": len(rows),
        "to_create": 0,
        "to_update": 0,
        "skipped": 0,
        "skip_details": [],
        "empresa_preview": [],
        "cargo_preview": [],
        "campaign_preview": [],
    }

    # ── Batch caches (eliminates N+1 queries) ──
    empresa_cache: dict[str, tuple[int | None, str | None]] = {}
    campaign_cache: dict[str, object] = {}  # normalized_name → Campaign | None

    # ── Cargo: pre-collect raw titles, batch prefill from DB ──
    all_cargo_names: set[str] = set()
    for row in rows:
        normalized = normalize_contact_row(row)
        cargo = normalized.get("cargo")
        if cargo and cargo.strip():
            all_cargo_names.add(cargo)

    cargo_cache = await cargo_service.prefill_cargo_cache(session, all_cargo_names)

    # Track entities that would be created in this batch (for preview dedup)
    preview_new_empresas: set[str] = set()
    preview_new_cargos: set[str] = set()
    preview_new_campaigns: set[str] = set()

    for row_idx, row in enumerate(rows):
        try:
            # ── Stage 0: Normalize Row ──
            # Translates external column names to canonical fields via CONTACT_ALIASES
            row = normalize_contact_row(row)

            # ── Stage 1: Identity Check ──
            if not has_contact_identifier(row):
                summary["skipped"] += 1
                summary["skip_details"].append(
                    SkipDetail(row=row_idx, reason="Missing email, phone, or linkedin")
                )
                continue

            # ── Stage 2: Empresa Resolution (name-only, cached) ──
            empresa_id, new_emp_name = await resolve_empresa_for_contact(
                session, row, mode=mode, empresa_cache=empresa_cache
            )
            
            if mode == "preview":
                if new_emp_name:
                    if new_emp_name not in preview_new_empresas:
                        preview_new_empresas.add(new_emp_name)
                        summary["empresa_preview"].append(
                            EmpresaPreview(name=new_emp_name, action="would_create")
                        )
                elif not empresa_id:
                    # No empresa data or invalid name — still allow contact creation
                    pass
            else:
                # Commit mode: empresa_id may be None if no empresa data provided
                # This is acceptable — contacts can exist without empresa
                pass

            # ── Stage 3: Cargo Resolution (cached, no internal imports) ──
            cargo_id = None
            cargo_name = row.get("cargo")
            if cargo_name:
                if mode == "commit":
                    # Caller-owned cache passed to service (DI pattern)
                    cargo_obj = await cargo_service.get_or_create_cargo(
                        session, cargo_name, cache=cargo_cache
                    )
                    if cargo_obj:
                        cargo_id = cargo_obj.id
                elif mode == "preview":
                    # Use public normalize API + prefilled cache (no _get_canonical_name)
                    norm_cargo = cargo_service.normalize_cargo_name(cargo_name)
                    if norm_cargo and norm_cargo not in preview_new_cargos:
                        existing = cargo_cache.get(norm_cargo)
                        preview_new_cargos.add(norm_cargo)
                        summary["cargo_preview"].append(
                            CargoPreview(
                                name=cargo_name,
                                action="exists" if existing else "would_create"
                            )
                        )

            # ── Stage 4: Campaign Resolution (by name, cached) ──
            campaign_ids = []
            campaign_name = row.get("campaña")
            if campaign_name:
                cache_key = campaign_service.normalize_name(campaign_name).lower()

                if mode == "commit":
                    if cache_key in campaign_cache:
                        campaign_obj = campaign_cache[cache_key]
                    else:
                        campaign_obj = await campaign_service.get_or_create(session, campaign_name)
                        campaign_cache[cache_key] = campaign_obj
                    if campaign_obj:
                        campaign_ids = [campaign_obj.id]

                elif mode == "preview":
                    if cache_key in campaign_cache:
                        existing_campaign = campaign_cache[cache_key]
                    else:
                        existing_campaign = await campaign_service.get_by_name(session, campaign_name)
                        campaign_cache[cache_key] = existing_campaign

                    if cache_key not in preview_new_campaigns:
                        preview_new_campaigns.add(cache_key)
                        summary["campaign_preview"].append(
                            CampaignPreview(
                                name=campaign_name,
                                action="exists" if campaign_cache[cache_key] else "would_create"
                            )
                        )

            # ── Stage 5: Build Payload & Upsert Contact ──
            payload = {}
            if empresa_id:
                payload["empresa_id"] = empresa_id

            for col in CONTACT_VIEW_FIELDS:
                val = row.get(col)
                if val is not None and val != "":
                    payload[col] = val

            if cargo_id:
                payload["cargo_id"] = cargo_id
            
            # Pass cargo name as job_title for upsert_contact's internal cargo resolution
            if cargo_name and not cargo_id:
                payload["job_title"] = cargo_name

            data = ContactCreate(**payload, campaign_ids=campaign_ids, merge_lists=True)

            if mode == "preview":
                existing = await contact_service.resolve_contact(session, data)
                if existing:
                    summary["to_update"] += 1
                else:
                    summary["to_create"] += 1
                continue

            # Commit Mode: Persist
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

    return ImportSummary(**summary)


async def import_empresas_from_rows(
    session: AsyncSession, 
    rows: list[dict],
    mode: Literal["commit", "preview"] = "commit"
) -> ImportSummary:
    """
    Robust Empresa import pipeline.
    
    Stages:
      0. Pre-collect raw M2M names (Sectors, Verticals, Products)
      1. Batch Prefill caches for M2M entities
      2. Processing Loop:
         - Normalize row
         - Resolve M2M entities via caches
         - Resolve or Upsert Empresa
         - Handle M2M direct assignment
         - Preview impact tracking
      3. Commit / Rollback
    """
    summary = {
        "total_rows": len(rows),
        "to_create": 0,
        "to_update": 0,
        "skipped": 0,
        "skip_details": [],
        "empresa_preview": [],
        "sector_preview": [],
        "vertical_preview": [],
        "product_preview": [],
    }
    
    # ── Stage 0: Pre-collection ──
    raw_sectors = set()
    raw_verticals = set()
    raw_products = set()
    
    for row in rows:
        mapped = normalize_empresa_row(row)
        if s := mapped.get("sector_name"): raw_sectors.add(s)
        if v := mapped.get("vertical_name"): raw_verticals.add(v)
        if p := mapped.get("product_name"): raw_products.add(p)

    # ── Stage 1: Batch Prefill ──
    sector_cache = await sector_service.prefill_sector_cache(session, raw_sectors)
    vertical_cache = await vertical_service.prefill_vertical_cache(session, raw_verticals)
    product_cache = await product_service.prefill_product_cache(session, raw_products)

    # Track new entities for preview
    preview_new_empresas = set()
    preview_new_sectors = set()
    preview_new_verticals = set()
    preview_new_products = set()

    # ── Stage 2: Processing Loop ──
    for row_idx, row in enumerate(rows):
        try:
            # Use savepoints for commit mode to keep it atomic per row
            savepoint = await session.begin_nested() if mode == "commit" else None
            
            mapped = normalize_empresa_row(row)
            nombre = mapped.get("nombre")
            
            if not is_valid_name(nombre):
                summary["skipped"] += 1
                summary["skip_details"].append(SkipDetail(row=row_idx, reason="Missing or invalid 'nombre'"))
                continue

            # Resolve M2M entities (get-or-create using cache)
            resolved_sectors = []
            if s_name := mapped.get("sector_name"):
                if mode == "commit":
                    sector = await sector_service.get_or_create(session, s_name, cache=sector_cache)
                    if sector: resolved_sectors = [sector]
                
                if mode == "preview":
                    key = sector_service.normalize_name(s_name).lower()
                    if key not in preview_new_sectors:
                        preview_new_sectors.add(key)
                        existing = key in sector_cache
                        if not existing:
                            # DB lookup without create
                            existing_obj = await sector_service.prefill_sector_cache(session, {s_name})
                            existing = bool(existing_obj)
                        summary["sector_preview"].append(SectorPreview(name=s_name, action="exists" if existing else "would_create"))

            resolved_verticals = []
            if v_name := mapped.get("vertical_name"):
                if mode == "commit":
                    vertical = await vertical_service.get_or_create(session, v_name, cache=vertical_cache)
                    if vertical: resolved_verticals = [vertical]
                
                if mode == "preview":
                    key = vertical_service.normalize_name(v_name).lower()
                    if key not in preview_new_verticals:
                        preview_new_verticals.add(key)
                        existing = key in vertical_cache
                        if not existing:
                            existing_obj = await vertical_service.prefill_vertical_cache(session, {v_name})
                            existing = bool(existing_obj)
                        summary["vertical_preview"].append(VerticalPreview(name=v_name, action="exists" if existing else "would_create"))

            resolved_products = []
            if p_name := mapped.get("product_name"):
                if mode == "commit":
                    product = await product_service.get_or_create(session, p_name, cache=product_cache)
                    if product: resolved_products = [product]
                
                if mode == "preview":
                    key = product_service.normalize_name(p_name).lower()
                    if key not in preview_new_products:
                        preview_new_products.add(key)
                        existing = key in product_cache
                        if not existing:
                            existing_obj = await product_service.prefill_product_cache(session, {p_name})
                            existing = bool(existing_obj)
                        summary["product_preview"].append(ProductPreview(name=p_name, action="exists" if existing else "would_create"))

            # Build Empresa Payload
            # Note: We pass scalar fields. M2M is handled via direct relationship assignment after resolution.
            payload = {}
            for col in EMPRESA_VIEW_FIELDS:
                val = mapped.get(col)
                if val is not None and val != "":
                    if col == "web": payload[col] = normalize_web(val)
                    elif col == "nombre": payload[col] = normalize_company_name(val)
                    else: payload[col] = val

            data = EmpresaCreate(**payload)

            if mode == "preview":
                resolution = await empresa_service.resolve_empresa(session, cif=data.cif, web=data.web, empresa_nombre=data.nombre, auto_create=False)
                if resolution:
                    summary["to_update"] += 1
                else:
                    summary["to_create"] += 1
                    if data.nombre not in preview_new_empresas:
                        preview_new_empresas.add(data.nombre)
                        summary["empresa_preview"].append(EmpresaPreview(name=data.nombre, action="would_create"))
                continue

            # Commit Mode: Upsert + Direct Relationship Sync
            empresa, action = await empresa_service.upsert_empresa(session, data)
            
            # Idempotent M2M sync via SQLAlchemy relationships
            if resolved_sectors: empresa.sectors = resolved_sectors
            if resolved_verticals: empresa.verticals = resolved_verticals
            if resolved_products: empresa.products_rel = resolved_products
            
            if action == "created":
                summary["to_create"] += 1
            elif action == "updated":
                summary["to_update"] += 1

        except Exception as e:
            if mode == "commit" and savepoint:
                await savepoint.rollback()
            summary["skipped"] += 1
            summary["skip_details"].append(SkipDetail(row=row_idx, reason=str(e)))
            logger.error(f"Empresa row {row_idx} failed: {e}")

    if mode == "commit":
        try:
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Empresa import final commit failed: {e}")
            raise

    return ImportSummary(**summary)
