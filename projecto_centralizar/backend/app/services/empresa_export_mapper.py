from typing import Any
from uuid import UUID
from app.models.empresa import Empresa

def map_to_export_payload(empresas: list[Empresa], run_id: UUID, tool: str) -> dict[str, Any]:
    """
    Maps Empresa ORM objects to the specific DTO v1 contract expected by enrichment webhooks.
    
    Responsibilities:
    - Decouple internal DB model from external API contract.
    - Flatten M2M relationships (Sectors/Verticals/Products) into simple lists.
    - Include mandatory metadata (run_id, schema_version).
    """
    return {
        "enrichment_run_id": str(run_id),
        "tool": tool,
        "schema_version": "1.0",
        "empresas": [
            {
                "id_empresa": emp.id,
                "nombre_empresa": emp.nombre or "",
                "web": str(emp.web).strip() if emp.web else "",
                "email": emp.email or None,
                "cif": emp.cif or None,
                "cnae": emp.cnae or None,
                "sector": [s.name or s.nombre for s in emp.sectors],
                "vertical": [v.name or v.nombre for v in emp.verticals],
                "producto": [p.name or p.nombre for p in emp.products_rel]
            }
            for emp in empresas
        ]
    }
