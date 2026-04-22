from pydantic import BaseModel


class SectorCreate(BaseModel):
    name: str


class SectorResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class VerticalCreate(BaseModel):
    name: str


class VerticalResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
