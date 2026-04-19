import re
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.cargo import Cargo

ALIAS_MAP = {
    "cmo": "chief marketing officer",
    "c m o": "chief marketing officer",
    "ceo": "chief executive officer",
    "c e o": "chief executive officer",
    "cto": "chief technology officer",
    "c t o": "chief technology officer",
    "cfo": "chief financial officer",
    "c f o": "chief financial officer",
    "vp of engineering": "vice president of engineering",
    "head of marketing": "chief marketing officer",
}

class CargoResolutionResult(BaseModel):
    id_map: dict[str, int]
    created: list[str]
    missed: list[str]


def normalize_job_title(raw_value: str) -> str:
    """
    Standardize job title syntax:
    1. Lowercase
    2. Remove dots entirely (c.m.o -> cmo)
    3. Replace other symbols with spaces
    4. Collapse multiple spaces and trim
    """
    if not raw_value:
        return ""
    
    val = raw_value.lower().strip()
    val = val.replace(".", " ")
    val = re.sub(r'[^a-z0-9\s]', ' ', val)
    val = re.sub(r'\s+', ' ', val).strip()
    return val

def _get_canonical_name(raw_value: str) -> str | None:
    norm = normalize_job_title(raw_value)
    if not norm:
        return None
    return ALIAS_MAP.get(norm, norm)

def _get_display_name(raw_value: str, norm: str) -> str:
    return norm.title() if norm != normalize_job_title(raw_value) else raw_value.strip()


async def resolve_cargo(session: AsyncSession, raw_value: str) -> Cargo | None:
    """
    Pipeline: Syntax Normalization -> Semantic Alias Expansion -> DB Lookup/Create
    """
    if not raw_value:
        return None
    
    norm = _get_canonical_name(raw_value)
    if not norm:
        return None
    
    result = await session.execute(
        select(Cargo).where(Cargo.normalized_name == norm)
    )
    cargo = result.scalar_one_or_none()
    
    if cargo:
        return cargo
    
    display_name = _get_display_name(raw_value, norm)
    new_cargo = Cargo(name=display_name, normalized_name=norm)
    session.add(new_cargo)
    await session.flush()
    
    return new_cargo


async def resolve_cargos_bulk(session: AsyncSession, raw_titles: set[str]) -> CargoResolutionResult:
    """
    Bulk resolve Job Titles to Cargo IDs.
    Returns observability schema to decouple logic domains.
    """
    res = await session.execute(select(Cargo))
    cargo_map = {c.normalized_name: c for c in res.scalars().all() if c.normalized_name}

    id_map = {}
    created_names = []
    missed_names = []

    new_cargos = []
    
    for title in raw_titles:
        if not title:
            continue
            
        norm = _get_canonical_name(title)
        if not norm:
            missed_names.append(title)
            continue
            
        cargo = cargo_map.get(norm)
        if cargo:
            id_map[title] = cargo.id
        else:
            display_name = _get_display_name(title, norm)
            new_cargo = Cargo(name=display_name, normalized_name=norm)
            session.add(new_cargo)
            # Link it mentally for deduplication within exact same batch
            cargo_map[norm] = new_cargo
            new_cargos.append((title, new_cargo))
            created_names.append(title)
    
    if new_cargos:
        await session.flush()
        for title, loaded_cargo in new_cargos:
            id_map[title] = loaded_cargo.id
            
    return CargoResolutionResult(
        id_map=id_map,
        created=created_names,
        missed=missed_names
    )
