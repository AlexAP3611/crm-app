"""
Enrichment service — wires external provider data into the Contact model.

Logic:
- Any field in the incoming data that matches a Contact column (excluding system
  fields) is written directly to that column.
- ALL other fields are stored as strings inside notes[source] JSON without
  overwriting existing notes data.
"""
from typing import Any

from sqlalchemy import select, inspect as sa_inspect
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.vertical import Vertical
from app.services.merge import deep_merge


# Fields that should never be written from enrichment data
NON_EDITABLE_FIELDS = {"id", "notes", "created_at", "updated_at"}

# Fields handled via special relationship logic (not a plain column write)
RELATION_FIELDS = {"vertical"}

# System fields that identify the contact, not enrichment data
SYSTEM_FIELDS = {"id_contacto"}


def _get_contact_columns() -> set[str]:
    """Return all editable column names from the Contact model."""
    mapper = sa_inspect(Contact)
    return {
        col.key
        for col in mapper.column_attrs
        if col.key not in NON_EDITABLE_FIELDS
    }


# Resolved once at import time for performance
_CONTACT_COLUMNS = _get_contact_columns()


async def enrich_contact(
    session: AsyncSession, contact_id: int, source: str, data: dict[str, Any]
) -> Contact | None:
    """
    Merge enrichment data from an external source into contact.notes.
    """
    result = await session.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if contact is None:
        return None

    enrichment_payload = {source: data}
    contact.notes = deep_merge(contact.notes, enrichment_payload)

    await session.commit()
    await session.refresh(contact)
    return contact


async def enrich_contact_smart(
    session: AsyncSession,
    contact_id: int,
    source: str,
    data: dict[str, Any],
) -> Contact | None:
    """
    Smart enrichment:
    - Dynamically inspects Contact columns — any matching field is written
      directly to the column (e.g. linkedin, website, company, phone…).
    - Handles 'vertical' via M2M relationship.
    - ALL other fields are stored as strings inside notes[source].

    Field name mapping from enrichment payload:
      nombre_empresa → company
      dominio        → website
      (all other Contact column names used as-is)
    """
    result = await session.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if contact is None:
        return None

    extra_data: dict[str, str] = {}

    for key, value in data.items():
        if key in SYSTEM_FIELDS:
            continue

        if key in RELATION_FIELDS:
            # Handle vertical via M2M
            if key == "vertical" and value:
                vertical_result = await session.execute(
                    select(Vertical).where(Vertical.name == str(value))
                )
                vertical = vertical_result.scalar_one_or_none()
                if vertical and vertical not in contact.verticals:
                    contact.verticals.append(vertical)

        elif key in _CONTACT_COLUMNS:
            # Write directly to the matching column
            setattr(contact, key, value)

        else:
            # Unknown field → goes into notes[source] as string
            extra_data[key] = str(value)

    if extra_data:
        contact.notes = deep_merge(contact.notes or {}, {source: extra_data})

    await session.commit()
    await session.refresh(contact)
    return contact
