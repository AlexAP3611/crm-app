from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, delete, and_

from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products

async def _sync_m2m_table(
    db: AsyncSession, 
    empresa_id: int, 
    target_ids: list[int] | None, 
    table, 
    fk_col, 
    id_col
):
    """
    Helper for differential M2M synchronization using explicit SQL Core.
    Bypasses ORM relationships to avoid greenlet/lazy-load issues.
    """
    if not empresa_id:
        raise ValueError("Cannot sync M2M: empresa_id is None")

    if target_ids is None:
        return

    # 1. Fetch current IDs from the association table
    result = await db.execute(select(id_col).where(fk_col == empresa_id))
    current_ids = set(result.scalars().all())
    target_set = set(target_ids)

    # 2. Compute Diff
    to_add = target_set - current_ids
    to_remove = current_ids - target_set

    # 3. Apply Changes
    if to_remove:
        await db.execute(
            delete(table).where(
                and_(
                    fk_col == empresa_id,
                    id_col.in_(to_remove)
                )
            )
        )

    if to_add:
        # Build bulk insert values
        # table.c.sector_id.name etc gives the column name string
        id_col_name = id_col.name
        values = [{"empresa_id": empresa_id, id_col_name: sid} for sid in to_add]
        await db.execute(insert(table), values)


async def _sync_empresa_m2m(
    db: AsyncSession, 
    empresa_id: int, 
    sector_ids: list[int] | None, 
    vertical_ids: list[int] | None, 
    product_ids: list[int] | None
):
    """Sync M2M relationships for sectors, verticals, and products using differential SQL logic."""
    
    # 1. Sync Sectors
    await _sync_m2m_table(
        db, 
        empresa_id, 
        sector_ids, 
        empresa_sectors, 
        empresa_sectors.c.empresa_id, 
        empresa_sectors.c.sector_id
    )

    # 2. Sync Verticals
    await _sync_m2m_table(
        db, 
        empresa_id, 
        vertical_ids, 
        empresa_verticals, 
        empresa_verticals.c.empresa_id, 
        empresa_verticals.c.vertical_id
    )

    # 3. Sync Products
    await _sync_m2m_table(
        db, 
        empresa_id, 
        product_ids, 
        empresa_products, 
        empresa_products.c.empresa_id, 
        empresa_products.c.product_id
    )
