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
    "numero_empleados": ["numero_empleados", "employees", "size"],
    "facturacion": ["facturacion", "revenue", "turnover"],
    "cnae": ["cnae", "industry_code"]
}

# Type-aware field categorization
STRING_FIELDS = {"nombre", "phone", "email", "web", "cif", "cnae",
                 "sector_name", "vertical_name", "product_name"}
INT_FIELDS = {"numero_empleados"}
FLOAT_FIELDS = {"facturacion"}


def _to_safe_str(val) -> str | None:
    """Safely convert any value to a trimmed string or None."""
    if val is None:
        return None

    # Fix Excel floats like 986561216.0
    if isinstance(val, float) and val.is_integer():
        val = int(val)

    res = str(val).strip()
    return res if res != "" else None


def _to_safe_int(val) -> int | None:
    """Safely convert any value to int or None."""
    if val is None:
        return None
    try:
        # Handle Excel floats like 50.0
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _to_safe_float(val) -> float | None:
    """Safely convert any value to float or None."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def normalize_empresa_row(row: dict) -> dict:
    """
    Translates external column names to internal canonical field names.
    Pure transformation: renames keys and ensures domain-compatible types.
    
    Priority Rule: Prefixed aliases (empresa_*) override generic ones if both are present.
    """
    normalized = {}

    for target_field, aliases in EMPRESA_FIELD_MAP.items():
        val = None
        # Check aliases in order (prefixed aliases should be FIRST in the list)
        for alias in aliases:
            if alias in row and row[alias] not in [None, ""]:
                val = row[alias]
                break
        
        # If no alias matched, check if the target_field itself is in the row
        if val is None and target_field in row and row[target_field] not in [None, ""]:
            val = row[target_field]

        if val is not None:
            # Type-aware normalization
            if target_field in STRING_FIELDS:
                val = _to_safe_str(val)
            elif target_field in INT_FIELDS:
                val = _to_safe_int(val)
            elif target_field in FLOAT_FIELDS:
                val = _to_safe_float(val)

            if val is not None:
                normalized[target_field] = val

    return normalized
