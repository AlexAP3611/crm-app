from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class ContactCreate(BaseModel):
    empresa_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None  # transient input for cargo resolution
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    cargo_id: int | None = None
    notes: dict[str, Any] | None = None
    campaign_ids: list[int] = []
    # Timestamps — declared so Pydantic coerces ISO strings to datetime
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"extra": "allow"}

    @field_validator("empresa_id", "cargo_id", mode="before")
    @classmethod
    def convert_empty_strings(cls, v):
        return None if v == "" else v


class ContactUpdate(BaseModel):
    empresa_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None  # transient input for cargo resolution
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    cargo_id: int | None = None
    notes: dict[str, Any] | None = None
    merge_lists: bool = True
    remove_lists: bool = False
    campaign_ids: list[int] | None = None
    # Timestamps — declared so Pydantic coerces ISO strings to datetime
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"extra": "allow"}

    @field_validator("empresa_id", "cargo_id", mode="before")
    @classmethod
    def convert_empty_strings(cls, v):
        return None if v == "" else v


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


class EmpresaRef(BaseModel):
    id: int
    nombre: str

    model_config = {"from_attributes": True}


class ContactResponse(BaseModel):
    id: int
    empresa_rel: EmpresaRef | None = None
    first_name: str | None
    last_name: str | None
    # Raw job_title removed. Use cargo.name for display.
    email: str | None
    phone: str | None
    linkedin: str | None
    # Product JSONB field removed. Products are managed at Empresa level.
    notes: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime
    enriched: bool
    enriched_at: datetime | None
    sectors: list[SectorRef]
    verticals: list[VerticalRef]
    products_rel: list[ProductRef]
    cargo: CargoRef | None = None
    campaigns: list[CampaignRef]

    model_config = {"from_attributes": True}


class ContactListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ContactResponse]


class ContactFilterFields(BaseModel):
    """Pure business filters. No pagination. Used by bulk scope and inherited by ContactFilterParams."""
    sector_id: int | None = None
    vertical_id: int | None = None
    campaign_id: int | None = None
    product_id: int | None = None
    cargo_id: int | None = None
    search: str | None = None
    contacto_nombre: str | None = None
    email: str | None = None
    empresa_id: int | None = None
    is_enriched: bool | None = None


class ContactFilterParams(ContactFilterFields):
    """List-only: adds pagination on top of filter fields."""
    page: int = 1
    page_size: int = 50

    @field_validator("page_size")
    @classmethod
    def cap_page_size(cls, v: int) -> int:
        return min(v, 200)
