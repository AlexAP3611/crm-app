from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products
from app.schemas.empresa import EmpresaListResponse, EmpresaFilterParams

async def resolve_empresa(db: AsyncSession, empresa_id: int | None, empresa_nombre: str | None) -> int:
    """
    Resolves an Empresa by ID or Name. 
    1. If empresa_id is provided, use it.
    2. If not, search for an existing Empresa by name (case-insensitive).
    3. If not found, create a new Empresa.
    4. Handles race conditions with re-selection on IntegrityError.
    """
    if empresa_id:
        # We assume the ID is valid if provided by the frontend.
        return empresa_id

    if not empresa_nombre:
        return None

    # 1. Search for existing empresa by name (case-insensitive)
    query = select(Empresa.id).where(func.lower(Empresa.nombre) == empresa_nombre.strip().lower())
    result = await db.execute(query)
    existing_id = result.scalar_one_or_none()
    
    if existing_id:
        return existing_id

    # 2. Try to create a new one
    try:
        new_emp = Empresa(nombre=empresa_nombre.strip())
        db.add(new_emp)
        await db.flush()  # We flush to get the ID and check for constraints
        return new_emp.id
    except IntegrityError:
        # Race condition: someone else created it between our SELECT and INSERT
        await db.rollback()
        # Retry selection
        query = select(Empresa.id).where(func.lower(Empresa.nombre) == empresa_nombre.strip().lower())
        result = await db.execute(query)
        existing_id = result.scalar_one_or_none()
        if existing_id:
            return existing_id
        raise  # Should not happen with the index in place, but re-raise if it still fails

async def list_empresas(
    db: AsyncSession,
    filters: EmpresaFilterParams,
    limit: int = 50,
    offset: int = 0
) -> EmpresaListResponse:
    query = select(Empresa)

    if filters.q:
        query = query.where(Empresa.nombre.ilike(f"%{filters.q}%"))

    # Empresa M2M filters (now via association tables)
    if filters.sector_id is not None:
        query = query.join(empresa_sectors, Empresa.id == empresa_sectors.c.empresa_id).where(
            empresa_sectors.c.sector_id == filters.sector_id
        )
    if filters.vertical_id is not None:
        query = query.join(empresa_verticals, Empresa.id == empresa_verticals.c.empresa_id).where(
            empresa_verticals.c.vertical_id == filters.vertical_id
        )
    if filters.product_id is not None:
        query = query.join(empresa_products, Empresa.id == empresa_products.c.empresa_id).where(
            empresa_products.c.product_id == filters.product_id
        )

    if filters.numero_empleados_min is not None:
        query = query.where(Empresa.numero_empleados >= filters.numero_empleados_min)
    if filters.numero_empleados_max is not None:
        query = query.where(Empresa.numero_empleados <= filters.numero_empleados_max)
    if filters.facturacion_min is not None:
        query = query.where(Empresa.facturacion >= filters.facturacion_min)
    if filters.facturacion_max is not None:
        query = query.where(Empresa.facturacion <= filters.facturacion_max)
    if filters.cnae:
        query = query.where(Empresa.cnae.startswith(filters.cnae))

    # Always eagerly load Empresa's own M2M
    query = query.options(
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
    )
        
    query = query.order_by(Empresa.nombre).distinct()
    
    # Extract count before pagination
    count_query = select(func.count(func.distinct(Empresa.id))).select_from(query.with_only_columns(Empresa.id).order_by(None).subquery())
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
