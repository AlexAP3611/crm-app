import logging
from typing import List, Dict, Any, Literal
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.importer.schema import PipelineResult, RowResult, IngestionSummary, IngestionError
from app.core.importer.cache import extract_identifiers, prefetch_empresas, IdentityCache
from app.core.importer.registry import EMPRESA_REGISTRY
from app.core.importer.resolver import CanonicalResolver
from app.core.importer.sanitizer import StatelessSanitizer
from app.core.importer.validator import BusinessInterrogator
from app.schemas.empresa import EmpresaCreate
from app.services import empresa_service

logger = logging.getLogger(__name__)

class PipelineCoordinator:
    """
    Thin orchestrator for the Ingestion Pipeline.
    Coordinates layers 0-5 and aggregates results.
    """
    def __init__(self, session: AsyncSession, mode: Literal["preview", "commit"] = "preview"):
        self.session = session
        self.mode = mode
        self.resolver = CanonicalResolver(EMPRESA_REGISTRY)
        self.sanitizer = StatelessSanitizer()
        
    async def ingest_empresas(self, raw_rows: List[Dict[str, Any]]) -> PipelineResult:
        """
        Orchestrates the full ingestion flow for Empresas.
        """
        # 1. Pre-fetch Engine (Layer 1)
        identifiers = extract_identifiers(raw_rows)
        cache = await prefetch_empresas(self.session, identifiers)
        
        # 2. Setup Interrogator (Layer 3)
        interrogator = BusinessInterrogator(cache)
        
        results: List[RowResult] = []
        summary = IngestionSummary(total=len(raw_rows))

        for idx, raw_row in enumerate(raw_rows):
            try:
                row_warnings: List[IngestionError] = []
                row_errors: List[IngestionError] = []
                
                # --- Layer 1: Canonical Mapping ---
                canonical, map_warnings = self.resolver.resolve_row(raw_row)
                row_warnings.extend(map_warnings)

                # --- Layer 2: Sanitization ---
                sanitized = self.sanitizer.sanitize_row(canonical)

                # --- Layer 3: Business Validation ---
                val_errors = interrogator.validate_empresa(sanitized)
                row_errors.extend(val_errors)

                # --- Decision Point ---
                if any(e.severity in ["BLOCKER", "CRITICAL"] for e in row_errors):
                    summary.failed += 1
                    results.append(RowResult(row_idx=idx, status="error", errors=row_errors, warnings=row_warnings))
                    continue

                # --- Layer 5: Domain Persistence ---
                if self.mode == "preview":
                    # Determine action based on cache
                    existing = cache.get_by_identity(
                        cif=sanitized.get("cif"),
                        web=sanitized.get("web"),
                        name=sanitized.get("nombre")
                    )
                    action = "updated" if existing else "created"
                    summary.success += 1
                    results.append(RowResult(
                        row_idx=idx, 
                        status="success", 
                        action=action, 
                        warnings=row_warnings,
                        entity_id=existing.id if existing else None
                    ))
                else:
                    # Commit mode: call domain service
                    # We pass the already sanitized data
                    empresa_data = EmpresaCreate(**sanitized)
                    empresa, action = await empresa_service.upsert_empresa(self.session, empresa_data)
                    summary.success += 1
                    results.append(RowResult(
                        row_idx=idx, 
                        status="success", 
                        action=action, 
                        warnings=row_warnings,
                        entity_id=empresa.id
                    ))

            except Exception as e:
                logger.exception(f"Unexpected error in row {idx}")
                summary.failed += 1
                results.append(RowResult(
                    row_idx=idx, 
                    status="error", 
                    errors=[IngestionError(code="UNEXPECTED_ERROR", message=str(e), severity="CRITICAL")]
                ))

        return PipelineResult(summary=summary, results=results)
