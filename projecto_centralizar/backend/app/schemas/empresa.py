from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.schemas.contact import ContactResponse, SectorRef, VerticalRef, ProductRef


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

class EmpresaBulkDelete(BaseModel):
    ids: list[int]

class EmpresaBulkUpdate(BaseModel):
    ids: list[int]
    data: EmpresaUpdate

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
    contactos: list[ContactResponse] = []

class EmpresaListResponse(BaseModel):
    total: int
    items: list[EmpresaResponse]
