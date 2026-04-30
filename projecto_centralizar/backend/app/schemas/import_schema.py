from pydantic import BaseModel
from typing import List, Optional

class SkipDetail(BaseModel):
    row: int
    reason: str

class EmpresaPreview(BaseModel):
    name: str
    action: str  # e.g., "would_create" | "exists"

class SectorPreview(BaseModel):
    name: str
    action: str  # "exists" | "would_create"

class VerticalPreview(BaseModel):
    name: str
    action: str  # "exists" | "would_create"

class ProductPreview(BaseModel):
    name: str
    action: str  # "exists" | "would_create"

class CargoPreview(BaseModel):
    name: str
    action: str  # "exists" | "would_create"

class CampaignPreview(BaseModel):
    name: str
    action: str  # "exists" | "would_create"

class ImportSummary(BaseModel):
    total_rows: int
    to_create: int
    to_update: int
    skipped: int
    skip_details: List[SkipDetail]
    empresa_preview: List[EmpresaPreview] = []
    sector_preview: List[SectorPreview] = []
    vertical_preview: List[VerticalPreview] = []
    product_preview: List[ProductPreview] = []
    cargo_preview: List[CargoPreview] = []
    campaign_preview: List[CampaignPreview] = []
    failed_rows_csv: Optional[str] = None
