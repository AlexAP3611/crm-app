from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field

from app.schemas.tool import ToolExecutionRequest, ToolKey


# ── CRUD Schemas ───────────────────────────────────────────────────────────────

class AffinoAccountCreate(BaseModel):
    nombre: str
    x_user_id: str


class AffinoAccountUpdate(BaseModel):
    nombre: Optional[str] = None
    x_user_id: Optional[str] = None


class AffinoAccountResponse(BaseModel):
    id: int
    nombre: str
    x_user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoint-specific Request ──────────────────────────────────────────────────
# Extends the generic ToolExecutionRequest adding account_id for Affino.
# This keeps the generic schema clean while ensuring account_id reaches the service.

class AffinoExportRequest(ToolExecutionRequest):
    tool_key: ToolKey = ToolKey.AFFINO
    account_id: Optional[int] = None  # None → fallback to legacy settings xUserId
