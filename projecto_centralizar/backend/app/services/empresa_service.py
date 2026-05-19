from typing import Literal, NamedTuple, Optional
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products, Competidor
from app.schemas.empresa import EmpresaListResponse, EmpresaFilterParams, EmpresaCreate, CompetidorBase
from app.core.utils import normalize_company_name, normalize_web

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
    """
    if empresa_id:
        emp = (await db.execute(select(Empresa).where(Empresa.id == empresa_id))).scalar_one_or_none()
        if emp:
            return ResolveEmpresaResult(empresa=emp, created=False, matched_by="cif")
            
    existing_emp = None
    matched_by = None
    
    # 1. CIF Resolution (Primary)
    if cif and cif.strip():
        existing_emp = (await db.execute(select(Empresa).where(Empresa.cif == cif.strip()))).scalar_one_or_none()
        if existing_emp:
            matched_by = "cif"
    
    # 2. WEB Resolution (Normalized)
    if not existing_emp and web:
        norm_web = normalize_web(web)
        if norm_web:
            existing_emp = (await db.execute(select(Empresa).where(Empresa.web == norm_web))).scalar_one_or_none()
            if existing_emp:
                matched_by = "web"
        
    # 3. NAME Resolution (Normalized)
    if not existing_emp and empresa_nombre:
        norm_name = normalize_company_name(empresa_nombre)
        if norm_name:
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

async def sync_competidores(session: AsyncSession, empresa_id: int, competidores_data: list[CompetidorBase] | None):
    """
    Syncs competitors for a company.
    - None: Preserve existing (do nothing).
    - []: Clear all.
    - List: Upsert by position. Non-destructive updates.
    """
    if competidores_data is None:
        return

    # 1. Clear all if empty list
    if not competidores_data:
        await session.execute(delete(Competidor).where(Competidor.empresa_id == empresa_id))
        return

    # 2. Load existing competitors
    result = await session.execute(
        select(Competidor).where(Competidor.empresa_id == empresa_id)
    )
    existing_comps = result.scalars().all()
    existing_by_pos = {c.posicion: c for c in existing_comps}

    # 3. Process new data (limit to positions 1, 2, 3 and avoid duplicates)
    seen_positions = set()
    for c_data in competidores_data:
        pos = c_data.posicion
        if not (1 <= pos <= 3) or pos in seen_positions:
            continue
        seen_positions.add(pos)

        # Normalize/clean inputs
        web_val = normalize_web(c_data.web) if c_data.web else None
        fb_val = c_data.facebook.strip() if (c_data.facebook and isinstance(c_data.facebook, str)) else c_data.facebook
        if fb_val == "":
            fb_val = None

        if pos in existing_by_pos:
            # UPDATE: Only overwrite if new value is not None
            existing_comp = existing_by_pos[pos]
            if web_val is not None:
                existing_comp.web = web_val
            if fb_val is not None:
                existing_comp.facebook = fb_val
        else:
            # INSERT: Create new only if we have at least one field
            if web_val is not None or fb_val is not None:
                session.add(Competidor(
                    empresa_id=empresa_id,
                    posicion=pos,
                    web=web_val,
                    facebook=fb_val
                ))

async def upsert_empresa(session: AsyncSession, data: EmpresaCreate) -> tuple[Empresa, str]:
    """
    Core domain logic to upsert an Empresa based on the identity hierarchy.
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
    payload = data.model_dump(exclude={"sector_ids", "vertical_ids", "product_ids", "competidores"}, exclude_unset=True)

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
        await session.flush() # Ensure ID for competitors
        action = "created"
    
    # Sync competitors
    await sync_competidores(session, emp.id, data.competidores)
        
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
    if filters.provincia_id is not None:
        query = query.where(Empresa.provincia_id == filters.provincia_id)
    if filters.pais_id is not None:
        query = query.where(Empresa.pais_id == filters.pais_id)
    
    return query

async def list_empresas(
    db: AsyncSession,
    filters: EmpresaFilterParams,
) -> EmpresaListResponse:
    query = select(Empresa)
    query = _apply_empresa_filters(query, filters)

    # 1. Precise Count using DISTINCT to handle M2M joins in filters
    # We strip eager loads and ordering for the count query performance

    #OPCION ORIGINAL QUE NO CUENTA FILTROS
    count_stmt = select(func.count()).select_from(query.distinct(Empresa.id).subquery())
    
    total = await db.scalar(count_stmt) or 0

    # 2. Results with Eager Loading and Stable Sort (Name + ID as tie-breaker)
    query = query.options( 
        selectinload(Empresa.sectors),
        selectinload(Empresa.verticals),
        selectinload(Empresa.products_rel),
        selectinload(Empresa.competidores),
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


