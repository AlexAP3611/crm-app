import logging
from typing import Literal, List
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.importer.coordinator import PipelineCoordinator
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


def _clean_import_value(v):
    """Sanitizes raw CSV/Excel values to prevent Pydantic validation crashes."""
    if v is None: return None
    if isinstance(v, str) and v.strip() == "": return None
    # Handle common Excel/Pandas "NaN" leakage
    if str(v).lower() in ["nan", "null", "none"]: return None
    return v

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


async def import_empresas_v3(
    session: AsyncSession,
    rows: List[dict],
    mode: Literal["preview", "commit"] = "preview"
):
    """
    Modular Ingestion Pipeline (v3.1).
    Transaction management is handled internally by the Coordinator using Savepoints.
    """
    coordinator = PipelineCoordinator(session, mode=mode)
    result = await coordinator.ingest_empresas(rows)
    return result
