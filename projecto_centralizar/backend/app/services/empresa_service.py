from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.empresa import Empresa

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
