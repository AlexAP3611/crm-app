"""
Contact Identity Resolution — hierarchical matching (email → linkedin → fuzzy).

This module is PURE IDENTIFICATION. It never creates or modifies contacts.
The caller (upsert_contact) is solely responsible for mutations.

RULES:
- resolve_contact is strictly READ-ONLY
- Email/LinkedIn matches return a full Contact ORM object (high confidence)
- Fuzzy matches return ONLY a possible_match_id (low confidence, suggestion only)
- Fuzzy match must NEVER be treated as a confirmed identity
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.contact import Contact
from app.models.empresa import Empresa


# ── Normalization helpers ─────────────────────────────────────────────

def normalize_email(email: str | None) -> str | None:
    """Strip whitespace and lowercase an email address."""
    if not email:
        return None
    cleaned = email.strip().lower()
    return cleaned if cleaned else None


def normalize_linkedin(url: str | None) -> str | None:
    """
    Normalize a LinkedIn URL to a canonical form for exact comparison.

    Handles variations like:
      - https://www.linkedin.com/in/usuario/
      - http://linkedin.com/in/usuario
      - linkedin.com/in/usuario
      - www.linkedin.com/in/usuario?lang=es

    Returns: 'linkedin.com/in/usuario' (no protocol, no www, no trailing slash, no query params)
    Returns None if the input is empty or not a recognizable LinkedIn URL.
    """
    if not url:
        return None

    cleaned = url.strip().lower()
    if not cleaned:
        return None

    # Remove protocol
    cleaned = re.sub(r'^https?://', '', cleaned)
    # Remove www.
    cleaned = re.sub(r'^www\.', '', cleaned)
    # Remove query params and fragments
    cleaned = re.split(r'[?#]', cleaned)[0]
    # Remove trailing slash
    cleaned = cleaned.rstrip('/')

    return cleaned


# ── Resolution result ─────────────────────────────────────────────────

@dataclass(frozen=True)
class ResolveResult:
    """
    Result of contact identity resolution.

    For email/linkedin matches (high confidence):
      - contact: the matched Contact ORM object
      - match_type: "email" or "linkedin"
      - confidence: "high"
      - possible_match_id: None

    For fuzzy matches (low confidence — SUGGESTION ONLY):
      - contact: None  (never exposes a Contact ORM for fuzzy)
      - match_type: "fuzzy"
      - confidence: "low"
      - possible_match_id: the id of the possible match

    For no match:
      - contact: None
      - match_type: None
      - confidence: None
      - possible_match_id: None
    """
    contact: Contact | None
    match_type: Literal["email", "linkedin", "fuzzy"] | None
    confidence: Literal["high", "low"] | None
    possible_match_id: int | None = None


# Singleton for "no match found"
NO_MATCH = ResolveResult(contact=None, match_type=None, confidence=None)


def _contact_query():
    """Base query with all eager-loaded relations."""
    return (
        select(Contact)
        .options(
            selectinload(Contact.cargos),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        )
    )


async def resolve_contact(
    session: AsyncSession,
    *,
    email_contact: str | None = None,
    linkedin: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    empresa_id: int | None = None,
) -> ResolveResult:
    """
    Hierarchical contact resolution. NEVER modifies data.

    Priority cascade:
      1. EMAIL (exact, normalised) → high confidence, returns Contact
      2. LINKEDIN (exact, normalised) → high confidence, returns Contact
      3. FUZZY (empresa_id + first_name + last_name) → low confidence, returns ONLY possible_match_id
      4. No match → NO_MATCH
    """

    # ── 1. EMAIL MATCH (highest priority) ──────────────────────────
    norm_email = normalize_email(email_contact)
    if norm_email:
        result = await session.execute(
            _contact_query().where(
                func.lower(Contact.email_contact) == norm_email
            )
        )
        contact = result.scalar_one_or_none()
        if contact:
            return ResolveResult(contact=contact, match_type="email", confidence="high")

    # ── 2. LINKEDIN MATCH (exact normalised comparison) ────────────
    norm_linkedin = normalize_linkedin(linkedin)
    if norm_linkedin:
        # Build a subquery that normalises the stored linkedin values
        # the same way we normalise input, then compare exactly.
        # We strip protocol, www, query params, trailing slash in Python
        # but the DB values may be stored in various formats.
        # Strategy: normalise both sides to the same canonical form.
        #
        # Since we can't run arbitrary Python in SQL, we apply the same
        # transformations via SQL string functions:
        #   lower → strip https:// and http:// → strip www. → strip trailing /
        #
        # For correctness we compare the normalised input against the
        # normalised stored value using a constructed SQL expression.
        db_linkedin = func.lower(Contact.linkedin)
        # Strip protocol
        db_linkedin = func.regexp_replace(db_linkedin, r'^https?://', '', 'i')
        # Strip www.
        db_linkedin = func.regexp_replace(db_linkedin, r'^www\.', '', 'i')
        # Strip query params (everything after ?)
        db_linkedin = func.regexp_replace(db_linkedin, r'\?.*$', '', 'i')
        # Strip fragment (everything after #)
        db_linkedin = func.regexp_replace(db_linkedin, r'#.*$', '', 'i')
        # Strip trailing slash
        db_linkedin = func.rtrim(db_linkedin, '/')

        result = await session.execute(
            _contact_query().where(
                db_linkedin == norm_linkedin,
                Contact.linkedin.isnot(None),
            )
        )
        contact = result.scalar_one_or_none()
        if contact:
            return ResolveResult(contact=contact, match_type="linkedin", confidence="high")

    # ── 3. FUZZY MATCH (empresa + nombre) — SUGGESTION ONLY ────────
    # Returns only possible_match_id, NEVER a Contact ORM object.
    # The caller must decide whether to use this hint.
    if empresa_id and first_name and last_name:
        result = await session.execute(
            select(Contact.id).where(
                Contact.empresa_id == empresa_id,
                func.lower(Contact.first_name) == first_name.strip().lower(),
                func.lower(Contact.last_name) == last_name.strip().lower(),
            )
        )
        match_id = result.scalar_one_or_none()
        if match_id:
            return ResolveResult(
                contact=None,
                match_type="fuzzy",
                confidence="low",
                possible_match_id=match_id,
            )

    # ── 4. NO MATCH ────────────────────────────────────────────────
    return NO_MATCH
