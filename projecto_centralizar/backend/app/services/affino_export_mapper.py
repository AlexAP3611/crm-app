import json
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

def map_contacts_to_affino_payload(contacts: list[Contact], run_id: UUID, tool: str) -> list[dict[str, Any]]:
    """
    Maps Contact ORM objects to the Affino export contract.
    Strict Rules (v3.4 Final): 
    - RETURNS A PURE LIST (Array) as per Affino docs.
    - No id_contacto, No etapa.
    - Full normalization (lowercase, no accents).
    - 'notas' sent as a human-readable STRING.
    - Extended fields: sector, vertical, productos, campaña (comma-separated strings).
    """
    return [
        {
            "nombre": normalize_text(f"{c.first_name or ''} {c.last_name or ''}"),
            "email": normalize_text(c.email),
            "empresa": normalize_text(c.empresa_rel.nombre if c.empresa_rel else ""),
            "web": normalize_text(str(c.empresa_rel.web) if c.empresa_rel and c.empresa_rel.web else ""),
            "telefono": normalize_text(c.phone),
            "cargo": normalize_text(c.cargo.name if c.cargo else ""),
            "linkedin": normalize_text(c.linkedin),
            "sector": ", ".join([normalize_text(s.name) for s in (c.empresa_rel.sectors if c.empresa_rel else [])]),
            "vertical": ", ".join([normalize_text(v.name) for v in (c.empresa_rel.verticals if c.empresa_rel else [])]),
            "productos": ", ".join([normalize_text(p.name or p.nombre) for p in (c.empresa_rel.products_rel if c.empresa_rel else [])]),
            "campaña": ", ".join([normalize_text(camp.nombre) for camp in (c.campaigns or [])]),
            "notas": json.dumps(c.notes) if c.notes else ""
        }
        for c in contacts
    ]
