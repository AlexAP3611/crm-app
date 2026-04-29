"""
Domain Mapper Layer for Contact Imports.
Decouples external file schemas (CSV/XLSX) from internal domain models.
"""
from app.core.mappings.contact_aliases import CONTACT_ALIASES

# Type-aware field categorization
STRING_FIELDS = {
    "first_name", "last_name", "email", "phone", "linkedin",
    "empresa_nombre", "empresa_cif", "empresa_web",
    "cargo", "campaña"
}
NUMERIC_FIELDS = set()  # Reserved for future use

def _to_safe_str(val) -> str | None:
    """Safely convert any value to a trimmed string or None."""
    if val is None:
        return None
    
    # Fix Excel floats like 986561216.0
    if isinstance(val, float) and val.is_integer():
        val = int(val)
        
    res = str(val).strip()
    return res if res != "" else None

def normalize_contact_row(row: dict) -> dict:
    """
    Translates external column names to internal canonical field names.
    Pure transformation: renames keys and ensures domain-compatible types.
    
    Priority Rule: Prefixed aliases (empresa_*) or explicit canonical names 
    override generic ones if both are present.
    """
    normalized = {}

    # We iterate over the canonical fields defined in CONTACT_ALIASES
    for target_field, aliases in CONTACT_ALIASES.items():
        val = None
        # Check aliases in order
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
            # Add elif for NUMERIC_FIELDS in the future
            
            normalized[target_field] = val

    return normalized
