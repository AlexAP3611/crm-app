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


class CategoriaCargoRef(BaseModel):
    """Minimal categoria representation embedded inside CargoWithCategoriaResponse."""
    id: int
    name: str

    model_config = {"from_attributes": True}


class CargoWithCategoriaResponse(BaseModel):
    """Cargo response that includes its optional categoria entity."""
    id: int
    name: str
    categoria: CategoriaCargoRef | None = None

    model_config = {"from_attributes": True}


class CargoUpdateCategoria(BaseModel):
    """Payload for PATCH /master-data/cargos/{id}/categoria — human-only endpoint."""
    categoria_id: int | None = None


class PaisResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class ProvinciaCreate(BaseModel):
    name: str
    pais_id: int

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío")
        return v


class ProvinciaResponse(BaseModel):
    id: int
    name: str
    pais_id: int

    model_config = {"from_attributes": True}
