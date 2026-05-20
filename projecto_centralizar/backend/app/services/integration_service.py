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
from app.services.contact_filters import apply_contact_filters
from app.core.webhook_client import webhook_client
from app.services.affino_export_mapper import map_contacts_to_affino_payload
from app.services.validators import get_validator, ToolValidationErrorException
from app.schemas.tool import ToolExecutionRequest, ToolExecutionResponse, ToolKey, ToolValidationError

logger = logging.getLogger(__name__)


async def prepare_contact_tool(
    db: AsyncSession,
    request: ToolExecutionRequest,
    user_id: Optional[int] = None,
    account_id: Optional[int] = None,
) -> dict:
    """
    Phase 1 (synchronous): Validate request, log intent, and prepare payload & headers.
    Returns context dict with ONLY serializable primitives for the background webhook task.
    """
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
        apply_filters_fn=apply_contact_filters,
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
        return {
            "status": "idempotency",
            "response": ToolExecutionResponse(
                run_id=run_id,
                status=existing_log.status,
                message="Esta ejecución ya fue procesada anteriormente."
            )
        }

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

        # X-User-ID is resolved exclusively from affino_accounts table
        if account_id:
            from app.models.affino_account import AffinoAccount
            account = await db.get(AffinoAccount, account_id)
            if not account:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cuenta Affino con id={account_id} no encontrada."
                )
            headers["X-User-ID"] = account.x_user_id
        else:
            raise HTTPException(
                status_code=400,
                detail="No hay cuenta Affino configurada. Añade una en APIs & Webhooks."
            )

    # 6. Map Payload (Dispatch based on tool_key)
    if request.tool_key == ToolKey.AFFINO:
        payload = map_contacts_to_affino_payload(contacts, run_id, request.tool_key.value)
    else:
        # Fallback for other tools if not yet migrated to new engine
        log_entry.status = "failed"
        log_entry.error_log = f"No mapper implemented for {request.tool_key}"
        await db.commit()
        raise HTTPException(status_code=501, detail=f"Mapeador no implementado para '{request.tool_key.value}'.")

    return {
        "status": "queued",
        "run_id": str(run_id),
        "webhook_url": webhook_url,
        "payload": payload,
        "headers": headers,
        "tool_key": request.tool_key.value,
        "total": len(contacts),
    }


async def execute_contact_tool_background(context: dict) -> None:
    """
    Phase 1 (background): Execute webhook and update DB states in background.
    Uses a clean AsyncSessionLocal to load and update logs, preventing DetachedInstanceError.
    """
    from app.database import AsyncSessionLocal
    from app.models.enrichment_log import IntegrationLog
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
            
            log_entry = await db.get(IntegrationLog, UUID(context["run_id"]))
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
            logger.error(f"Error in execute_contact_tool_background for run {context.get('run_id')}: {e}", exc_info=True)
            duration = int((time.time() - start_time) * 1000)
            try:
                log_entry = await db.get(IntegrationLog, UUID(context["run_id"]))
                if log_entry:
                    log_entry.status = "failed"
                    log_entry.error_log = f"Internal background exception: {str(e)}"
                    if log_entry.metrics:
                        log_entry.metrics["duration_ms"] = duration
                await db.commit()
            except Exception as db_err:
                logger.error(f"Could not write failure state to DB in execute_contact_tool_background: {db_err}", exc_info=True)
        finally:
            await db.close()


async def execute_contact_tool(
    db: AsyncSession,
    request: ToolExecutionRequest,
    user_id: Optional[int] = None,
    account_id: Optional[int] = None,
) -> ToolExecutionResponse:
    """
    Synchronous fallback wrapper for executing external contact tools.
    """
    res = await prepare_contact_tool(db, request, user_id=user_id, account_id=account_id)
    if res.get("status") == "idempotency":
        return res["response"]
    
    # We call background logic directly in sync context
    await execute_contact_tool_background(res)
    return ToolExecutionResponse(
        run_id=request.enrichment_run_id,
        status="sent",
        message="Ejecución iniciada con éxito (síncrona)."
    )
