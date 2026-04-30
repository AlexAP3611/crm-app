from typing import Dict, Set, Optional, Any
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.empresa import Empresa

class IdentityCache:
    """
    In-memory lookup cache for existing entities to prevent N+1 queries.
    Stores maps of identifiers to entity IDs or objects.
    """
    def __init__(self):
        self.by_cif: Dict[str, Empresa] = {}
        self.by_web: Dict[str, Empresa] = {}
        self.by_name: Dict[str, Empresa] = {}
        self.by_id: Dict[int, Empresa] = {}

    def add(self, empresa: Empresa):
        """Adds or updates an empresa in the cache."""
        if empresa.id: self.by_id[empresa.id] = empresa
        if empresa.cif: self.by_cif[empresa.cif.strip()] = empresa
        if empresa.web: self.by_web[empresa.web.strip().lower()] = empresa
        if empresa.nombre: self.by_name[empresa.nombre.strip().lower()] = empresa

    def get_by_identity(self, cif: Optional[str] = None, web: Optional[str] = None, name: Optional[str] = None) -> Optional[Empresa]:
        """Strict priority resolution from cache: CIF > Web > Name."""
        if cif and cif.strip() in self.by_cif:
            return self.by_cif[cif.strip()]
        
        if web:
            norm_web = web.strip().lower()
            if norm_web in self.by_web:
                return self.by_web[norm_web]
                
        if name:
            norm_name = name.strip().lower()
            if norm_name in self.by_name:
                return self.by_name[norm_name]
        
        return None

async def prefetch_empresas(db: AsyncSession, identifiers: Dict[str, Set[Any]]) -> IdentityCache:
    """
    Scans a set of identifiers and fetches all matching Empresas in bulk.
    Expected identifiers: {'cif': set(), 'web': set(), 'nombre': set()}
    """
    cache = IdentityCache()
    
    conditions = []
    if identifiers.get("cif"):
        conditions.append(Empresa.cif.in_(list(identifiers["cif"])))
    if identifiers.get("web"):
        conditions.append(Empresa.web.in_(list(identifiers["web"])))
    if identifiers.get("nombre"):
        # Case-insensitive name match
        names = [n.lower() for n in identifiers["nombre"]]
        conditions.append(Empresa.nombre.ilike(or_(*[f"%{n}%" for n in names]))) # Caution: ilike in bulk can be slow, but better than N queries

    if not conditions:
        return cache

    # Optimization: For names, we prefer exact matches if possible to avoid complex ILIKE
    # But for a robust pre-fetch, we use OR.
    query = select(Empresa).where(or_(*conditions))
    result = await db.execute(query)
    
    for emp in result.scalars().all():
        cache.add(emp)
        
    return cache

def extract_identifiers(rows: list[dict]) -> dict[str, Set[Any]]:
    """
    Scans raw rows to find potential identifiers for pre-fetching.
    Does NOT do mapping yet, just looks for common keys.
    """
    ids = {"cif": set(), "web": set(), "nombre": set()}
    # Common aliases used during pre-fetch before formal mapping
    cif_aliases = {"cif", "empresa_cif", "vat"}
    web_aliases = {"web", "empresa_web", "website", "url"}
    name_aliases = {"nombre", "empresa_nombre", "name", "company"}

    for row in rows:
        row_lower = {str(k).lower(): v for k, v in row.items()}
        
        for k, v in row_lower.items():
            if not v: continue
            if k in cif_aliases: ids["cif"].add(str(v).strip())
            if k in web_aliases: ids["web"].add(str(v).strip().lower())
            if k in name_aliases: ids["nombre"].add(str(v).strip())
            
    return ids
