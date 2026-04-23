import time
import logging
from uuid import UUID
from typing import Any, Optional
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contact import Contact
from app.models.empresa import Empresa
from app.models.enrichment_log import EnrichmentLog
from app.models.setting import Setting
from app.models.vertical import Vertical
from app.models.sector import Sector
from app.models.cargo import Cargo
from app.models.campaign import Campaign
from app.models.product import Product
from app.services import sector_service, vertical_service, product_service, campaign_service


from app.services import empresa_service
from app.services.scope import apply_scope
from app.services.empresa_service import _apply_empresa_filters
from app.services.empresa_export_mapper import map_to_export_payload
from app.services.merge import deep_merge

from app.core.webhook_client import webhook_client
from app.core.mappings.contact_field_map import CONTACT_FIELD_MAP
from app.domain.relations import M2M_FIELD_MAP
from app.core.enrichment.rules import ENRICHMENT_PROTECTED_FIELDS

from app.schemas.enrichment import (
    CompanyEnrichRequest, 
    CompanyEnrichErrorResponse, 
    InvalidCompany,
    CompanyEnrichSuccessResponse
)

logger = logging.getLogger(__name__)


# Fields that should never be written from enrichment data
NON_EDITABLE_FIELDS = {"id", "notes", "created_at", "updated_at"}

# Fields handled via special relationship logic (not a plain column write)
RELATION_FIELDS = {"vertical"}

# System fields that identify the contact, not enrichment data
SYSTEM_FIELDS = {"id_contacto"}


