"""
Contact Mapper — Explicit Schema → ORM translation layer.

This module is the ONLY place where Pydantic schema fields are translated
into SQLAlchemy ORM constructor kwargs. It guarantees that no schema-only
fields (empresa_nombre, empresa_rel, etc.) ever reach the ORM.

RULES:
- CONTACT_ORM_FIELDS is the single source of truth for valid Contact columns.
- Adding a new column to the Contact model requires adding it here.
- The mapper NEVER calls model_dump(). It reads schema attributes directly.
"""
from app.models.contact import Contact


# ── Include-list: only these fields are real columns on the Contact ORM ──
CONTACT_ORM_FIELDS = frozenset({
    "empresa_id",
    "cargo_id",
    "first_name",
    "last_name",
    "email",
    "phone",
    "linkedin",
})


def build_contact_kwargs(data, *, exclude_unset: bool = True) -> dict:
    """
    Extract ONLY valid ORM column values from a Pydantic schema.

    Args:
        data: A ContactCreate or ContactUpdate Pydantic model instance.
        exclude_unset: If True, only include fields that were explicitly
                       provided in the request (avoids overwriting with None).

    Returns:
        dict with keys that are guaranteed to be valid Contact.__init__ kwargs.
    """
    fields_to_check = data.model_fields_set if exclude_unset else CONTACT_ORM_FIELDS
    result = {}
    for field in CONTACT_ORM_FIELDS:
        if field not in fields_to_check:
            continue
        value = getattr(data, field, None)
        if value == "":
            value = None
        result[field] = value
    return result


def apply_update_fields(
    contact: Contact,
    data,
    *,
    protect_fields: set[str] | None = None,
) -> None:
    """
    Apply schema fields to an existing Contact ORM instance.

    Only fields present in CONTACT_ORM_FIELDS AND in data.model_fields_set
    will be applied. Protected fields are skipped if the contact already
    has a non-null value for them.

    Args:
        contact: The existing Contact ORM instance to update.
        data: A ContactCreate or ContactUpdate Pydantic model instance.
        protect_fields: Set of field names that should not be overwritten
                        if the contact already has a value.
    """
    protect = protect_fields or set()
    for field in CONTACT_ORM_FIELDS:
        if field not in data.model_fields_set:
            continue
        # Skip protected fields that already have a value
        if field in protect and getattr(contact, field, None):
            continue
        setattr(contact, field, getattr(data, field, None))
