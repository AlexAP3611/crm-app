"""
Servicio CRUD para la entidad CategoriaCargo.

Usa M2MEntityService como base (mismo patrón que sector_service, product_service, etc.)
Añade get_by_id para el endpoint PATCH de cargos.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.categoria_cargo import CategoriaCargo
from app.services.m2m_base_service import M2MEntityService

# Singleton genérico
_service = M2MEntityService(CategoriaCargo)


def normalize_name(name: str) -> str | None:
    """Normalización síncrona del nombre."""
    return _service.normalize_name(name)


async def get_all(session: AsyncSession) -> list[CategoriaCargo]:
    """Retorna todas las categorías ordenadas alfabéticamente."""
    result = await session.execute(
        select(CategoriaCargo).order_by(CategoriaCargo.name)
    )
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, categoria_id: int) -> CategoriaCargo | None:
    """Busca una categoría por PK."""
    return await session.get(CategoriaCargo, categoria_id)


async def get_or_create(
    session: AsyncSession,
    name: str,
    cache: dict[str, CategoriaCargo] | None = None,
) -> CategoriaCargo | None:
    """Idempotent get-or-create. Usado por el ingest de N8N."""
    return await _service.get_or_create(session, name, cache=cache)


async def create_strict(session: AsyncSession, name: str) -> CategoriaCargo:
    """Creación estricta para UI. Lanza DuplicateEntityError si ya existe."""
    return await _service.create_strict(session, name)
