from pydantic import BaseModel, field_validator


class MasterDataCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío")
        return v


class MasterDataResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
