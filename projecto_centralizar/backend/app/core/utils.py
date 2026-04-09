import re

def normalize_company_name(name: str | None) -> str | None:
    """
    Normaliza el nombre de una empresa eliminando espacios extra al inicio/fin,
    reduciendo múltiples espacios internos a uno solo y capitalizando cada palabra.
    """
    if not name:
        return name
    # Eliminar espacios iniciales/finales
    name = name.strip()
    # Reemplazar múltiples espacios internos por uno solo
    name = re.sub(r'\s+', ' ', name)
    # Capitalizar (Title Case)
    return name.title()


def build_datos_empresa_snapshot(empresa) -> dict:
    """
    Construye el diccionario `datos_empresa` a partir de un objeto Empresa,
    incluyendo nombres de relaciones M2M. Los campos con valor None se omiten.
    """
    raw = {
        "sector": ", ".join(
            (s.name or s.nombre) for s in (empresa.sectors or [])
        ) or None,
        "vertical": ", ".join(
            (v.name or v.nombre) for v in (empresa.verticals or [])
        ) or None,
        "producto": ", ".join(
            (p.name or p.nombre) for p in (empresa.products_rel or [])
        ) or None,
        "cif": empresa.cif,
        "cnae": empresa.cnae,
        "facturacion": empresa.facturacion,
        "numero_empleados": empresa.numero_empleados,
    }

    # Filtrar claves con valor None
    return {k: v for k, v in raw.items() if v is not None}


def update_empresa_snapshot_in_contact(contact, empresa) -> None:
    """
    Inyecta/actualiza la clave `datos_empresa` dentro de `contact.notes`
    sin sobrescribir las demás claves existentes en notes.
    """
    from app.services.merge import deep_merge  # noqa: deferred to avoid circular imports

    if contact.notes is None:
        contact.notes = {}

    # Eliminar campo legacy informacion_empresa si existe
    if "informacion_empresa" in contact.notes:
        del contact.notes["informacion_empresa"]

    snapshot = build_datos_empresa_snapshot(empresa)

    # Reemplazar completamente la clave datos_empresa (no merge parcial dentro de ella)
    # pero usar deep_merge a nivel raíz para preservar el resto de notes.
    contact.notes = deep_merge(contact.notes, {"datos_empresa": snapshot})
