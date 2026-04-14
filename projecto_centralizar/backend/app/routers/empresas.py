from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload, contains_eager

from app.models.contact import contact_cargos as ccargo_table
from app.models.campaign import contact_campaigns as ccamp_table

from app.database import get_db
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products
from app.models.contact import Contact
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.models.product import Product
from app.schemas.empresa import EmpresaListResponse, EmpresaCreate, EmpresaResponse, EmpresaCreateResponse, EmpresaBulkUpdate, EmpresaBulkDelete
from app.auth import get_current_user
from app.core.utils import normalize_company_name, update_empresa_snapshot_in_contact

router = APIRouter(
    prefix="/api/empresas",
    tags=["Empresas"],
    dependencies=[Depends(get_current_user)]
)


async def _sync_empresa_m2m(db: AsyncSession, empresa: Empresa, sector_ids: list[int], vertical_ids: list[int], product_ids: list[int]):
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


async def _load_empresa(db: AsyncSession, empresa_id: int) -> Empresa | None:
    """Load an Empresa with all M2M relations eagerly loaded."""
    result = await db.execute(
        select(Empresa)
        .options(
            selectinload(Empresa.sectors),
            selectinload(Empresa.verticals),
            selectinload(Empresa.products_rel),
        )
        .where(Empresa.id == empresa_id)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=EmpresaListResponse)
