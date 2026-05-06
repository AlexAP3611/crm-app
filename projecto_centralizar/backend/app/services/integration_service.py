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
from app.models.enrichment_log import IntegrationLog
from app.models.setting import Setting
from app.services.scope import apply_scope
from app.core.webhook_client import webhook_client
from app.services.affino_export_mapper import map_contacts_to_affino_payload
from app.services.validators import get_validator, ToolValidationErrorException
from app.schemas.tool import ToolExecutionRequest, ToolExecutionResponse, ToolKey, ToolValidationError

logger = logging.getLogger(__name__)

def _apply_contact_filters(query, filters):
    """
    Helper to apply contact filters.
    Duplicate of logic in enrichment_service.py (to be cleaned up later).
    """
    if not filters:
        return query
    
    if filters.vertical_id:
        query = query.join(Contact.empresa_rel).filter(Empresa.vertical_id == filters.vertical_id)
    if filters.sector_id:
        # Assuming M2M sectors on Empresa
        query = query.join(Contact.empresa_rel).join(Empresa.sectors).filter(Empresa.sectors.any(id=filters.sector_id))
    if filters.product_id:
        query = query.join(Contact.empresa_rel).join(Empresa.products_rel).filter(Empresa.products_rel.any(id=filters.product_id))
    if filters.campaign_id:
        query = query.join(Contact.campaigns).filter(Contact.campaigns.any(id=filters.campaign_id))
    
    return query

async def execute_contact_tool(
    db: AsyncSession,
    request: ToolExecutionRequest,
    user_id: Optional[int] = None
) -> ToolExecutionResponse:
    """
    Central Hub for executing external contact tools (Affino, Clay, etc.)
    """
    start_time = time.time()
    
    # 1. Resolve Contacts
    query = select(Contact).options(
        joinedload(Contact.empresa_rel).selectinload(Empresa.sectors),
        joinedload(Contact.empresa_rel).selectinload(Empresa.verticals),
        joinedload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        selectinload(Contact.cargo),
        selectinload(Contact.campaigns)
    )
    query = apply_scope(
        query, model=Contact,
        ids=request.ids, filters=request.filters,
        apply_filters_fn=_apply_contact_filters,
        allow_all=request.all is True,
    )

    result = await db.execute(query)
    contacts = list(result.scalars().unique().all())

    if not contacts:
        raise HTTPException(status_code=400, detail="No se encontraron contactos para procesar.")

    # 1.5. Validate (Delegated)
    validator = get_validator(request.tool_key)
    if validator:
        invalid_entities = await validator.validate(contacts)
        if invalid_entities:
            raise ToolValidationErrorException(ToolValidationError(
                error_code=f"{request.tool_key.value.upper()}_VALIDATION_FAILED",
                message=f"No se puede iniciar la ejecución: {len(invalid_entities)} contactos no cumplen los requisitos para {request.tool_key.value}.",
                invalid_entities=invalid_entities,
                blocking=True
            ))

    # 2. Idempotency Check
    run_id = request.enrichment_run_id
    existing_log = await db.get(IntegrationLog, run_id)
    if existing_log:
        return ToolExecutionResponse(
            run_id=run_id,
            status=existing_log.status,
            message="Esta ejecución ya fue procesada anteriormente."
        )

    # 3. Log Intent
    log_entry = IntegrationLog(
        run_id=run_id,
        tool=request.tool_key.value,
        status="pending",
        user_id=user_id,
        metrics={"total": len(contacts), "sent": 0}
    )
    db.add(log_entry)
    await db.commit()

    # 4. Resolve Webhook/Config
    setting_key = f"ext_config_{request.tool_key.value.lower()}"
    res = await db.execute(select(Setting).where(Setting.key == setting_key))
    setting = res.scalar_one_or_none()
    
    if not setting:
        log_entry.status = "failed"
        log_entry.error_log = f"Config not found: {setting_key}"
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Configuración no encontrada para la herramienta '{request.tool_key.value}'.")

    cfg = setting.value if isinstance(setting.value, dict) else {}
    webhook_url = cfg.get("webhook_url") or cfg.get("apiKey")
    
    if not webhook_url:
        log_entry.status = "failed"
        log_entry.error_log = "Webhook URL missing."
        await db.commit()
        raise HTTPException(status_code=400, detail=f"La herramienta '{request.tool_key.value}' no tiene una URL o API Key válida.")

    # 5. Prepare Headers
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

    # 6. Map Payload (Dispatch based on tool_key)
    if request.tool_key == ToolKey.AFFINO:
        payload = map_contacts_to_affino_payload(contacts, run_id, request.tool_key.value)
    else:
        # Fallback for other tools if not yet migrated to new engine
        log_entry.status = "failed"
        log_entry.error_log = f"No mapper implemented for {request.tool_key}"
        await db.commit()
        raise HTTPException(status_code=501, detail=f"Mapeador no implementado para '{request.tool_key.value}'.")

    # 7. Dispatch
    try:
        response = await webhook_client.send_payload(webhook_url, payload, request.tool_key.value, headers=headers)
        duration = int((time.time() - start_time) * 1000)
        
        if response.is_success:
            log_entry.status = "success"
            log_entry.metrics = {
                "total": len(contacts), 
                "sent": len(contacts), 
                "duration_ms": duration
            }
            await db.commit()
            
            return ToolExecutionResponse(
                run_id=run_id,
                status="success",
                message=f"Ejecución de {request.tool_key.value} completada con éxito."
            )
        else:
            log_entry.status = "failed"
            log_entry.error_log = f"Webhook status {response.status_code}: {response.text[:500]}"
            log_entry.metrics["duration_ms"] = duration
            await db.commit()
            raise HTTPException(status_code=424, detail=f"La herramienta {request.tool_key.value} falló (Status {response.status_code}).")

    except Exception as e:
        if isinstance(e, HTTPException): raise e
        duration = int((time.time() - start_time) * 1000)
        log_entry.status = "failed"
        log_entry.error_log = f"Execution error: {str(e)}"
        log_entry.metrics["duration_ms"] = duration
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Error al ejecutar la herramienta: {str(e)}")
