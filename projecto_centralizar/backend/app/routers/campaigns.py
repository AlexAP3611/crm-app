from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.campaign import Campaign
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignResponse
from app.auth import get_current_user

router = APIRouter(
    prefix="/api/campaigns",
    tags=["Campaigns"],
    dependencies=[Depends(get_current_user)]
)

@router.get("", response_model=list[CampaignResponse])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).order_by(Campaign.nombre))
    return result.scalars().all()

from app.services import campaign_service
from app.core.exceptions import DuplicateEntityError

@router.post("", response_model=CampaignResponse, status_code=201)
async def create_campaign(data: CampaignCreate, db: AsyncSession = Depends(get_db)):
    try:
        campaign = await campaign_service.create_strict(db, data.nombre)
        await db.commit()
        await db.refresh(campaign)
        return campaign
    except DuplicateEntityError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: int, data: CampaignUpdate, db: AsyncSession = Depends(get_db)):
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    
    payload = data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(campaign, key, value)
        
    await db.commit()
    await db.refresh(campaign)
    return campaign

@router.delete("/{campaign_id}", status_code=204)
async def delete_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
        
    # Optional constraint warning: SQLAlchemy ON DELETE CASCADE might be set up
    # for contact_campaigns depending on setup, but typically we just let db cascade.
    await db.delete(campaign)
    await db.commit()
