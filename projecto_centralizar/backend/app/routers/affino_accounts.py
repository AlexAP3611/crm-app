from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.affino_account import AffinoAccount
from app.schemas.affino_account import (
    AffinoAccountCreate,
    AffinoAccountUpdate,
    AffinoAccountResponse,
)

router = APIRouter(
    prefix="/api/affino-accounts",
    tags=["Affino Accounts"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[AffinoAccountResponse])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AffinoAccount).order_by(AffinoAccount.id))
    return result.scalars().all()


@router.post("", response_model=AffinoAccountResponse, status_code=201)
async def create_account(
    data: AffinoAccountCreate,
    db: AsyncSession = Depends(get_db),
):
    account = AffinoAccount(**data.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.put("/{account_id}", response_model=AffinoAccountResponse)
async def update_account(
    account_id: int,
    data: AffinoAccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    account = await db.get(AffinoAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta Affino no encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
):
    account = await db.get(AffinoAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta Affino no encontrada")
    await db.delete(account)
    await db.commit()
