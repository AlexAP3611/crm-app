from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.provincia import Provincia
from app.core.exceptions import DuplicateEntityError


def normalize_name(name: str) -> str | None:
    """Normalize a province name: strip whitespace."""
    if not name:
        return None
    cleaned = name.strip()
    return cleaned if cleaned else None


async def get_all(session: AsyncSession, pais_id: int | None = None) -> list[Provincia]:
    """Return all provinces, optionally filtered by pais_id, ordered by name."""
    q = select(Provincia).order_by(Provincia.name)
    if pais_id is not None:
        q = q.where(Provincia.pais_id == pais_id)
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, provincia_id: int) -> Provincia | None:
    return await session.get(Provincia, provincia_id)


async def get_by_name_and_pais(
    session: AsyncSession, name: str, pais_id: int
) -> Provincia | None:
    norm = normalize_name(name)
    if not norm:
        return None
    result = await session.execute(
        select(Provincia).where(
            func.lower(Provincia.name) == norm.lower(),
            Provincia.pais_id == pais_id
        )
    )
    return result.scalar_one_or_none()


async def get_or_create(
    session: AsyncSession, name: str, pais_id: int
) -> Provincia | None:
    """Get existing province by name+pais_id (case-insensitive) or create it."""
    norm = normalize_name(name)
    if not norm or not pais_id:
        return None
    existing = await get_by_name_and_pais(session, norm, pais_id)
    if existing:
        return existing
    provincia = Provincia(name=norm, pais_id=pais_id)
    session.add(provincia)
    try:
        await session.flush()
        return provincia
    except IntegrityError:
        await session.rollback()
        return await get_by_name_and_pais(session, norm, pais_id)


async def create_strict(
    session: AsyncSession, name: str, pais_id: int
) -> Provincia:
    """Create a province, raising DuplicateEntityError if it already exists."""
    norm = normalize_name(name)
    if not norm:
        raise ValueError("El nombre de la provincia no puede estar vacío")
    existing = await get_by_name_and_pais(session, norm, pais_id)
    if existing:
        raise DuplicateEntityError(f"La provincia '{norm}' ya existe para ese país")
    provincia = Provincia(name=norm, pais_id=pais_id)
    session.add(provincia)
    await session.flush()
    return provincia


async def prefill_cache(
    session: AsyncSession, names: set[str], pais_id: int
) -> dict[str, Provincia]:
    """Batch-fetch existing provinces by name for a given pais_id. Returns {lower_name: Provincia}."""
    if not names or not pais_id:
        return {}
    lower_names = [n.lower() for n in names if n]
    result = await session.execute(
        select(Provincia).where(
            func.lower(Provincia.name).in_(lower_names),
            Provincia.pais_id == pais_id
        )
    )
    return {p.name.lower(): p for p in result.scalars().all()}
