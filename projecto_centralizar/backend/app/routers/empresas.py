from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload



from app.database import get_db
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products
from app.models.contact import Contact
from app.models.sector import Sector
from app.models.vertical import Vertical
from app.models.product import Product
from app.schemas.empresa import EmpresaListResponse, EmpresaCreate, EmpresaResponse, EmpresaCreateResponse, EmpresaFilterParams
from app.schemas.scope import EmpresaScopedDelete, EmpresaScopedUpdate
from app.services.scope import apply_scope
from app.services.empresa_service import _apply_empresa_filters
from app.schemas.contact import ContactListResponse
from app.schemas.enrichment import CompanyEnrichRequest, CompanyEnrichSuccessResponse, CompanyEnrichErrorResponse
from app.services import empresa_service, empresa_mapper, enrichment_service
from app.auth import get_current_user
from app.core.utils import normalize_company_name, update_empresa_snapshot_in_contact

router = APIRouter(
    prefix="/api/empresas",
    tags=["Empresas"],
    dependencies=[Depends(get_current_user)]
)


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
    filters: EmpresaFilterParams = Depends(),
    db: AsyncSession = Depends(get_db)
):
    return await empresa_service.list_empresas(db, filters)

@router.get("/{empresa_id}/contactos", response_model=ContactListResponse)
async def list_empresa_contactos(
    empresa_id: int,
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(50, ge=1, le=200, description="Tamaño de página"),
    db: AsyncSession = Depends(get_db)
):
    # Validar que la empresa existe
    empresa = await db.scalar(select(Empresa).where(Empresa.id == empresa_id))
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    q = select(Contact).where(Contact.empresa_id == empresa_id).options(
        selectinload(Contact.cargo)
    )
    
    # Precise Count using DISTINCT to handle joins if they existed (not here, but for consistency)
    count_query = select(func.count(Contact.id)).where(Contact.empresa_id == empresa_id)
    total = await db.scalar(count_query) or 0

    # Stable Sort (First Name, Last Name + ID as tie-breaker)
    offset = (page - 1) * page_size
    q = q.order_by(Contact.first_name, Contact.last_name, Contact.id.desc()).offset(offset).limit(page_size)
    result = await db.execute(q)
    items = result.scalars().all()

    return ContactListResponse(
        total=total,
        items=list(items),
        page=page,
        page_size=page_size
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
    # Note: Since the object is transient, it doesn't have an ID yet. 
    # Actually, we should flush FIRST to get the ID if we use SQL Core sync.
    # WAIT: the SQL core sync REQUIRES an ID.
    
    db.add(db_empresa)
    await db.flush() # Now db_empresa.id exists
    await empresa_mapper._sync_empresa_m2m(db, db_empresa.id, empresa.sector_ids, empresa.vertical_ids, empresa.product_ids)
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
    await empresa_mapper._sync_empresa_m2m(db, empresa.id, empresa_in.sector_ids, empresa_in.vertical_ids, empresa_in.product_ids)

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
    data: EmpresaScopedDelete = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Delete empresas by scope. Skips empresas with contacts. Rejects empty scope."""
    query = select(Empresa)
    query = apply_scope(
        query, model=Empresa,
        ids=data.ids, filters=data.filters,
        apply_filters_fn=_apply_empresa_filters,
        allow_all=data.all is True,
    )

    result = await db.execute(query)
    empresas = result.scalars().all()

    if not empresas:
        return {"deleted": 0}

    count = 0
    skipped = 0
    for empresa in empresas:
        contacts_count = await db.scalar(select(func.count(Contact.id)).where(Contact.empresa_id == empresa.id))
        if contacts_count == 0:
            await db.delete(empresa)
            count += 1
        else:
            skipped += 1

    await db.commit()
    return {"deleted": count, "skipped": skipped}

@router.post("/bulk-update")
async def update_empresas_bulk(
    data: EmpresaScopedUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Update empresas by scope. Handles M2M merge/remove/replace. Rejects empty scope."""
    query = select(Empresa).options(
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
    )
    query = apply_scope(
        query, model=Empresa,
        ids=data.ids, filters=data.filters,
        apply_filters_fn=_apply_empresa_filters,
        allow_all=data.all is True,
    )

    result = await db.execute(query)
    empresas = result.scalars().all()

    if not empresas:
        return {"updated": 0}

    # Load M2M targets if needed
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

from app.services.validators import ToolValidationErrorException
from fastapi import Response

@router.post("/enrich", response_model=CompanyEnrichSuccessResponse)
async def enrich_empresas(
    request: CompanyEnrichRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Enrich a set of empresas using an external tool.
    Supports specific IDs or dynamic filters with STRICT validation.
    """
    try:
        return await enrichment_service.trigger_company_enrichment(db, request)
    except ToolValidationErrorException as e:
        return Response(
            content=e.error.model_dump_json(),
            status_code=400,
            media_type="application/json"
        )
