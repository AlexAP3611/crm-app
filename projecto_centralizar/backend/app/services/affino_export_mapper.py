import unicodedata
from typing import Any
from uuid import UUID
from app.models.contact import Contact

def normalize_text(text: str | None) -> str:
    """
    Normalizes text: lowercase and removes accents/diacritics.
    """
    if not text:
        return ""
    
    # Remove accents
    text = unicodedata.normalize('NFD', text)
    text = "".join([c for c in text if unicodedata.category(c) != 'Mn'])
    
    return text.lower().strip()

def map_contacts_to_affino_payload(contacts: list[Contact], run_id: UUID, tool: str) -> dict[str, Any]:
    """
    Maps Contact ORM objects to the Affino export contract.
    Ensures normalization (lowercase, no accents).
    """
    return {
        "enrichment_run_id": str(run_id),
        "tool": tool,
        "schema_version": "1.0",
        "contacts": [
            {
                "id_contacto": c.id,
                "first_name": normalize_text(c.first_name),
                "last_name": normalize_text(c.last_name),
                "full_name": normalize_text(f"{c.first_name or ''} {c.last_name or ''}"),
                "email": normalize_text(c.email),
                "job_title": normalize_text(c.cargo.name if c.cargo else ""),
                "empresa_nombre": normalize_text(c.empresa_rel.nombre if c.empresa_rel else ""),
                "web_empresa": normalize_text(str(c.empresa_rel.web) if c.empresa_rel and c.empresa_rel.web else ""),
                "linkedin": normalize_text(c.linkedin),
                "phone": normalize_text(c.phone)
            }
            for c in contacts
        ]
    }
