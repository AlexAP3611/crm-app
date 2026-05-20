import time
import logging
from uuid import UUID
from typing import Any, Optional
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.contact import Contact
from app.models.empresa import Empresa
from app.models.enrichment_log import IntegrationLog as EnrichmentLog
from app.models.setting import Setting
from app.models.vertical import Vertical
from app.models.sector import Sector
from app.models.cargo import Cargo
from app.models.campaign import Campaign
from app.models.product import Product
from app.services import sector_service, vertical_service, product_service, campaign_service


from app.services import empresa_service
from app.services.scope import apply_scope
from app.services.contact_filters import apply_contact_filters as _apply_contact_filters
from app.services.validators import get_validator, ToolValidationErrorException
from app.schemas.tool import ToolKey, ToolValidationError
from app.services.empresa_service import _apply_empresa_filters
from app.services.empresa_export_mapper import map_to_export_payload
from app.services.affino_export_mapper import map_contacts_to_affino_payload
from app.services.merge import deep_merge

from app.core.webhook_client import webhook_client
from app.core.mappings.contact_aliases import CONTACT_FIELD_MAP
from app.domain.relations import M2M_FIELD_MAP
from app.core.enrichment.rules import ENRICHMENT_PROTECTED_FIELDS

from app.schemas.enrichment import (
    CompanyEnrichRequest, 
    CompanyEnrichSuccessResponse,
    ContactEnrichRequest,
    ContactEnrichSuccessResponse
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
            selectinload(Contact.empresa_rel).selectinload(Empresa.competidores),
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
            selectinload(Contact.empresa_rel).selectinload(Empresa.competidores),
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
            selectinload(Contact.empresa_rel).selectinload(Empresa.competidores),
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
            selectinload(Contact.empresa_rel).selectinload(Empresa.competidores),
        )
        .where(Contact.id == contact_id)
    )
    return result2.scalar_one_or_none()


# --- Company Enrichment Pipeline (Refined) ---

