"""
Centralized Configuration for Mapping Dynamic CRM Structures.
"""

CONTACT_FIELD_MAP = {
    # payload key -> db column
    "first_name": "first_name",
    "nombre": "first_name",
    "last_name": "last_name",
    "apellido": "last_name",
    "job_title": "job_title",
    "cargo": "job_title",
    "cif": "cif",
    "website": "web",
    "web": "web",
    "linkedin": "linkedin",
    "email_generic": "email_generic",
    "email_contact": "email_contact",
    "email": "email_contact",
    "phone_contact": "phone_contact",
    "phone": "phone_contact",
}

# The single source of truth for UI columns, CSV headers, and generic iteration
CORE_COLUMNS = [
    "first_name", 
    "last_name",
    "job_title",
    "cif",
    "web",
    "linkedin",
    "email_generic",
    "email_contact",
    "phone_contact"
]

# Campos que NO deben sobrescribirse durante enriquecimiento automático.
# Si llega un valor nuevo, se redirige a notes[source]["_enrichment_{campo}"].
ENRICHMENT_PROTECTED_FIELDS = {"web", "email_contact", "phone_contact"}

# M2M fields that remain on Contact
M2M_FIELD_MAP = {
    "cargo_ids": {"relation_name": "cargos", "model": "Cargo"},
    "campaign_ids": {"relation_name": "campaigns", "model": "Campaign"}
}

# M2M fields that now live on Empresa
EMPRESA_M2M_FIELD_MAP = {
    "sector_ids": {"relation_name": "sectors", "model": "Sector"},
    "vertical_ids": {"relation_name": "verticals", "model": "Vertical"},
    "product_ids": {"relation_name": "products_rel", "model": "Product"},
}
