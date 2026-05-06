from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field
from app.schemas.contact import ContactFilterFields

class ToolKey(str, Enum):
    AFFINO = "Affino"
    CLAY = "Clay"
    APOLLO = "Apollo"
    ADSCORE = "Adscore"
    # Future tools can be added here
    

class ToolExecutionRequest(BaseModel):
    tool_key: ToolKey
    enrichment_run_id: UUID = Field(default_factory=uuid4)
    ids: Optional[list[int]] = None
    filters: Optional[ContactFilterFields] = None
    all: bool = False
    params: dict[str, Any] = Field(default_factory=dict, description="Tool-specific parameters")

class ToolExecutionResponse(BaseModel):
    run_id: UUID
    status: str
    message: Optional[str] = None

class InvalidEntity(BaseModel):
    id: int
    nombre: str
    reason: str

class ToolValidationError(BaseModel):
    error_code: str
    message: str
    invalid_entities: list[InvalidEntity]
    blocking: bool = True
