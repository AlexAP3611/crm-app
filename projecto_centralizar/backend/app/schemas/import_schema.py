from pydantic import BaseModel
from typing import List, Optional

class SkipDetail(BaseModel):
    row: int
    reason: str

class EmpresaPreview(BaseModel):
    name: str
    action: str  # e.g., "would_create"

class ImportSummary(BaseModel):
    total_rows: int
    to_create: int
    to_update: int
    skipped: int
    skip_details: List[SkipDetail]
    empresa_preview: List[EmpresaPreview]
