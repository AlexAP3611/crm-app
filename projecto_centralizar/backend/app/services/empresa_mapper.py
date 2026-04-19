from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.empresa import Empresa
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.models.product import Product

async def _sync_empresa_m2m(
    db: AsyncSession, 
    empresa: Empresa, 
    sector_ids: list[int] | None, 
    vertical_ids: list[int] | None, 
    product_ids: list[int] | None
):
    """Sync M2M relationships for sectors, verticals, and products on an Empresa."""
    if sector_ids is not None:
        result = await db.execute(select(Sector).where(Sector.id.in_(sector_ids)))
        empresa.sectors = list(result.scalars().all())

    if vertical_ids is not None:
        result = await db.execute(select(Vertical).where(Vertical.id.in_(vertical_ids)))
        empresa.verticals = list(result.scalars().all())

    if product_ids is not None:
        result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
        empresa.products_rel = list(result.scalars().all())
