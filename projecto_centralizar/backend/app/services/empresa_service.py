from typing import Literal, NamedTuple, Optional
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products
from app.schemas.empresa import EmpresaListResponse, EmpresaFilterParams, EmpresaCreate
from app.core.utils import normalize_company_name

class ResolveEmpresaResult(NamedTuple):
    empresa: Empresa
    created: bool
    matched_by: Literal["cif", "web", "name", "new"]

async def resolve_empresa(
    db: AsyncSession, 
    empresa_id: int | None = None, 
    cif: str | None = None,
    web: str | None = None,
    empresa_nombre: str | None = None,
    auto_create: bool = True
) -> ResolveEmpresaResult | None:
    """
    Resolves an Empresa by ID, CIF, Website, or Name.
    Strict priority: CIF > Web > Nombre.
    Email is NOT used for identity resolution.
    Returns ResolveEmpresaResult. If auto_create=False and not found, returns None.
    If auto_create=True, always returns ResolveEmpresaResult.
    """
    if empresa_id:
        emp = (await db.execute(select(Empresa).where(Empresa.id == empresa_id))).scalar_one_or_none()
        if emp:
            return ResolveEmpresaResult(empresa=emp, created=False, matched_by="cif") # Default to cif or generic for id match
            
    existing_emp = None
    matched_by = None
    
    if cif:
        existing_emp = (await db.execute(select(Empresa).where(Empresa.cif == cif.strip()))).scalar_one_or_none()
        if existing_emp:
            matched_by = "cif"
    
    if not existing_emp and web:
        existing_emp = (await db.execute(select(Empresa).where(Empresa.web == web.strip()))).scalar_one_or_none()
        if existing_emp:
            matched_by = "web"
        
    if not existing_emp and empresa_nombre:
        norm_name = normalize_company_name(empresa_nombre)
        existing_emp = (await db.execute(select(Empresa).where(func.lower(Empresa.nombre) == norm_name.lower()))).scalar_one_or_none()
        if existing_emp:
            matched_by = "name"

    if existing_emp:
        return ResolveEmpresaResult(empresa=existing_emp, created=False, matched_by=matched_by)
        
    if not auto_create or not empresa_nombre:
        return None

    # Try to create a new one
    try:
        norm_name = normalize_company_name(empresa_nombre)
        new_emp = Empresa(nombre=norm_name)
        db.add(new_emp)
        await db.flush()
        return ResolveEmpresaResult(empresa=new_emp, created=True, matched_by="new")
    except IntegrityError:
        await db.rollback()
        # Race condition: try fetching again by name
        existing_emp = (await db.execute(select(Empresa).where(func.lower(Empresa.nombre) == norm_name.lower()))).scalar_one_or_none()
        if existing_emp:
            return ResolveEmpresaResult(empresa=existing_emp, created=False, matched_by="name")
        raise

async def upsert_empresa(session: AsyncSession, data: EmpresaCreate) -> tuple[Empresa, str]:
    """
    Core domain logic to upsert an Empresa based on the identity hierarchy.
    Domain Layer decides only base model state, NO M2M.
    Returns (Empresa, "created"|"updated").
    """
    if data.nombre:
        data.nombre = normalize_company_name(data.nombre)

    resolution = await resolve_empresa(
        session,
        cif=data.cif,
        web=data.web,
        empresa_nombre=data.nombre,
        auto_create=False
    )

    action = "skipped"
    payload = data.model_dump(exclude={"sector_ids", "vertical_ids", "product_ids"}, exclude_unset=True)

    if resolution:
        # Update existing Base Entity
        emp = resolution.empresa
        for field, value in payload.items():
            if value is not None:
                setattr(emp, field, value)
        action = "updated"
    else:
        # Prevent empty names
        if not data.nombre:
            raise ValueError("Empresa requires a valid non-empty name.")
        emp = Empresa(**payload)
        session.add(emp)
        action = "created"
        
    return emp, action

def _apply_empresa_filters(query, filters: EmpresaFilterParams):
    """
    Private utility to apply filters to an Empresa query.
    Centralizes filtering logic for both paged views and unpaginated exports.
    """
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
    
    return query

async def list_empresas(
    db: AsyncSession,
    filters: EmpresaFilterParams,
) -> EmpresaListResponse:
    query = select(Empresa)
    query = _apply_empresa_filters(query, filters)

    # 1. Precise Count using DISTINCT to handle M2M joins in filters
    # We strip eager loads and ordering for the count query performance
    count_stmt = select(func.count(func.distinct(Empresa.id))).select_from(query.subquery())
    total = await db.scalar(count_stmt) or 0

    # 2. Results with Eager Loading and Stable Sort (Name + ID as tie-breaker)
    query = query.options(
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
    ).order_by(Empresa.nombre, Empresa.id.desc())

    # 3. Apply Pagination (Offset calculated internally)
    offset = (filters.page - 1) * filters.page_size
    query = query.offset(offset).limit(filters.page_size)
    
    result = await db.execute(query)
    # unique() is still needed because of selectinload and potential joins in _apply_empresa_filters
    items = result.scalars().unique().all()
    
    return EmpresaListResponse(
        total=total,
        page=filters.page,
        page_size=filters.page_size,
        items=list(items)
    )

async def list_empresas_unpaginated(
    db: AsyncSession,
    filters: Optional[EmpresaFilterParams] = None,
    ids: Optional[list[int]] = None
) -> list[Empresa]:
    """
    Fetches full Empresa ORM objects without pagination.
    Used for enrichment and exports.
    """
    query = select(Empresa)
    
    if filters:
        query = _apply_empresa_filters(query, filters)
    
    if ids:
        query = query.where(Empresa.id.in_(ids))
        
    # Ensure all M2M are loaded via selectinload
    query = query.options(
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
    )
    
    query = query.order_by(Empresa.nombre).distinct()
    
    result = await db.execute(query)
    return list(result.scalars().unique().all())