async def prepare_company_enrichment(
    db: AsyncSession,
    request: CompanyEnrichRequest,
    user_id: Optional[int] = None
) -> dict:
    """
    STRICT VALIDATION PIPELINE for Company Enrichment (Phase 1 síncrona).
    Valida, registra la intención, actualiza el estado a "sent" de forma síncrona y prepara el payload.
    """
    # 1. Resolve & Validate
    # ---------------------
    query = select(Empresa).options(
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
        selectinload(Empresa.competidores),
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

    # 1.5. Validate (Delegated)
    validator = get_validator(request.tool_key)
    if validator:
        invalid_entities = await validator.validate(empresas)
        if invalid_entities:
            is_adscore = request.tool_key == ToolKey.ADSCORE
            error_code = "ADSCORE_VALIDATION_FAILED" if is_adscore else "MISSING_WEB"
            raise ToolValidationErrorException(ToolValidationError(
                error_code=error_code,
                message=f"No se puede iniciar el enriquecimiento: {len(invalid_entities)} empresas no cumplen los requisitos.",
                invalid_entities=invalid_entities,
                blocking=True
            ))

    # 3. Idempotency Check
    # --------------------
    run_id = request.enrichment_run_id
    existing_log = await db.get(EnrichmentLog, run_id)
    if existing_log:
        logger.info(f"Idempotency hit for run_id {run_id}. Status: {existing_log.status}")
        return {
            "status": "idempotency",
            "response": CompanyEnrichSuccessResponse(
                enrichment_run_id=run_id,
                total=existing_log.metrics.get("total", 0),
                sent=existing_log.metrics.get("sent", 0),
                invalid=0
            )
        }

    # 4. Log Intent (PENDING)
    # -----------------------
    log_entry = EnrichmentLog(
        run_id=run_id,
        tool=request.tool_key.value,
        status="pending",
        user_id=user_id,
        metrics={"total": len(empresas), "sent": 0, "invalid": 0}
    )
    db.add(log_entry)
    
    # Update all companies in this run to "sent" synchronously (safe frontend transition)
    emp_ids = [e.id for e in empresas]
    await db.execute(
        update(Empresa)
        .where(Empresa.id.in_(emp_ids))
        .values(
            last_enriched_at=datetime.now(timezone.utc),
            last_enrichment_tool=request.tool_key,
            enrichment_status="sent"
        )
    )
    await db.commit() # Intent persisted before side-effect

    # 5. Resolve config
    setting_key = f"ext_config_{request.tool_key.value.lower()}"
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

    # Prepare Headers
    headers = {}
    auth_type = cfg.get("authType")
    if auth_type == "Bearer Token":
        if cfg.get("token"):
            headers["Authorization"] = f"Bearer {cfg['token']}"
    elif auth_type == "Basic Auth":
        import base64
        user = cfg.get("username", "")
        pwd = cfg.get("password", "")
        auth_str = base64.b64encode(f"{user}:{pwd}".encode()).decode()
        headers["Authorization"] = f"Basic {auth_str}"
    elif auth_type == "Header Auth":
        h_name = cfg.get("headerName")
        h_val = cfg.get("headerValue")
        h_pfx = cfg.get("prefix")
        if h_name and h_val:
            headers[h_name] = f"{h_pfx} {h_val}".strip() if h_pfx else h_val
    elif auth_type == "Affino":
        h_name = cfg.get("headerName") or "Authorization"
        h_val = cfg.get("headerValue")
        h_pfx = cfg.get("prefix") or "Bearer"
        if h_val:
            headers[h_name] = f"{h_pfx} {h_val}".strip()
        if cfg.get("xUserId"):
            headers["X-User-ID"] = str(cfg["xUserId"])

    payload = map_to_export_payload(empresas, run_id, request.tool_key)

    return {
        "status": "queued",
        "run_id": str(run_id),
        "empresa_ids": emp_ids,
        "webhook_url": webhook_url,
        "payload": payload,
        "headers": headers,
        "tool_key": request.tool_key.value,
        "total": len(empresas),
    }


async def execute_webhook_background(context: dict) -> None:
    """
    Phase 1 (background): Realiza la llamada HTTP al webhook y maneja el estado.
    Utiliza una sesión de base de datos aislada y parámetros serializados primitivos
    para evitar DetachedInstanceError.
    """
    from app.database import AsyncSessionLocal
    from app.models.enrichment_log import IntegrationLog as EnrichmentLog
    from app.models.empresa import Empresa
    from sqlalchemy import update
    import time

    start_time = time.time()
    async with AsyncSessionLocal() as db:
        try:
            response = await webhook_client.send_payload(
                context["webhook_url"],
                context["payload"],
                context["tool_key"],
                headers=context["headers"]
            )
            duration = int((time.time() - start_time) * 1000)
            
            # Load log entry from clean session
            log_entry = await db.get(EnrichmentLog, UUID(context["run_id"]))
            if log_entry:
                if response.is_success:
                    log_entry.status = "sent"
                    log_entry.metrics = {
                        "total": context["total"],
                        "sent": context["total"],
                        "invalid": 0,
                        "duration_ms": duration
                    }
                else:
                    log_entry.status = "failed"
                    log_entry.error_log = f"Webhook status {response.status_code}: {response.text[:500]}"
                    log_entry.metrics = {
                        "total": context["total"],
                        "sent": 0,
                        "invalid": 0,
                        "duration_ms": duration
                    }
                    # Reset company status so they are not visually stuck
                    await db.execute(
                        update(Empresa)
                        .where(Empresa.id.in_(context["empresa_ids"]))
                        .values(enrichment_status=None)
                    )
                await db.commit()
        except Exception as e:
            logger.error(f"Error in execute_webhook_background for run {context.get('run_id')}: {e}", exc_info=True)
            duration = int((time.time() - start_time) * 1000)
            try:
                log_entry = await db.get(EnrichmentLog, UUID(context["run_id"]))
                if log_entry:
                    log_entry.status = "failed"
                    log_entry.error_log = f"Internal background exception: {str(e)}"
                    if log_entry.metrics:
                        log_entry.metrics["duration_ms"] = duration
                await db.execute(
                    update(Empresa)
                    .where(Empresa.id.in_(context["empresa_ids"]))
                    .values(enrichment_status=None)
                )
                await db.commit()
            except Exception as db_err:
                logger.error(f"Could not write failure state to DB in execute_webhook_background: {db_err}", exc_info=True)
        finally:
            await db.close()


async def prepare_contact_enrichment(
    db: AsyncSession,
    request: ContactEnrichRequest,
    user_id: Optional[int] = None
) -> dict:
    """
    Export contacts to an external tool (Affino).
    Phase 1 síncrona: resuelve, valida e inicia la transacción del log.
    """
    # 1. Resolve Contacts
    query = select(Contact).options(
        joinedload(Contact.empresa_rel).selectinload(Empresa.sectors),
        joinedload(Contact.empresa_rel).selectinload(Empresa.verticals),
        joinedload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        joinedload(Contact.empresa_rel).selectinload(Empresa.competidores),
        selectinload(Contact.cargo),
        selectinload(Contact.campaigns)
    )
    query = apply_scope(
        query, model=Contact,
        ids=request.ids, filters=request.filters,
        apply_filters_fn=_apply_contact_filters,
        allow_all=getattr(request, 'all', False) is True,
    )

    result = await db.execute(query)
    contacts = list(result.scalars().unique().all())

    if not contacts:
        raise HTTPException(status_code=400, detail="No se encontraron contactos para enviar.")

    # 2. Idempotency Check
    run_id = request.enrichment_run_id
    existing_log = await db.get(EnrichmentLog, run_id)
    if existing_log:
        return {
            "status": "idempotency",
            "response": ContactEnrichSuccessResponse(
                enrichment_run_id=run_id,
                total=existing_log.metrics.get("total", 0),
                sent=existing_log.metrics.get("sent", 0)
            )
        }

    # 3. Log Intent
    log_entry = EnrichmentLog(
        run_id=run_id,
        tool=request.tool_key,
        status="pending",
        user_id=user_id,
        metrics={"total": len(contacts), "sent": 0}
    )
    db.add(log_entry)
    await db.commit()

    # 4. Execute Webhook
    setting_key = f"ext_config_{request.tool_key.value.lower()}"
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

    payload = map_contacts_to_affino_payload(contacts, run_id, request.tool_key)
    
    return {
        "status": "queued",
        "run_id": str(run_id),
        "webhook_url": webhook_url,
        "payload": payload,
        "tool_key": request.tool_key.value,
        "total": len(contacts),
    }


async def execute_contact_webhook_background(context: dict) -> None:
    """
    Phase 1 (background): Dispara la exportación de contactos.
    """
    from app.database import AsyncSessionLocal
    from app.models.enrichment_log import IntegrationLog as EnrichmentLog
    import time

    start_time = time.time()
    async with AsyncSessionLocal() as db:
        try:
            response = await webhook_client.send_payload(
                context["webhook_url"],
                context["payload"],
                context["tool_key"]
            )
            duration = int((time.time() - start_time) * 1000)
            
            log_entry = await db.get(EnrichmentLog, UUID(context["run_id"]))
            if log_entry:
                if response.is_success:
                    log_entry.status = "sent"
                    log_entry.metrics = {
                        "total": context["total"],
                        "sent": context["total"],
                        "duration_ms": duration
                    }
                else:
                    log_entry.status = "failed"
                    log_entry.error_log = f"Webhook status {response.status_code}: {response.text[:500]}"
                    log_entry.metrics = {
                        "total": context["total"],
                        "sent": 0,
                        "duration_ms": duration
                    }
                await db.commit()
        except Exception as e:
            logger.error(f"Error in execute_contact_webhook_background for run {context.get('run_id')}: {e}", exc_info=True)
            duration = int((time.time() - start_time) * 1000)
            try:
                log_entry = await db.get(EnrichmentLog, UUID(context["run_id"]))
                if log_entry:
                    log_entry.status = "failed"
                    log_entry.error_log = f"Internal background exception: {str(e)}"
                    if log_entry.metrics:
                        log_entry.metrics["duration_ms"] = duration
                await db.commit()
            except Exception as db_err:
                logger.error(f"Could not write failure state to DB in execute_contact_webhook_background: {db_err}", exc_info=True)
        finally:
            await db.close()

