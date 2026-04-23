import re
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert
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
    # Use title case if it was an alias expansion, otherwise keep original casing (trimmed)
    return norm.title() if norm != normalize_job_title(raw_value) else raw_value.strip()

async def prefill_cargo_cache(db: AsyncSession, raw_titles: set[str]) -> dict[str, Cargo]:
    """
    Optimization: Fetch existing cargos for a batch of titles.
    Returns: Dict[normalized_name, Cargo]
    """
    if not raw_titles:
        return {}
    
    # Generate set of normalized names to query
    norms = {n for t in raw_titles if (n := _get_canonical_name(t))}
    if not norms:
        return {}
    
    result = await db.execute(
        select(Cargo).where(Cargo.normalized_name.in_(norms))
    )
    return {c.normalized_name: c for c in result.scalars().all()}

async def get_or_create_cargo(db: AsyncSession, raw_title: str, cache: dict[str, Cargo] | None = None) -> Cargo | None:
    """
    Single source of truth for Cargo resolution.
    - Normalizes raw_title
    - Uses provided cache (dict[normalized_name, Cargo]) for performance
    - Uses PG ON CONFLICT DO NOTHING + SELECT for atomic safety
    """
    if not raw_title or not raw_title.strip():
        return None
    
    norm = _get_canonical_name(raw_title)
    if not norm:
        return None
    
    # 1. Cache hit
    if cache is not None and norm in cache:
        return cache[norm]
    
    # 2. DB Select (Fast path for existing)
    result = await db.execute(select(Cargo).where(Cargo.normalized_name == norm))
    cargo = result.scalars().first()
    
    if not cargo:
        # 3. Atomic DB Insert
        display_name = _get_display_name(raw_title, norm)
        
        # Using PostgreSQL specific insert for atomic safety
        stmt = insert(Cargo).values(
            name=display_name,
            normalized_name=norm
        ).on_conflict_do_nothing(
            index_elements=['normalized_name']
        ).returning(Cargo)
        
        insert_res = await db.execute(stmt)
        cargo = insert_res.scalar_one_or_none()
        
        if not cargo:
            # 4. Collision fallback (created by someone else between step 2 and 3)
            result = await db.execute(select(Cargo).where(Cargo.normalized_name == norm))
            cargo = result.scalars().first()
        
    # 5. Populate cache for next calls in this session
    if cache is not None and cargo:
        cache[norm] = cargo
        
    return cargo
