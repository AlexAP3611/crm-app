from pydantic import BaseModel

class ApiKeyResponse(BaseModel):
    api_key: str | None

class ApiKeyResponseGenerate(BaseModel):
    api_key: str
