import secrets
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import require_admin
from app.models.setting import Setting
from app.schemas.system import ApiKeyResponse, ApiKeyResponseGenerate, SettingUpdate, SettingResponse

router = APIRouter(
    prefix="/api/system",
    tags=["System"],
    dependencies=[Depends(require_admin)]
)

@router.get("/api-key", response_model=ApiKeyResponse)
async def get_api_key(db: AsyncSession = Depends(get_db)):
    """Retrieve the global CRM API key."""
    result = await db.execute(select(Setting).where(Setting.key == "crm_api_key"))
    setting = result.scalar_one_or_none()
    
    return {"api_key": setting.value if setting else None}

@router.post("/api-key", response_model=ApiKeyResponseGenerate)
async def generate_api_key(db: AsyncSession = Depends(get_db)):
    """Generate and permanently store a new global CRM API key."""
    # Generate 32-byte hex token similar to frontend logic
    new_key = "crm_" + secrets.token_hex(32)
    
    result = await db.execute(select(Setting).where(Setting.key == "crm_api_key"))
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = new_key
    else:
        setting = Setting(key="crm_api_key", value=new_key)
        db.add(setting)
        
    await db.commit()
    
    return {"api_key": new_key}

@router.get("/settings", response_model=list[SettingResponse])
async def get_settings(prefix: str = None, db: AsyncSession = Depends(get_db)):
    """Retrieve settings optionally filtered by a prefix (e.g. ext_config_)."""
    stmt = select(Setting)
    if prefix:
        stmt = stmt.where(Setting.key.startswith(prefix))
    result = await db.execute(stmt)
    settings = result.scalars().all()
    
    return [{"key": s.key, "value": s.value} for s in settings]

@router.post("/settings/{key}", response_model=SettingResponse)
async def update_setting(key: str, data: SettingUpdate, db: AsyncSession = Depends(get_db)):
    """Create or update a generic setting in the database using JSONB."""
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = data.value
    else:
        setting = Setting(key=key, value=data.value)
        db.add(setting)
        
    await db.commit()
    
    return {"key": setting.key, "value": setting.value}
