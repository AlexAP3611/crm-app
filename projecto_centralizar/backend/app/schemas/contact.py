from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ContactCreate(BaseModel):
    company: str
    empresa_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None
    email_contact: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    products: list[str] | None = None  # legacy JSONB
    cargo_ids: list[int] = []
    notes: dict[str, Any] | None = None
    campaign_ids: list[int] = []
    # Timestamps — declared so Pydantic coerces ISO strings to datetime
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"extra": "allow"}


class ContactUpdate(BaseModel):
    company: str | None = None
    empresa_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None
    email_contact: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    products: list[str] | None = None  # legacy JSONB
    cargo_ids: list[int] | None = None
    notes: dict[str, Any] | None = None
    merge_lists: bool = True
    remove_lists: bool = False
    campaign_ids: list[int] | None = None
    # Timestamps — declared so Pydantic coerces ISO strings to datetime
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"extra": "allow"}


class ContactBulkDelete(BaseModel):
    ids: list[int]


class ContactBulkUpdate(BaseModel):
    ids: list[int]
    data: ContactUpdate


class CampaignRef(BaseModel):
    id: int
    nombre: str

    model_config = {"from_attributes": True}


class SectorRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class VerticalRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class ProductRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class CargoRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class ContactResponse(BaseModel):
    id: int
    company: str
    first_name: str | None
    last_name: str | None
    job_title: str | None
    cif: str | None
    web: str | None
    email_generic: str | None
    email_contact: str | None
    phone: str | None
    linkedin: str | None
    products: list[str] | None
    notes: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime
    sectors: list[SectorRef]
    verticals: list[VerticalRef]
    products_rel: list[ProductRef]
    cargos: list[CargoRef]
    campaigns: list[CampaignRef]

    model_config = {"from_attributes": True}


class ContactListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ContactResponse]


class ContactFilterParams(BaseModel):
    sector_id: int | None = None
    vertical_id: int | None = None
    campaign_id: int | None = None
    product_id: int | None = None
    cargo_id: int | None = None
    search: str | None = None
    contacto_nombre: str | None = None
    email: str | None = None
    empresa_id: int | None = None
    empresa_nombre: str | None = None
    cnae: str | None = None
    empresa_numero_empleados_min: int | None = None
    empresa_numero_empleados_max: int | None = None
    page: int = 1
    page_size: int = 50
