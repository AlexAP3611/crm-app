from typing import Optional
from datetime import datetime
from pydantic import BaseModel, field_validator

from app.schemas.contact import ContactResponse, SectorRef, VerticalRef, ProductRef


class EmpresaFilterFields(BaseModel):
    """Pure business filters. No pagination. Used by bulk scope and inherited by EmpresaFilterParams."""
    q: Optional[str] = None
    sector_id: Optional[int] = None
    vertical_id: Optional[int] = None
    product_id: Optional[int] = None
    numero_empleados_min: Optional[int] = None
    numero_empleados_max: Optional[int] = None
    facturacion_min: Optional[float] = None
    facturacion_max: Optional[float] = None
    cnae: Optional[str] = None


class EmpresaFilterParams(EmpresaFilterFields):
    """List-only: adds pagination on top of filter fields."""
    page: int = 1
    page_size: int = 50

    @field_validator("page_size")
    @classmethod
    def cap_page_size(cls, v: int) -> int:
        return min(v, 200)



class EmpresaBase(BaseModel):
    nombre: str
    web: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cif: Optional[str] = None
    numero_empleados: Optional[int] = None
    facturacion: Optional[float] = None
    cnae: Optional[str] = None
    sector_ids: list[int] = []
    vertical_ids: list[int] = []
    product_ids: list[int] = []

class EmpresaCreate(EmpresaBase):
    pass

class EmpresaUpdate(BaseModel):
    nombre: Optional[str] = None
    web: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cif: Optional[str] = None
    numero_empleados: Optional[int] = None
    facturacion: Optional[float] = None
    cnae: Optional[str] = None
    sector_ids: Optional[list[int]] = None
    vertical_ids: Optional[list[int]] = None
    product_ids: Optional[list[int]] = None
    merge_lists: bool = True
    remove_lists: bool = False

class EmpresaCreateResponse(BaseModel):
    id: int
    nombre: str
    web: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cif: Optional[str] = None
    numero_empleados: Optional[int] = None
    facturacion: Optional[float] = None
    cnae: Optional[str] = None
    sectors: list[SectorRef] = []
    verticals: list[VerticalRef] = []
    products_rel: list[ProductRef] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EmpresaResponse(EmpresaCreateResponse):
    pass

class EmpresaListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[EmpresaResponse]

