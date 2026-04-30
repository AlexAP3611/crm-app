from typing import Dict, Any, List
from app.core.importer.schema import IngestionError
from app.core.importer.cache import IdentityCache

class BusinessInterrogator:
    """
    Validates business logic and consistency in-memory.
    Checks cross-field requirements and existence in cache.
    """
    def __init__(self, cache: IdentityCache):
        self.cache = cache

    def validate_empresa(self, sanitized_row: Dict[str, Any]) -> List[IngestionError]:
        """
        Validates a company row against business rules.
        """
        errors: List[IngestionError] = []

        # Rule 1: Must have a valid name
        nombre = sanitized_row.get("nombre")
        if not nombre or len(nombre) < 2:
            errors.append(IngestionError(
                code="INVALID_NAME",
                message="La empresa debe tener un nombre válido (mín. 2 caracteres)",
                field="nombre",
                severity="BLOCKER"
            ))

        # Rule 2: Deduplication check (Lookup in Cache)
        existing = self.cache.get_by_identity(
            cif=sanitized_row.get("cif"),
            web=sanitized_row.get("web"),
            name=nombre
        )
        
        if existing:
            # Not an error, but metadata for the orchestrator
            # We store this information to be used by the Domain Persistence layer
            pass

        # Rule 3: CIF Format (Basic check if present)
        cif = sanitized_row.get("cif")
        if cif and len(cif) < 5:
            errors.append(IngestionError(
                code="INVALID_CIF_FORMAT",
                message="El CIF parece tener un formato inválido",
                field="cif",
                severity="WARNING"
            ))

        return errors
