from typing import Dict, Any, List, Optional
from app.core.utils import normalize_web, normalize_company_name

class StatelessSanitizer:
    """
    Cleans and normalizes canonical data without database side effects.
    Handles NaN, empty strings, and basic type coercion.
    """
    def __init__(self):
        # Fields that need specific normalization
        self.web_fields = {"web", "web_competidor_1", "web_competidor_2", "web_competidor_3"}
        self.name_fields = {"nombre", "empresa_nombre", "name"}
        
        # Domain-Aware Type Enforcement
        self.force_str_fields = {"phone", "telefono" "cif", "email", "cnae", "facebook"}
        self.int_fields = {"numero_empleados"}
        self.float_fields = {"facturacion"}

    def _clean_value(self, v: Any) -> Any:
        if v is None: return None
        if isinstance(v, str):
            v = v.strip()
            if v == "" or v.lower() in ["nan", "null", "none"]: return None
        # Handle actual float NaN if it leaks from openpyxl
        if isinstance(v, float) and v != v: return None
        return v

    def sanitize_row(self, canonical_row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Applies cleaning and normalization to a canonical row.
        Ensures types are domain-compatible before Pydantic validation.
        """
        sanitized: Dict[str, Any] = {}
        
        for key, raw_val in canonical_row.items():
            val = self._clean_value(raw_val)
            if val is None:
                continue

            # 1. Force String for textual identifiers (Addresses Pydantic int vs str error)
            if key in self.force_str_fields:
                sanitized[key] = str(val).strip()

            # 2. Specific Normalizations
            elif key in self.web_fields:
                sanitized[key] = normalize_web(str(val))
            elif key in self.name_fields:
                sanitized[key] = normalize_company_name(str(val))
                
            # 3. Numeric Coercion
            elif key in self.int_fields:
                try:
                    sanitized[key] = int(float(val))
                except (ValueError, TypeError):
                    continue
            elif key in self.float_fields:
                try:
                    sanitized[key] = float(val)
                except (ValueError, TypeError):
                    continue
            else:
                sanitized[key] = val

        return sanitized
