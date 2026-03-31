from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(
    tags=["Lookup Tables"],
    dependencies=[Depends(get_current_user)]
)



# --- Campaigns have been moved to routers/campaigns.py ---
