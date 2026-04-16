import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.cargo import Cargo

ALIAS_MAP = {
    "cmo": "chief marketing officer",
    "ceo": "chief executive officer",
    "cto": "chief technology officer",
    "cfo": "chief financial officer",
    "vp of engineering": "vice president of engineering",
    "head of marketing": "chief marketing officer",
}

def normalize_job_title(raw_value: str) -> str:
    """
    Standardize raw job title strings:
    - Lowercase
    - Trim whitespace
    - Collapse multiple spaces
    """
    if not raw_value:
        return ""
    val = raw_value.lower().strip()
    val = re.sub(r'\s+', ' ', val)
    return val

async def resolve_cargo(session: AsyncSession, raw_value: str) -> Cargo | None:
    """
    Find or create a Cargo entity centered around a normalized job title.
    """
    if not raw_value:
        return None
    
    # 1. Normalize
    norm = normalize_job_title(raw_value)
    if not norm:
        return None
    
    # 2. Expand Aliases
    # Check if the normalized string is a key in the ALIAS_MAP
    norm = ALIAS_MAP.get(norm, norm)
    
    # 3. Lookup in DB
    result = await session.execute(
        select(Cargo).where(Cargo.normalized_name == norm)
    )
    cargo = result.scalar_one_or_none()
    
    if cargo:
        return cargo
    
    # 4. Create if not exists
    # Use the original raw value (trimmed) for the 'name' (display)
    # but the expanded/normalized value for 'normalized_name' (unique key)
    new_cargo = Cargo(
        name=raw_value.strip(),
        normalized_name=norm
    )
    session.add(new_cargo)
    await session.flush()  # Get ID without committing transaction
    
    return new_cargo
