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
EMPRESA_REGISTRY.register("nombre", ["empresa_nombre", "nombre", "empresa", "company", "Nombre empresa", "name"], priority=20)
EMPRESA_REGISTRY.register("web", ["empresa_web", "web", "website", "url", "site", "empresa_web", "Web Empresa"], priority=20)
EMPRESA_REGISTRY.register("email", ["empresa_email", "email", "correo", "mail", "empresa_email", "Email empresa"], priority=20)
EMPRESA_REGISTRY.register("phone", ["empresa_phone", "phone", "telefono", "tel", "mobile", "empresa_telefono", "telefono empresa", "Telefono empresa"], priority=20)
EMPRESA_REGISTRY.register("cif", ["empresa_cif", "cif", "nif" "vat", "vat_number", "empresa_cif", "CIF empresa"], priority=20)
EMPRESA_REGISTRY.register("numero_empleados", ["numero_empleados", "employees", "size", "empleados", "num_empleados", "Numero empleados"], priority=10)
EMPRESA_REGISTRY.register("facturacion", ["facturacion", "revenue", "turnover", "ventas", "Facturacion"], priority=10)
EMPRESA_REGISTRY.register("cnae", ["cnae", "industry_code", "actividad", "CNAE", "actividad cnae", "Actividad cnae", "Actividad CNAE"], priority=10)
EMPRESA_REGISTRY.register("facebook", ["facebook", "fb_url", "facebook_url", "Facebook empresa"], priority=10)
EMPRESA_REGISTRY.register("web_competidor_1", ["competidor_1", "competitor_1", "web_competidor_1", "competidor 1", "dominio competidor 1", "web_competidor_1", "Web competidor 1"], priority=10)
EMPRESA_REGISTRY.register("web_competidor_2", ["competidor_2", "competitor_2", "web_competidor_2", "competidor 2", "dominio competidor 2", "web_competidor_2", "Web competidor 2"], priority=10)
EMPRESA_REGISTRY.register("web_competidor_3", ["competidor_3", "competitor_3", "web_competidor_3", "competidor 3", "dominio competidor 3", "web_competidor_3", "Web competidor 3"], priority=10)
EMPRESA_REGISTRY.register("facebook_competidor_1", ["Facebook competidor 1", "Competidor 1 Facebook", "Competitor 1 Facebook"], priority=10)
EMPRESA_REGISTRY.register("facebook_competidor_2", ["Facebook competidor 2", "Competidor 2 Facebook", "Competitor 2 Facebook"], priority=10)
EMPRESA_REGISTRY.register("facebook_competidor_3", ["Facebook competidor 3", "Competidor 3 Facebook", "Competitor 3 Facebook"], priority=10)
EMPRESA_REGISTRY.register("provincia", ["provincia", "province", "state", "región", "region", "comunidad", "Provincia empresa"], priority=10)
EMPRESA_REGISTRY.register("pais", ["pais", "país", "country", "nation", "Pais empresa"], priority=10)

# Relationship fields
EMPRESA_REGISTRY.register("sector_name", ["sector", "industria", "industry", "sectores", "Sector"], priority=10)
EMPRESA_REGISTRY.register("vertical_name", ["vertical", "subsector", "verticales", "Vertical"], priority=10)
EMPRESA_REGISTRY.register("product_name", ["producto", "product", "servicio", "productos", "Producto"], priority=10)

# Contact canonical fields
CONTACT_REGISTRY = FieldAliasRegistry()
CONTACT_REGISTRY.register("first_name", ["nombre", "contact_name", "first_name", "full_name", "nombre completo", "contacto", "Nombre"], priority=20)
CONTACT_REGISTRY.register("last_name", ["apellido", "last_name", "surname", "apellidos", "Apellidos"], priority=20)
CONTACT_REGISTRY.register("email", ["email", "correo", "mail", "email_address", "correo electrónico", "Email"], priority=20)
CONTACT_REGISTRY.register("phone", ["phone", "telefono", "tel", "mobile", "celular", "teléfono", "Telefono"], priority=20)
CONTACT_REGISTRY.register("linkedin", ["linkedin", "linkedin_url", "perfil linkedin", "li_url", "LinkedIn"], priority=20)
CONTACT_REGISTRY.register("job_title", ["cargo", "job_title", "puesto", "position", "rol", "Cargo"], priority=10)
CONTACT_REGISTRY.register("empresa_nombre", ["empresa", "company", "empresa_nombre", "nombre empresa", "Nombre empresa"], priority=10)
CONTACT_REGISTRY.register("campaña", ["campaña", "campaign", "campana", "origen", "campañas", "Campaña"], priority=10)