async def enrich_contact(
    session: AsyncSession, contact_id: int, source: str, data: dict[str, Any]
) -> Contact | None:
    """
    Merge enrichment data from an external source into contact.notes.
    """
    result = await session.execute(
        select(Contact)
        .options(
            selectinload(Contact.cargo),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        )
        .where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()
    if contact is None:
        return None

    enrichment_payload = {source: data}
    contact.notes = deep_merge(contact.notes, enrichment_payload)
    contact.enriched = True
    contact.enriched_at = datetime.now(timezone.utc)

    await session.commit()
    # Re-load with all M2M relations (refresh() would expire them)
    result2 = await session.execute(
        select(Contact)
        .options(
            selectinload(Contact.cargo),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        )
        .where(Contact.id == contact_id)
    )
    return result2.scalar_one_or_none()


async def enrich_contact_smart(
    session: AsyncSession,
    contact_id: int,
    source: str,
    data: dict[str, Any],
) -> Contact | None:
    """
    Smart enrichment:
    - Dynamically inspects payload against CONTACT_FIELD_MAP
    - Handles M2M relationships dynamically via M2M_FIELD_MAP
    - ALL other fields are stored as strings inside notes[source].
    """
    result = await session.execute(
        select(Contact)
        .options(
            selectinload(Contact.cargo),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        )
        .where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()
    if contact is None:
        return None

    extra_data: dict[str, str] = {}

    for key, value in data.items():
        if key in SYSTEM_FIELDS:
            continue

        if key in M2M_FIELD_MAP:
            config = M2M_FIELD_MAP[key]
            relation_name = config["relation_name"]
            
            if value:
                # Use dedicated services for idempotent resolution
                entity = None
                if config["model"] == "Campaign":
                    entity = await campaign_service.get_or_create(session, str(value))
                elif config["model"] == "Sector":
                    entity = await sector_service.get_or_create(session, str(value))
                elif config["model"] == "Vertical":
                    entity = await vertical_service.get_or_create(session, str(value))
                elif config["model"] == "Product":
                    entity = await product_service.get_or_create(session, str(value))
                
                if entity:
                    current = list(getattr(contact, relation_name, None) or [])
                    if entity not in current:
                        current.append(entity)
                        setattr(contact, relation_name, current)


        elif key in CONTACT_FIELD_MAP:
            db_col = CONTACT_FIELD_MAP[key]
            current_val = getattr(contact, db_col, None)
            if db_col in ENRICHMENT_PROTECTED_FIELDS and current_val:
                # Campo protegido con valor existente → redirigir a notes
                extra_data[f"_enrichment_{db_col}"] = str(value)
            else:
                setattr(contact, db_col, value)

        else:
            # Unknown field → goes into notes[source] as string
            extra_data[key] = str(value)

    if extra_data:
        contact.notes = deep_merge(contact.notes or {}, {source: extra_data})

    contact.enriched = True
    contact.enriched_at = datetime.now(timezone.utc)

    await session.commit()
    # Re-load with all M2M relations (refresh() would expire them)
    result2 = await session.execute(
        select(Contact)
        .options(
            selectinload(Contact.cargo),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        )
        .where(Contact.id == contact_id)
    )
    return result2.scalar_one_or_none()


# --- Company Enrichment Pipeline (Refined) ---

async def trigger_company_enrichment(
    db: AsyncSession,
    request: CompanyEnrichRequest
) -> Any:
    """
    STRICT VALIDATION PIPELINE for Company Enrichment.
    
    Execution Cycle:
    1. Resolve & Validate (Strict web presence)
    2. Abnormal Exit (Return structured MISSING_WEB error)
    3. Idempotency Check (run_id)
    4. Log Intent (status=pending)
    5. Execute Webhook (with retries)
    6. Finalize (Update success/failure states)
    """
    
    # 1. Resolve & Validate
    # ---------------------
    query = select(Empresa).options(
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
    )
    query = apply_scope(
        query, model=Empresa,
        ids=request.ids, filters=request.filters,
        apply_filters_fn=_apply_empresa_filters,
        allow_all=getattr(request, 'all', False) is True,
    )

    result = await db.execute(query)
    empresas = list(result.scalars().unique().all())

    if not empresas:
        raise HTTPException(status_code=400, detail="No se encontraron empresas para enriquecer.")

    invalid_companies = []
    for emp in empresas:
        if not emp.web or not str(emp.web).strip():
            invalid_companies.append(
                InvalidCompany(id=emp.id, nombre=emp.nombre, reason="missing_web")
            )

    # 2. Abnormal Exit (Strict Validation)
    # ------------------------------------
    if invalid_companies:
        return CompanyEnrichErrorResponse(
            error_code="MISSING_WEB",
            message=f"No se puede iniciar el enriquecimiento: {len(invalid_companies)} empresas no tienen web.",
            invalid_companies=invalid_companies,
            blocking=True
        )

    # 3. Idempotency Check
    # --------------------
    run_id = request.enrichment_run_id
    existing_log = await db.get(EnrichmentLog, run_id)
    if existing_log:
        logger.info(f"Idempotency hit for run_id {run_id}. Status: {existing_log.status}")
        return CompanyEnrichSuccessResponse(
            enrichment_run_id=run_id,
            total=existing_log.metrics.get("total", 0),
            sent=existing_log.metrics.get("sent", 0),
            invalid=0
        )

    # 4. Log Intent (PENDING)
    # -----------------------
    log_entry = EnrichmentLog(
        run_id=run_id,
        tool=request.tool_key,
        status="pending",
        metrics={"total": len(empresas), "sent": 0, "invalid": 0}
    )
    db.add(log_entry)
    await db.commit() # Intent persisted before side-effect

    # 5. Execute Webhook
    # ------------------
    # Resolve config
    setting_key = f"ext_config_{request.tool_key.lower()}"
    res = await db.execute(select(Setting).where(Setting.key == setting_key))
    setting = res.scalar_one_or_none()
    
    if not setting:
        log_entry.status = "failed"
        log_entry.error_log = f"Config not found: {setting_key}"
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Configuración de webhook no encontrada para '{request.tool_key}'.")

    cfg = setting.value if isinstance(setting.value, dict) else {}
    webhook_url = cfg.get("webhook_url") or cfg.get("apiKey")
    
    if not webhook_url:
        log_entry.status = "failed"
        log_entry.error_log = "Webhook URL missing."
        await db.commit()
        raise HTTPException(status_code=400, detail=f"La configuración de '{request.tool_key}' no tiene una URL válida.")

    payload = map_to_export_payload(empresas, run_id, request.tool_key)
    
    start_time = time.time()
    try:
        response = await webhook_client.send_payload(webhook_url, payload, request.tool_key)
        duration = int((time.time() - start_time) * 1000)
        
        if response.is_success:
            # 6. Finalize (SUCCESS)
            # --------------------
            log_entry.status = "success"
            log_entry.metrics = {
                "total": len(empresas), 
                "sent": len(empresas), 
                "invalid": 0, 
                "duration_ms": duration
            }
            
            # Update all companies in this run
            emp_ids = [e.id for e in empresas]
            await db.execute(
                update(Empresa)
                .where(Empresa.id.in_(emp_ids))
                .values(
                    last_enriched_at=log_entry.created_at,
                    last_enrichment_tool=request.tool_key,
                    enrichment_status="success"
                )
            )
            await db.commit()
            
            return CompanyEnrichSuccessResponse(
                enrichment_run_id=run_id,
                total=len(empresas),
                sent=len(empresas),
                invalid=0
            )
        else:
            # 6. Finalize (FAILED)
            # --------------------
            log_entry.status = "failed"
            log_entry.error_log = f"Webhook status {response.status_code}: {response.text[:500]}"
            log_entry.metrics["duration_ms"] = duration
            
            await db.execute(
                update(Empresa)
                .where(Empresa.id.in_([e.id for e in empresas]))
                .values(enrichment_status="failed")
            )
            await db.commit()
            raise HTTPException(status_code=424, detail=f"El webhook de {request.tool_key} falló (Status {response.status_code}).")

    except Exception as e:
        if isinstance(e, HTTPException): raise e
        duration = int((time.time() - start_time) * 1000)
        log_entry.status = "failed"
        log_entry.error_log = f"Execution error: {str(e)}"
        log_entry.metrics["duration_ms"] = duration
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Error al ejecutar enriquecimiento: {str(e)}")
