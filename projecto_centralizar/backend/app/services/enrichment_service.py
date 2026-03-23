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
from app.models.sector import Sector
from app.models.cargo import Cargo
from app.models.campaign import Campaign
from app.models.product import Product
from app.services.merge import deep_merge
from app.core.field_mapping import CONTACT_FIELD_MAP, M2M_FIELD_MAP


# Fields that should never be written from enrichment data
NON_EDITABLE_FIELDS = {"id", "notes", "created_at", "updated_at"}

# Fields handled via special relationship logic (not a plain column write)
RELATION_FIELDS = {"vertical"}

# System fields that identify the contact, not enrichment data
SYSTEM_FIELDS = {"id_contacto"}


# System fields that identify the contact, not enrichment data
SYSTEM_FIELDS = {"id_contacto"}


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
    - Dynamically inspects payload against CONTACT_FIELD_MAP
    - Handles M2M relationships dynamically via M2M_FIELD_MAP
    - ALL other fields are stored as strings inside notes[source].
    """
    result = await session.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if contact is None:
        return None

    extra_data: dict[str, str] = {}

    for key, value in data.items():
        if key in SYSTEM_FIELDS:
            continue

        if key in M2M_FIELD_MAP:
            config = M2M_FIELD_MAP[key]
            model_class = globals()[config["model"]]
            relation_name = config["relation_name"]
            
            # Assuming payload value is a strictly matching string (like old 'vertical')
            if value:
                res = await session.execute(select(model_class).where(model_class.name == str(value)))
                entity = res.scalar_one_or_none()
                
                if entity:
                    relation_list = getattr(contact, relation_name)
                    if entity not in relation_list:
                        relation_list.append(entity)

        elif key in CONTACT_FIELD_MAP:
            # Write directly to mapped db column
            setattr(contact, CONTACT_FIELD_MAP[key], value)

        else:
            # Unknown field → goes into notes[source] as string
            extra_data[key] = str(value)

    if extra_data:
        contact.notes = deep_merge(contact.notes or {}, {source: extra_data})

    await session.commit()
    await session.refresh(contact)
    return contact
