"""
Single Source of Truth for Provincia Field Aliases.
This module defines how external province names (from CSV, enrichment, etc.)
map to internal canonical database names.
"""

# Map from lowercase alias/alternative name to the canonical name in the database
PROVINCIA_ALIASES = {
    # Vizcaya
    "vizcaya": "Bizkaia",
    
    # Guipúzcoa
    "guipuzcoa": "Gipuzkoa",
    "guipúzcoa": "Gipuzkoa",
    
    # Álava
    "alava": "Araba/Álava",
    "álava": "Araba/Álava",
    "araba": "Araba/Álava",
    
    # La Coruña
    "la coruña": "Coruña, A",
    "la coruna": "Coruña, A",
    "a coruña": "Coruña, A",
    "a coruna": "Coruña, A",
    "coruña": "Coruña, A",
    "coruna": "Coruña, A",
    
    # Orense
    "orense": "Ourense",
    
    # Gerona
    "gerona": "Girona",
    
    # Lérida
    "lerida": "Lleida",
    "lérida": "Lleida",
    
    # Baleares
    "baleares": "Balears, Illes",
    "islas baleares": "Balears, Illes",
    "illes balears": "Balears, Illes",
    
    # Las Palmas
    "las palmas": "Palmas, Las",
    "las palmas de gran canaria": "Palmas, Las",
    
    # La Rioja
    "la rioja": "Rioja, La",
    "rioja": "Rioja, La",
    
    # Santa Cruz de Tenerife
    "santa cruz de tenerife": "Santa Cruz de Tenerife",
    "tenerife": "Santa Cruz de Tenerife",
    
    # Navarra
    "navarra": "Navarra",
    
    # Alicante
    "alicante": "Alicante/Alacant",
    "alacant": "Alicante/Alacant",
    
    # Castellón
    "castellon": "Castellón/Castelló",
    "castellón": "Castellón/Castelló",
    "castelló": "Castellón/Castelló",
    
    # Valencia
    "valencia": "Valencia/València",
    "valència": "Valencia/València",
}


def normalize_provincia_name(nombre: str) -> str:
    """
    Normalize a province name using the static alias map.
    Returns the canonical name if found, or the original trimmed name.
    """
    if not nombre:
        return ""
    normalizado = nombre.strip().lower()
    return PROVINCIA_ALIASES.get(normalizado, nombre.strip())
