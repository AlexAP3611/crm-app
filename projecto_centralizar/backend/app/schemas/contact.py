from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ContactCreate(BaseModel):
    company: str
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None
    cif: str | None = None
    dominio: str | None = None
    email_generic: str | None = None
    email_contact: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    products: list[str] | None = None  # legacy JSONB
    product_ids: list[int] = []
    cargo_ids: list[int] = []
    sector_ids: list[int] = []
    vertical_ids: list[int] = []
    notes: dict[str, Any] | None = None
    campaign_ids: list[int] = []

    model_config = {"extra": "allow"}


class ContactUpdate(BaseModel):
    company: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None
    cif: str | None = None
    dominio: str | None = None
    email_generic: str | None = None
    email_contact: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    products: list[str] | None = None  # legacy JSONB
    product_ids: list[int] | None = None
    cargo_ids: list[int] | None = None
    sector_ids: list[int] | None = None
    vertical_ids: list[int] | None = None
    notes: dict[str, Any] | None = None
    merge_lists: bool = True
    remove_lists: bool = False
    campaign_ids: list[int] | None = None

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
    dominio: str | None
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
    page: int = 1
    page_size: int = 50
