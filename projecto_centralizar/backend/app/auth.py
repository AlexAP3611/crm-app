import os
import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.setting import Setting
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def _extract_bearer(header: str | None) -> str | None:
    """Extract token from 'Bearer <token>' header value."""
    if header and header.lower().startswith("bearer "):
        return header[7:]
    return None


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    # --- Try 1: API Key from headers (X-API-Key or Authorization: Bearer) ---
    api_key = (
        request.headers.get("X-API-Key")
        or _extract_bearer(request.headers.get("Authorization"))
    )
    if api_key:
        result = await db.execute(
            select(Setting).where(Setting.key == "crm_api_key")
        )
        setting = result.scalar_one_or_none()
        if setting and setting.value == api_key:
            # API key valid — return first user as the "system" acting user
            user_result = await db.execute(select(User).limit(1))
            user = user_result.scalar_one_or_none()
            if user:
                return user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )

    # --- Try 2: Session cookie (existing logic) ---
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]
