"""
Enrichment service — stubs designed to be wired to external providers
(e.g. Clearbit, Hunter.io, Apollo.io).

Each function receives a contact ID and fetches data from an external source,
then deep-merges the result into the contact's `notes` JSONB field.
"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.services.merge import deep_merge


async def enrich_contact(
    session: AsyncSession, contact_id: int, source: str, data: dict[str, Any]
) -> Contact | None:
    """
    Merge enrichment data from an external source into contact.notes.

    `data` is expected to be a dict like:
    {
        "clearbit": { "industry": "SaaS", "employees": 120 },
        "hunter":   { "email": "ceo@acme.com", "confidence": 92 }
    }
    The key should be the provider name so data from different sources doesn't collide.
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


async def bulk_enrich(
    session: AsyncSession, contact_ids: list[int], source: str, lookup_fn  # type: ignore[type-arg]
) -> dict[str, Any]:
    """
    Placeholder for batch enrichment.
    `lookup_fn` is a coroutine that accepts a Contact and returns a dict of enrichment data.
    In production, wire this to your enrichment provider SDK.
    """
    results = {"enriched": 0, "not_found": 0, "errors": 0}
    for contact_id in contact_ids:
        result = await session.execute(select(Contact).where(Contact.id == contact_id))
        contact = result.scalar_one_or_none()
        if contact is None:
            results["not_found"] += 1
            continue
        try:
            data = await lookup_fn(contact)
            contact.notes = deep_merge(contact.notes, {source: data})
            results["enriched"] += 1
        except Exception:
            results["errors"] += 1
    await session.commit()
    return results
