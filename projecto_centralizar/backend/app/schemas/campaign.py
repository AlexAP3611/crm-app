from datetime import datetime, timezone

from pydantic import BaseModel, Field


class CampaignCreate(BaseModel):
    nombre: str
    tipo: str | None = None
    estado: str = "Activa"
    fecha_inicio: datetime | None = Field(default_factory=lambda: datetime.now(timezone.utc))
    fecha_fin: datetime | None = None
    presupuesto: float | None = None
    objetivo: str | None = None
    responsable: str | None = None
    canal: str | None = None
    notas: str | None = None


class CampaignUpdate(BaseModel):
    nombre: str | None = None
    tipo: str | None = None
    estado: str | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    presupuesto: float | None = None
    objetivo: str | None = None
    responsable: str | None = None
    canal: str | None = None
    notas: str | None = None


class CampaignResponse(BaseModel):
    id: int
    nombre: str
    tipo: str | None
    estado: str
    fecha_inicio: datetime
    fecha_fin: datetime | None
    presupuesto: float | None
    objetivo: str | None
    responsable: str | None
    canal: str | None
    notas: str | None

    model_config = {"from_attributes": True}
