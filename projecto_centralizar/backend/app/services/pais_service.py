from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.pais import Pais
from app.core.exceptions import DuplicateEntityError


def normalize_name(name: str) -> str | None:
    """Normalize a country name: strip whitespace and title-case."""
    if not name:
        return None
    cleaned = name.strip()
    return cleaned if cleaned else None


async def get_all(session: AsyncSession) -> list[Pais]:
    """Return all countries ordered by name (España first)."""
    from sqlalchemy import case
    stmt = select(Pais).order_by(
        case(
            (func.lower(Pais.name) == 'españa', 0),
            else_=1
        ),
        Pais.name
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, pais_id: int) -> Pais | None:
    return await session.get(Pais, pais_id)


async def get_by_name(session: AsyncSession, name: str) -> Pais | None:
    norm = normalize_name(name)
    if not norm:
        return None
    result = await session.execute(
        select(Pais).where(func.lower(Pais.name) == norm.lower())
    )
    return result.scalar_one_or_none()


async def get_or_create(session: AsyncSession, name: str) -> Pais | None:
    """Get existing country by name (case-insensitive) or create it."""
    norm = normalize_name(name)
    if not norm:
        return None
    existing = await get_by_name(session, norm)
    if existing:
        return existing
    pais = Pais(name=norm)
    session.add(pais)
    try:
        await session.flush()
        return pais
    except IntegrityError:
        await session.rollback()
        return await get_by_name(session, norm)


async def create_strict(session: AsyncSession, name: str) -> Pais:
    """Create a country, raising DuplicateEntityError if it already exists."""
    norm = normalize_name(name)
    if not norm:
        raise ValueError("El nombre del país no puede estar vacío")
    existing = await get_by_name(session, norm)
    if existing:
        raise DuplicateEntityError(f"El país '{norm}' ya existe")
    pais = Pais(name=norm)
    session.add(pais)
    await session.flush()
    return pais


async def prefill_cache(session: AsyncSession, names: set[str]) -> dict[str, Pais]:
    """Batch-fetch existing countries by name. Returns {lower_name: Pais}."""
    if not names:
        return {}
    lower_names = [n.lower() for n in names if n]
    result = await session.execute(
        select(Pais).where(func.lower(Pais.name).in_(lower_names))
    )
    return {p.name.lower(): p for p in result.scalars().all()}
