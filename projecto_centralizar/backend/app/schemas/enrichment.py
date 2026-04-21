from typing import Any, Optional, Literal
from uuid import UUID, uuid4
from pydantic import BaseModel, Field
from app.schemas.empresa import EmpresaFilterParams

class EnrichRequest(BaseModel):
    source: str
    data: dict[str, Any]

class BulkContactItem(BaseModel):
    """
    Only id_contacto is required. All other fields are optional and handled
    dynamically — known columns are written to DB, the rest go into notes[source].
    """
    model_config = {"extra": "allow"}
    id_contacto: int

class BulkContactData(BaseModel):
    contacts: list[BulkContactItem]

class BulkEnrichRequest(BaseModel):
    source: str
    data: BulkContactData

class BulkEnrichmentResultItem(BaseModel):
    id_contacto: int
    status: str
    message: str | None = None

class BulkEnrichmentResponse(BaseModel):
    results: list[BulkEnrichmentResultItem]

class IngestContactInput(BaseModel):
    model_config = {"extra": "allow"}
    first_name: str
    last_name: str
    email: str | None = None
    linkedin: str | None = None
    job_title: str | None = None
    phone: str | None = None

class IngestEmpresaInput(BaseModel):
    model_config = {"extra": "allow"}
    empresa_id: int
    web: str | None = None
    email: str | None = None
    phone: str | None = None
    cif: str | None = None
    cnae: str | None = None
    numero_empleados: int | None = None
    facturacion: float | None = None
    sector: list[str] = []
    vertical: list[str] = []
    producto: list[str] = []
    contactos: list[IngestContactInput] = []

class IngestRequest(BaseModel):
    empresas: list[IngestEmpresaInput]

class IngestResponse(BaseModel):
    status: str
    empresa_processed: int
    empresa_skipped: int
    contact_created: int
    contact_updated: int
    contact_skipped: int

# --- Company Enrichment Refactor (Phase 3) ---

class CompanyEnrichRequest(BaseModel):
    tool_key: str
    enrichment_run_id: UUID = Field(default_factory=uuid4)
    ids: Optional[list[int]] = None
    filters: Optional[EmpresaFilterParams] = None

class InvalidCompany(BaseModel):
    id: int
    nombre: str
    reason: str

class CompanyEnrichErrorResponse(BaseModel):
    status: str = "failed"
    error_code: str
    message: str
    blocking: bool = True
    invalid_companies: list[InvalidCompany] = []

class CompanyEnrichSuccessResponse(BaseModel):
    status: str = "success"
    enrichment_run_id: UUID
    total: int
    sent: int
    invalid: int
