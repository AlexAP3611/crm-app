from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth import require_admin
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.models.product import Product
from app.models.cargo import Cargo
from app.models.contact import Contact
from app.schemas.master_data import (
    MasterDataCreate,
    MasterDataResponse,
)

router = APIRouter(
    prefix="/api/master-data",
    tags=["Master Data"],
    dependencies=[Depends(require_admin)]
)

# Helper functions to avoid code duplication across the 4 entities
async def get_all_entities(db: AsyncSession, model_class):
    result = await db.execute(select(model_class).order_by(model_class.name))
    return result.scalars().all()

async def create_entity(db: AsyncSession, model_class, data: MasterDataCreate):
    # Check for duplicate
    stmt = select(model_class).where(model_class.name.ilike(data.name))
    existing = await db.execute(stmt)
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Ya existe una entidad con este nombre")
    
    new_entity = model_class(**data.model_dump())
    db.add(new_entity)
    try:
        await db.commit()
        await db.refresh(new_entity)
        return new_entity
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una entidad con este nombre")

async def delete_entity(db: AsyncSession, model_class, entity_id: int, relation_attr_name: str):
    # Retrieve the entity and its related items to check for existing relations
    stmt = select(model_class).options(selectinload(getattr(model_class, relation_attr_name))).where(model_class.id == entity_id)
    result = await db.execute(stmt)
    entity = result.scalars().first()
    
    if not entity:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")
        
    if getattr(entity, relation_attr_name):
        raise HTTPException(status_code=400, detail="No se puede eliminar este valor porque está asignado a otros elementos.")

    await db.delete(entity)
    await db.commit()
    return {"ok": True}


# --- Sectors ---
@router.get("/sectors", response_model=list[MasterDataResponse])
async def list_sectors(db: AsyncSession = Depends(get_db)):
    return await get_all_entities(db, Sector)

@router.post("/sectors", response_model=MasterDataResponse)
async def create_sector(data: MasterDataCreate, db: AsyncSession = Depends(get_db)):
    return await create_entity(db, Sector, data)

@router.delete("/sectors/{item_id}", status_code=204)
async def delete_sector(item_id: int, db: AsyncSession = Depends(get_db)):
    return await delete_entity(db, Sector, item_id, "empresas")


# --- Verticals ---
@router.get("/verticals", response_model=list[MasterDataResponse])
async def list_verticals(db: AsyncSession = Depends(get_db)):
    return await get_all_entities(db, Vertical)

@router.post("/verticals", response_model=MasterDataResponse)
async def create_vertical(data: MasterDataCreate, db: AsyncSession = Depends(get_db)):
    return await create_entity(db, Vertical, data)

@router.delete("/verticals/{item_id}", status_code=204)
async def delete_vertical(item_id: int, db: AsyncSession = Depends(get_db)):
    return await delete_entity(db, Vertical, item_id, "empresas")


# --- Products ---
@router.get("/products", response_model=list[MasterDataResponse])
async def list_products(db: AsyncSession = Depends(get_db)):
    return await get_all_entities(db, Product)

@router.post("/products", response_model=MasterDataResponse)
async def create_product(data: MasterDataCreate, db: AsyncSession = Depends(get_db)):
    return await create_entity(db, Product, data)

@router.delete("/products/{item_id}", status_code=204)
async def delete_product(item_id: int, db: AsyncSession = Depends(get_db)):
    return await delete_entity(db, Product, item_id, "empresas")


# --- Cargos ---
@router.get("/cargos", response_model=list[MasterDataResponse])
async def list_cargos(db: AsyncSession = Depends(get_db)):
    return await get_all_entities(db, Cargo)

@router.post("/cargos", response_model=MasterDataResponse)
async def create_cargo(data: MasterDataCreate, db: AsyncSession = Depends(get_db)):
    return await create_entity(db, Cargo, data)

@router.delete("/cargos/{item_id}", status_code=204)
async def delete_cargo(item_id: int, db: AsyncSession = Depends(get_db)):
    return await delete_entity(db, Cargo, item_id, "contacts")
