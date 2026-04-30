from typing import Dict, List, Set, NamedTuple

class AliasEntry(NamedTuple):
    canonical: str
    priority: int = 10  # Higher means more authority (e.g., prefixed aliases)

class FieldAliasRegistry:
    """
    Centralized registry for column aliases.
    Supports entity-specific mapping and global priority rules.
    """
    def __init__(self):
        self.mappings: Dict[str, AliasEntry] = {}

    def register(self, canonical: str, aliases: List[str], priority: int = 10):
        for alias in aliases:
            self.mappings[alias.lower().strip()] = AliasEntry(canonical, priority)

    def resolve(self, external_name: str) -> str | None:
        return self.mappings.get(external_name.lower().strip(), None)

# --- Entity Specific Registries ---

# Empresa canonical fields
EMPRESA_REGISTRY = FieldAliasRegistry()
EMPRESA_REGISTRY.register("nombre", ["empresa_nombre", "nombre", "empresa", "company", "company_name", "name"], priority=20)
EMPRESA_REGISTRY.register("web", ["empresa_web", "web", "website", "url", "site"], priority=20)
EMPRESA_REGISTRY.register("email", ["empresa_email", "email", "correo", "mail"], priority=20)
EMPRESA_REGISTRY.register("phone", ["empresa_phone", "phone", "telefono", "tel", "mobile"], priority=20)
EMPRESA_REGISTRY.register("cif", ["empresa_cif", "cif", "vat", "vat_number"], priority=20)
EMPRESA_REGISTRY.register("numero_empleados", ["numero_empleados", "employees", "size", "empleados"], priority=10)
EMPRESA_REGISTRY.register("facturacion", ["facturacion", "revenue", "turnover", "ventas"], priority=10)
EMPRESA_REGISTRY.register("cnae", ["cnae", "industry_code", "actividad"], priority=10)
EMPRESA_REGISTRY.register("facebook", ["facebook", "fb_url", "facebook_url"], priority=10)
EMPRESA_REGISTRY.register("web_competidor_1", ["competidor_1", "competitor_1", "web_competidor_1", "competidor 1", "dominio competidor 1"], priority=10)
EMPRESA_REGISTRY.register("web_competidor_2", ["competidor_2", "competitor_2", "web_competidor_2", "competidor 2", "dominio competidor 2"], priority=10)
EMPRESA_REGISTRY.register("web_competidor_3", ["competidor_3", "competitor_3", "web_competidor_3", "competidor 3", "dominio competidor 3"], priority=10)

# Relationship fields
EMPRESA_REGISTRY.register("sector_name", ["sector", "industria", "industry"], priority=10)
EMPRESA_REGISTRY.register("vertical_name", ["vertical", "subsector"], priority=10)
EMPRESA_REGISTRY.register("product_name", ["producto", "product", "servicio"], priority=10)
