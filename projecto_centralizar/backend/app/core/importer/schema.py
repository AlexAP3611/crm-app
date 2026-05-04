from pydantic import BaseModel, Field
from typing import List, Optional, Any, Literal, Dict

class IngestionError(BaseModel):
    code: str
    message: str
    field: Optional[str] = None
    severity: Literal["BLOCKER", "CRITICAL", "WARNING", "INFO"] = "BLOCKER"

class RowResult(BaseModel):
    row_idx: int
    status: Literal["success", "error", "skipped"]
    errors: List[IngestionError] = []
    warnings: List[IngestionError] = []
    entity_id: Optional[int] = None  # ID of the created/updated entity
    action: Optional[Literal["created", "updated", "ignored", "merged"]] = None

class IngestionSummary(BaseModel):
    total: int = 0
    success: int = 0
    failed: int = 0
    skipped: int = 0
    merged: int = 0

class PipelineResult(BaseModel):
    summary: IngestionSummary
    results: List[RowResult] = []
    metadata: dict = Field(default_factory=dict)

    def to_import_summary(self, raw_rows: List[Dict[str, Any]] = None) -> dict:
        """
        Compatibility mapper for the current frontend (ImportSummary).
        """
        from app.schemas.import_schema import SkipDetail, EmpresaPreview
        
        skipped = self.summary.failed + self.summary.skipped
        skip_details = []
        
        failed_csv = self.generate_failed_rows_csv(raw_rows) if raw_rows else None

        for res in self.results:
            messages = []
            if res.errors:
                messages.extend([f"[ERROR] {e.message}" for e in res.errors])
            if res.warnings:
                messages.extend([f"[WARN] {e.message}" for e in res.warnings])
            
            if messages:
                reason = " | ".join(messages)
                skip_details.append(SkipDetail(row=res.row_idx, reason=reason))

        return {
            "total_rows": self.summary.total,
            "to_create": sum(1 for r in self.results if r.action == "created"),
            "to_update": sum(1 for r in self.results if r.action == "updated"),
            "skipped": skipped,
            "skip_details": skip_details,
            "empresa_preview": [],
            "sector_preview": [],
            "vertical_preview": [],
            "product_preview": [],
            "failed_rows_csv": failed_csv
        }

    def generate_failed_rows_csv(self, raw_rows: List[Dict[str, Any]]) -> str:
        """
        Generates a CSV string containing only the rows that failed,
        with an extra column explaining the error.
        """
        import csv
        import io

        failed_results = [r for r in self.results if r.status == "error"]
        if not failed_results:
            return ""

        output = io.StringIO()
        if not raw_rows:
            return ""
            
        # Get all original headers
        headers = list(raw_rows[0].keys())
        headers.append("_error_reason")
        
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()

        for res in failed_results:
            row = raw_rows[res.row_idx].copy()
            row["_error_reason"] = "; ".join([e.message for e in res.errors])
            writer.writerow(row)

        return output.getvalue()
