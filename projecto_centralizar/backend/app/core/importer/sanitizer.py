from typing import Dict, Any

class StatelessSanitizer:
    """
    Dumb cleaner for raw input.
    Handles NaN, empty strings, and basic type coercion.
    No business logic, no complex normalizations.
    """
    def __init__(self):
        # Domain-Aware Type Enforcement
        self.force_str_fields = {"phone", "telefono", "cif", "email", "cnae", "facebook"}
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
        Cleans raw canonical row.
        """
        sanitized: Dict[str, Any] = {}
        
        for key, raw_val in canonical_row.items():
            val = self._clean_value(raw_val)
            if val is None:
                continue

            # 1. Force String for textual identifiers
            if key in self.force_str_fields:
                sanitized[key] = str(val).strip()

            # 2. Numeric Coercion
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