async def list_empresas(
    sector_id: Optional[int] = Query(None, description="Filtrar por sector (M2M ID)"),
    vertical_id: Optional[int] = Query(None, description="Filtrar por vertical (M2M ID)"),
    product_id: Optional[int] = Query(None, description="Filtrar por producto (M2M ID)"),
    numero_empleados_min: Optional[int] = Query(None, description="Mínimo de empleados"),
    numero_empleados_max: Optional[int] = Query(None, description="Máximo de empleados"),
    facturacion_min: Optional[float] = Query(None, description="Mínimo de facturación"),
    facturacion_max: Optional[float] = Query(None, description="Máximo de facturación"),
    cnae: Optional[str] = Query(None, description="Filtrar por CNAE"),
    c_cargo_id: Optional[int] = Query(None, description="Filtro contacto: cargo"),
    c_campaign_id: Optional[int] = Query(None, description="Filtro contacto: campaña"),
    c_search: Optional[str] = Query(None, description="Filtro contacto: búsqueda"),
    q: Optional[str] = Query(None, description="Búsqueda por nombre de empresa (autocompletado)"),
    limit: int = Query(50, description="Límite de paginación"),
    offset: int = Query(0, description="Desplazamiento de paginación"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Empresa)

    if q:
        query = query.where(Empresa.nombre.ilike(f"%{q}%"))

    # Empresa M2M filters (now via association tables)
    if sector_id is not None:
        query = query.join(empresa_sectors, Empresa.id == empresa_sectors.c.empresa_id).where(
            empresa_sectors.c.sector_id == sector_id
        )
    if vertical_id is not None:
        query = query.join(empresa_verticals, Empresa.id == empresa_verticals.c.empresa_id).where(
            empresa_verticals.c.vertical_id == vertical_id
        )
    if product_id is not None:
        query = query.join(empresa_products, Empresa.id == empresa_products.c.empresa_id).where(
            empresa_products.c.product_id == product_id
        )

    if numero_empleados_min is not None:
        query = query.where(Empresa.numero_empleados >= numero_empleados_min)
    if numero_empleados_max is not None:
        query = query.where(Empresa.numero_empleados <= numero_empleados_max)
    if facturacion_min is not None:
        query = query.where(Empresa.facturacion >= facturacion_min)
    if facturacion_max is not None:
        query = query.where(Empresa.facturacion <= facturacion_max)
    if cnae:
        query = query.where(Empresa.cnae.startswith(cnae))

    has_contact_filters = any(x is not None and x != "" for x in [c_cargo_id, c_campaign_id, c_search])
    
    if has_contact_filters:
        query = query.join(Contact, Contact.empresa_id == Empresa.id)
        
        if c_cargo_id is not None:
            query = query.join(ccargo_table, Contact.id == ccargo_table.c.contact_id).where(ccargo_table.c.cargo_id == c_cargo_id)
        if c_campaign_id is not None:
            query = query.join(ccamp_table, Contact.id == ccamp_table.c.contact_id).where(ccamp_table.c.campaign_id == c_campaign_id)
        if c_search:
            term = f"%{c_search}%"
            query = query.where(
                or_(
                    Contact.first_name.ilike(term),
                    Contact.last_name.ilike(term),
                    Empresa.email.ilike(term),
                    Contact.email_contact.ilike(term),
                )
            )

        query = query.options(
            contains_eager(Empresa.contactos).selectinload(Contact.cargos),
            contains_eager(Empresa.contactos).selectinload(Contact.campaigns),
        )
    else:
        query = query.options(
            selectinload(Empresa.contactos).selectinload(Contact.cargos),
            selectinload(Empresa.contactos).selectinload(Contact.campaigns),
        )

    # Always eagerly load Empresa's own M2M
    query = query.options(
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
    )
        
    query = query.order_by(Empresa.nombre)
    
    # Extract count before pagination
    count_query = select(func.count()).select_from(query.with_only_columns(Empresa.id).subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    # Apply pagination
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    items = result.scalars().unique().all()
    
    return EmpresaListResponse(
        total=total,
        items=list(items)
    )

@router.post("", response_model=EmpresaCreateResponse)
async def create_empresa(empresa: EmpresaCreate, db: AsyncSession = Depends(get_db)):
    if empresa.nombre:
        empresa.nombre = normalize_company_name(empresa.nombre)

    # Validar si ya existe una empresa con este nombre
    existing = await db.execute(select(Empresa).where(func.lower(Empresa.nombre) == empresa.nombre.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="La empresa ya existe")

    payload = empresa.model_dump(exclude={"sector_ids", "vertical_ids", "product_ids"})
    db_empresa = Empresa(**payload)
    
    # Sync M2M BEFORE db.add() so the object is transient and avoids lazy-loading
    await _sync_empresa_m2m(db, db_empresa, empresa.sector_ids, empresa.vertical_ids, empresa.product_ids)

    db.add(db_empresa)
    await db.flush()

    await db.commit()
    await db.refresh(db_empresa, attribute_names=['created_at', 'updated_at'])
    return await _load_empresa(db, db_empresa.id)

@router.put("/{id}", response_model=EmpresaCreateResponse)
async def update_empresa(id: int, empresa_in: EmpresaCreate, db: AsyncSession = Depends(get_db)):
    empresa = await _load_empresa(db, id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    if empresa_in.nombre:
        empresa_in.nombre = normalize_company_name(empresa_in.nombre)

    update_data = empresa_in.model_dump(exclude={"sector_ids", "vertical_ids", "product_ids"}, exclude_unset=True)
    for field, value in update_data.items():
        setattr(empresa, field, value)

    # Sync M2M
    await _sync_empresa_m2m(db, empresa, empresa_in.sector_ids, empresa_in.vertical_ids, empresa_in.product_ids)

    # Flush to persist M2M changes before building snapshots
    await db.flush()

    # Reload empresa with fresh M2M for snapshot
    refreshed = await _load_empresa(db, id)

    # Propagate datos_empresa snapshot to all associated contacts
    result = await db.execute(
        select(Contact).where(Contact.empresa_id == id)
    )
    contactos = result.scalars().all()
    for contacto in contactos:
        update_empresa_snapshot_in_contact(contacto, refreshed)

    await db.commit()
    await db.refresh(empresa, attribute_names=['created_at', 'updated_at'])
    return await _load_empresa(db, id)

@router.delete("/{id}")
async def delete_empresa(id: int, db: AsyncSession = Depends(get_db)):
    empresa = await db.get(Empresa, id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
        
    contacts_count = await db.scalar(select(func.count(Contact.id)).where(Contact.empresa_id == id))
    if contacts_count > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar la empresa porque tiene contactos asociados.")
        
    await db.delete(empresa)
    await db.commit()

@router.post("/bulk-delete")
async def delete_empresas_bulk(
    data: EmpresaBulkDelete = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple empresas by ID list. Validates they have no contacts."""
    if not data.ids:
        return {"deleted": 0}
        
    result = await db.execute(select(Empresa).where(Empresa.id.in_(data.ids)))
    empresas = result.scalars().all()
    count = 0
    for empresa in empresas:
        # Check contacts count
        contacts_count = await db.scalar(select(func.count(Contact.id)).where(Contact.empresa_id == empresa.id))
        if contacts_count == 0:
            await db.delete(empresa)
            count += 1
            
    await db.commit()
    return {"deleted": count}

@router.post("/bulk-update")
async def update_empresas_bulk(
    data: EmpresaBulkUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple empresas by ID list. Mostly used for M2M merge_lists/remove_lists."""
    if not data.ids:
        return {"updated": 0}

    result = await db.execute(
        select(Empresa)
        .options(
            selectinload(Empresa.sectors),
            selectinload(Empresa.verticals),
            selectinload(Empresa.products_rel),
        )
        .where(Empresa.id.in_(data.ids))
    )
    empresas = result.scalars().all()
    
    # Load targets if we need them
    update_data = data.data
    new_sectors, new_verticals, new_products = [], [], []
    
    if update_data.sector_ids:
        res = await db.execute(select(Sector).where(Sector.id.in_(update_data.sector_ids)))
        new_sectors = list(res.scalars().all())
    if update_data.vertical_ids:
        res = await db.execute(select(Vertical).where(Vertical.id.in_(update_data.vertical_ids)))
        new_verticals = list(res.scalars().all())
    if update_data.product_ids:
        res = await db.execute(select(Product).where(Product.id.in_(update_data.product_ids)))
        new_products = list(res.scalars().all())

    for empresa in empresas:
        if update_data.merge_lists:
            # Append if not exists
            if update_data.sector_ids:
                existing_ids = {s.id for s in empresa.sectors}
                for s in new_sectors:
                    if s.id not in existing_ids:
                        empresa.sectors.append(s)
            if update_data.vertical_ids:
                existing_ids = {v.id for v in empresa.verticals}
                for v in new_verticals:
                    if v.id not in existing_ids:
                        empresa.verticals.append(v)
            if update_data.product_ids:
                existing_ids = {p.id for p in empresa.products_rel}
                for p in new_products:
                    if p.id not in existing_ids:
                        empresa.products_rel.append(p)
                        
        elif update_data.remove_lists:
            # Remove matches
            if update_data.sector_ids:
                empresa.sectors = [s for s in empresa.sectors if s.id not in update_data.sector_ids]
            if update_data.vertical_ids:
                empresa.verticals = [v for v in empresa.verticals if v.id not in update_data.vertical_ids]
            if update_data.product_ids:
                empresa.products_rel = [p for p in empresa.products_rel if p.id not in update_data.product_ids]
        else:
            # Full replacement
            if update_data.sector_ids is not None:
                empresa.sectors = new_sectors.copy()
            if update_data.vertical_ids is not None:
                empresa.verticals = new_verticals.copy()
            if update_data.product_ids is not None:
                empresa.products_rel = new_products.copy()

    await db.commit()
    return {"updated": len(empresas)}

# --- Async M2M Atomic Assign/Unassign Endpoints ---

async def _propagate_snapshot(db: AsyncSession, empresa_id: int, empresa_refreshed: Empresa):
    result = await db.execute(select(Contact).where(Contact.empresa_id == empresa_id))
    contactos = result.scalars().all()
    for contacto in contactos:
        update_empresa_snapshot_in_contact(contacto, empresa_refreshed)

@router.post("/{id}/sectors/{sector_id}", response_model=EmpresaCreateResponse)
async def assign_sector(id: int, sector_id: int, db: AsyncSession = Depends(get_db)):
    empresa = await _load_empresa(db, id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if any(s.id == sector_id for s in empresa.sectors):
        raise HTTPException(status_code=400, detail="El sector ya está asignado a esta empresa")
    sector = await db.get(Sector, sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail="Sector no encontrado")
        
    empresa.sectors.append(sector)
    await db.flush()
    refreshed = await _load_empresa(db, id)
    await _propagate_snapshot(db, id, refreshed)
    await db.commit()
    return refreshed

@router.delete("/{id}/sectors/{sector_id}", response_model=EmpresaCreateResponse)
async def unassign_sector(id: int, sector_id: int, db: AsyncSession = Depends(get_db)):
    empresa = await _load_empresa(db, id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    sector = next((s for s in empresa.sectors if s.id == sector_id), None)
    if not sector:
        raise HTTPException(status_code=400, detail="El sector no está asignado a esta empresa")
        
    empresa.sectors.remove(sector)
    await db.flush()
    refreshed = await _load_empresa(db, id)
    await _propagate_snapshot(db, id, refreshed)
    await db.commit()
    return refreshed

@router.post("/{id}/verticals/{vertical_id}", response_model=EmpresaCreateResponse)
async def assign_vertical(id: int, vertical_id: int, db: AsyncSession = Depends(get_db)):
    empresa = await _load_empresa(db, id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if any(v.id == vertical_id for v in empresa.verticals):
        raise HTTPException(status_code=400, detail="La vertical ya está asignada a esta empresa")
    vertical = await db.get(Vertical, vertical_id)
    if not vertical:
        raise HTTPException(status_code=404, detail="Vertical no encontrada")
        
    empresa.verticals.append(vertical)
    await db.flush()
    refreshed = await _load_empresa(db, id)
    await _propagate_snapshot(db, id, refreshed)
    await db.commit()
    return refreshed

@router.delete("/{id}/verticals/{vertical_id}", response_model=EmpresaCreateResponse)
async def unassign_vertical(id: int, vertical_id: int, db: AsyncSession = Depends(get_db)):
    empresa = await _load_empresa(db, id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    vertical = next((v for v in empresa.verticals if v.id == vertical_id), None)
    if not vertical:
        raise HTTPException(status_code=400, detail="La vertical no está asignada a esta empresa")
        
    empresa.verticals.remove(vertical)
    await db.flush()
    refreshed = await _load_empresa(db, id)
    await _propagate_snapshot(db, id, refreshed)
    await db.commit()
    return refreshed

@router.post("/{id}/products/{product_id}", response_model=EmpresaCreateResponse)
async def assign_product(id: int, product_id: int, db: AsyncSession = Depends(get_db)):
    empresa = await _load_empresa(db, id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if any(p.id == product_id for p in empresa.products_rel):
        raise HTTPException(status_code=400, detail="El producto ya está asignado a esta empresa")
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    empresa.products_rel.append(product)
    await db.flush()
    refreshed = await _load_empresa(db, id)
    await _propagate_snapshot(db, id, refreshed)
    await db.commit()
    return refreshed

@router.delete("/{id}/products/{product_id}", response_model=EmpresaCreateResponse)
async def unassign_product(id: int, product_id: int, db: AsyncSession = Depends(get_db)):
    empresa = await _load_empresa(db, id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    product = next((p for p in empresa.products_rel if p.id == product_id), None)
    if not product:
        raise HTTPException(status_code=400, detail="El producto no está asignado a esta empresa")
        
    empresa.products_rel.remove(product)
    await db.flush()
    refreshed = await _load_empresa(db, id)
    await _propagate_snapshot(db, id, refreshed)
    await db.commit()
    return refreshed
