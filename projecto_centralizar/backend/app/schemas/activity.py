from typing import Any, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class ActivityUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str

class IntegrationLogActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    run_id: UUID
    tool: str
    status: str
    user_id: Optional[int]
    user: Optional[ActivityUser]
    metrics: Optional[dict[str, Any]]
    error_log: Optional[str]
    created_at: datetime

class AuditLogActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: Optional[int]
    user: Optional[ActivityUser]
    action: str
    # metadata_ is the attribute name in the Log model
    metadata: Optional[dict[str, Any]] = Field(validation_alias="metadata_")
    created_at: datetime

class PaginatedIntegrations(BaseModel):
    items: list[IntegrationLogActivityResponse]
    total: int
    page: int
    page_size: int

class PaginatedAudit(BaseModel):
    items: list[AuditLogActivityResponse]
    total: int
    page: int
    page_size: int
