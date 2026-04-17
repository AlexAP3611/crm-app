import re
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
    # Replace dots and other symbols with spaces
    val = val.replace(".", " ")
    val = re.sub(r'[^a-z0-9\s]', ' ', val)
    # Collapse spaces
    val = re.sub(r'\s+', ' ', val).strip()
    return val

async def resolve_cargo(session: AsyncSession, raw_value: str) -> Cargo | None:
    """
    Pipeline: Syntax Normalization -> Semantic Alias Expansion -> DB Lookup/Create
    """
    if not raw_value:
        return None
    
    # 1. Normalize syntax
    norm = normalize_job_title(raw_value)
    if not norm:
        return None
    
    # 2. Expand Semantic Aliases
    norm = ALIAS_MAP.get(norm, norm)
    
    # 3. Lookup in DB
    result = await session.execute(
        select(Cargo).where(Cargo.normalized_name == norm)
    )
    cargo = result.scalar_one_or_none()
    
    if cargo:
        return cargo
    
    # 4. Create if not exists
    # If no alias was applied, use the original raw value for the display name.
    # If an alias was applied, use title-cased 'norm' for a clean display name.
    display_name = norm.title() if norm != normalize_job_title(raw_value) else raw_value.strip()

    new_cargo = Cargo(
        name=display_name,
        normalized_name=norm
    )
    session.add(new_cargo)
    await session.flush()
    
    return new_cargo
