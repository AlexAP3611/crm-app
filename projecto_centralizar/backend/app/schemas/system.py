from pydantic import BaseModel
from typing import Any

class ApiKeyResponse(BaseModel):
    api_key: str | None

class ApiKeyResponseGenerate(BaseModel):
    api_key: str

class SettingUpdate(BaseModel):
    value: Any

class SettingResponse(BaseModel):
    key: str
    value: Any
