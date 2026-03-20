from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.campaign import Campaign
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.schemas.campaign import CampaignCreate, CampaignResponse
from app.schemas.sector_vertical import (
    SectorCreate, SectorResponse,
    VerticalCreate, VerticalResponse,
)
from app.auth import get_current_user

router = APIRouter(
    tags=["Lookup Tables"],
    dependencies=[Depends(get_current_user)]
)


# --- Sectors ---

@router.get("/api/sectors", response_model=list[SectorResponse])
async def list_sectors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sector).order_by(Sector.name))
    return result.scalars().all()


@router.post("/api/sectors", response_model=SectorResponse, status_code=201)
async def create_sector(data: SectorCreate, db: AsyncSession = Depends(get_db)):
    sector = Sector(**data.model_dump())
    db.add(sector)
    await db.commit()
    await db.refresh(sector)
    return sector


@router.delete("/api/sectors/{sector_id}", status_code=204)
async def delete_sector(sector_id: int, db: AsyncSession = Depends(get_db)):
    sector = await db.get(Sector, sector_id)
    if sector is None:
        raise HTTPException(status_code=404, detail="Sector not found")
    await db.delete(sector)
    await db.commit()


# --- Verticals ---

@router.get("/api/verticals", response_model=list[VerticalResponse])
async def list_verticals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vertical).order_by(Vertical.name))
    return result.scalars().all()


@router.post("/api/verticals", response_model=VerticalResponse, status_code=201)
async def create_vertical(data: VerticalCreate, db: AsyncSession = Depends(get_db)):
    vertical = Vertical(**data.model_dump())
    db.add(vertical)
    await db.commit()
    await db.refresh(vertical)
    return vertical


@router.delete("/api/verticals/{vertical_id}", status_code=204)
async def delete_vertical(vertical_id: int, db: AsyncSession = Depends(get_db)):
    vertical = await db.get(Vertical, vertical_id)
    if vertical is None:
        raise HTTPException(status_code=404, detail="Vertical not found")
    await db.delete(vertical)
    await db.commit()


# --- Campaigns ---

@router.get("/api/campaigns", response_model=list[CampaignResponse])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).order_by(Campaign.name))
    return result.scalars().all()


@router.post("/api/campaigns", response_model=CampaignResponse, status_code=201)
async def create_campaign(data: CampaignCreate, db: AsyncSession = Depends(get_db)):
    campaign = Campaign(**data.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.delete("/api/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.delete(campaign)
    await db.commit()
