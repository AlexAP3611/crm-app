"""
Domain Mapper Layer for Empresa Imports.
Decouples external file schemas (CSV/XLSX) from internal domain models.
"""

# external column names -> internal domain field names
EMPRESA_FIELD_MAP = {
    "nombre": ["empresa_nombre", "nombre", "empresa", "company", "company_name", "name"],
    "phone": ["empresa_phone", "phone", "telefono", "tel", "mobile"],
    "email": ["empresa_email", "email", "correo", "mail"],
    "web": ["empresa_web", "web", "website", "url", "site"],
    "cif": ["empresa_cif", "cif", "vat", "vat_number"],
    "sector_name": ["sector", "industria"],
    "vertical_name": ["vertical"],
    "product_name": ["producto", "product"],
    # For now, numerical fields matching exactly continue to work via direct get or mapped here
    "numero_empleados": ["numero_empleados", "employees", "size"],
    "facturacion": ["facturacion", "revenue", "turnover"],
    "cnae": ["cnae", "industry_code"]
}

def normalize_empresa_row(row: dict) -> dict:
    """
    Translates external column names to internal canonical field names.
    Pure transformation: ONLY renames keys. Does NOT handle IDs or async operations.
    
    Priority Rule: Prefixed aliases (empresa_*) override generic ones if both are present.
    """
    normalized = {}

    for target_field, aliases in EMPRESA_FIELD_MAP.items():
        # Check aliases in order (prefixed aliases should be FIRST in the list)
        for alias in aliases:
            if alias in row and row[alias] not in [None, ""]:
                normalized[target_field] = row[alias]
                break
        
        # If no alias matched, check if the target_field itself is in the row
        if target_field not in normalized and target_field in row and row[target_field] not in [None, ""]:
            normalized[target_field] = row[target_field]

    return normalized
