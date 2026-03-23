"""
Centralized Configuration for Mapping Dynamic CRM Structures.
"""

CONTACT_FIELD_MAP = {
    # payload key -> db column
    "company": "company",
    "nombre_empresa": "company",
    "empresa": "company",
    "first_name": "first_name",
    "nombre": "first_name",
    "last_name": "last_name",
    "apellido": "last_name",
    "job_title": "job_title",
    "cargo": "job_title",
    "cif": "cif",
    "dominio": "dominio",
    "website": "dominio",
    "linkedin": "linkedin",
    "email_generic": "email_generic",
    "email_contact": "email_contact",
    "email": "email_contact",
    "phone": "phone",
    "telefono": "phone"
}

# The single source of truth for UI columns, CSV headers, and generic iteration
CORE_COLUMNS = [
    "company",
    "first_name", 
    "last_name",
    "job_title",
    "cif",
    "dominio",
    "linkedin",
    "email_generic",
    "email_contact",
    "phone"
]

M2M_FIELD_MAP = {
    "sector_ids": {"relation_name": "sectors", "model": "Sector"},
    "vertical_ids": {"relation_name": "verticals", "model": "Vertical"},
    "cargo_ids": {"relation_name": "cargos", "model": "Cargo"},
    "product_ids": {"relation_name": "products_rel", "model": "Product"},
    "campaign_ids": {"relation_name": "campaigns", "model": "Campaign"}
}
