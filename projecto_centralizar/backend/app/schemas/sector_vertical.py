from pydantic import BaseModel


class SectorCreate(BaseModel):
    name: str
    description: str | None = None


class SectorResponse(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class VerticalCreate(BaseModel):
    name: str
    description: str | None = None


class VerticalResponse(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = {"from_attributes": True}
