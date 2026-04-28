"""
Single Source of Truth for Contact Field Aliases.
This module defines how external fields (from CSV, enrichment, etc.) 
map to internal canonical domain fields.
"""

# Canonical Field -> List of Aliases
# Note: For Contact Import, some fields are prefixed with 'empresa_' 
# to distinguish them from contact-level fields during normalization.
CONTACT_ALIASES = {
    "first_name": ["first_name", "nombre", "name", "nombre_contacto", "first name", "given_name"],
    "last_name": ["last_name", "apellido", "surname", "apellido_contacto", "last name", "family_name"],
    "email": ["email", "correo", "mail"],
    "phone": ["phone", "telefono", "tel", "mobile", "cellphone"],
    "linkedin": ["linkedin", "linkedin_url", "url_linkedin", "linkedin profile"],
    
    # Associated Empresa fields (normalized for resolve_empresa_for_contact)
    "empresa_nombre": ["empresa", "company", "company_name", "nombre_empresa", "empresa_nombre"],
    "empresa_cif": ["cif", "vat", "cif_empresa", "empresa_cif"],
    "empresa_web": ["web", "website", "url", "web_empresa", "empresa_web"]
}

# Derived Flat Map: Alias -> Canonical Field
# This is used by enrichment_service and other dynamic payload handlers.
# It maps aliases to the internal fields of the Contact model.
CONTACT_FIELD_MAP = {
    # Manual overrides to ensure exact match with DB columns or legacy properties
    "nombre": "first_name",
    "apellido": "last_name",
    "cif": "cif",
    "web": "web",
    "website": "web",
}

# Fill the rest from CONTACT_ALIASES
for canonical, aliases in CONTACT_ALIASES.items():
    # For enrichment, we typically don't want the 'empresa_' prefix 
    # as enrichment data for contacts usually maps to contact properties 
    # or is stored in notes.
    target = canonical
    if canonical.startswith("empresa_"):
        target = canonical.replace("empresa_", "")
        # If it's an empresa field, we only add it if it's 'cif' or 'web' 
        # (which are properties on Contact) to avoid polluting the map.
        if target not in ["cif", "web", "email"]:
            continue

    for alias in aliases:
        if alias not in CONTACT_FIELD_MAP:
            CONTACT_FIELD_MAP[alias] = target
