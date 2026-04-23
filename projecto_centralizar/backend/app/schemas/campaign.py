from pydantic import BaseModel


class CampaignCreate(BaseModel):
    nombre: str


class CampaignUpdate(BaseModel):
    nombre: str | None = None


class CampaignResponse(BaseModel):
    id: int
    nombre: str

    model_config = {"from_attributes": True}
