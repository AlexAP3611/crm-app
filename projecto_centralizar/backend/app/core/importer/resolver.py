from typing import Dict, Any, List, Set
from app.core.importer.registry import FieldAliasRegistry, AliasEntry
from app.core.importer.schema import IngestionError

class CanonicalResolver:
    """
    Resolves raw input dictionaries to canonical internal schemas.
    Handles conflicts based on alias priorities.
    """
    def __init__(self, registry: FieldAliasRegistry):
        self.registry = registry

    def resolve_row(self, raw_row: Dict[str, Any]) -> tuple[Dict[str, Any], List[IngestionError]]:
        """
        Maps a raw row to a canonical dictionary.
        Returns (resolved_dict, warnings).
        """
        resolved: Dict[str, Any] = {}
        # Track priorities to resolve conflicts (highest priority wins)
        current_priorities: Dict[str, int] = {}
        warnings: List[IngestionError] = []

        for key, value in raw_row.items():
            if value is None or value == "":
                continue

            entry = self.registry.mappings.get(key.lower().strip())
            if not entry:
                # Field not in registry, ignore or store as metadata (future)
                continue

            canonical = entry.canonical
            priority = entry.priority

            if canonical in resolved:
                if priority > current_priorities[canonical]:
                    # Override with higher priority
                    warnings.append(IngestionError(
                        code="MAPPING_OVERRIDE",
                        message=f"Campo '{canonical}' sobrescrito por columna '{key}' (mayor prioridad)",
                        field=canonical,
                        severity="INFO"
                    ))
                    resolved[canonical] = value
                    current_priorities[canonical] = priority
                elif priority == current_priorities[canonical]:
                    # Conflict: same priority. Log as warning but keep first-found (or last-found?)
                    # Standard practice: first found or log conflict.
                    warnings.append(IngestionError(
                        code="MAPPING_CONFLICT",
                        message=f"Múltiples columnas para '{canonical}' con misma prioridad. Se ignoró '{key}'.",
                        field=canonical,
                        severity="WARNING"
                    ))
                else:
                    # Lower priority, ignore
                    pass
            else:
                resolved[canonical] = value
                current_priorities[canonical] = priority

        return resolved, warnings
