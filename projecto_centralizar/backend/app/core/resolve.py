"""
Contact Identity Resolution — hierarchical matching (email → linkedin).

This module is PURE IDENTIFICATION. It never creates or modifies contacts.
The caller (upsert_contact) is solely responsible for mutations.

RULES:
- resolve_contact is strictly READ-ONLY
- Email/LinkedIn matches return a full Contact ORM object (high confidence)
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

    For no match:
      - contact: None
      - match_type: None
      - confidence: None
    """
    contact: Contact | None
    match_type: Literal["email", "linkedin"] | None
    confidence: Literal["high"] | None


# Singleton for "no match found"
NO_MATCH = ResolveResult(contact=None, match_type=None, confidence=None)


def _contact_query():
    """Base query with all eager-loaded relations."""
    return (
        select(Contact)
        .options(
            selectinload(Contact.cargo),
            selectinload(Contact.campaigns),
            selectinload(Contact.empresa_rel).selectinload(Empresa.sectors),
            selectinload(Contact.empresa_rel).selectinload(Empresa.verticals),
            selectinload(Contact.empresa_rel).selectinload(Empresa.products_rel),
        )
    )


async def resolve_contact(
    session: AsyncSession,
    *,
    email: str | None = None,
    linkedin: str | None = None,
) -> ResolveResult:
    """
    Hierarchical contact resolution. NEVER modifies data.

    Priority cascade:
      1. EMAIL (exact, normalised) → high confidence, returns Contact
      2. LINKEDIN (exact, normalised) → high confidence, returns Contact
      3. No match → NO_MATCH
    """

    # ── 1. EMAIL MATCH (highest priority) ──────────────────────────
    norm_email = normalize_email(email)
    if norm_email:
        result = await session.execute(
            _contact_query().where(
                func.lower(Contact.email) == norm_email
            )
        )
        contact = result.scalar_one_or_none()
        if contact:
            return ResolveResult(contact=contact, match_type="email", confidence="high")

    # ── 2. LINKEDIN MATCH (exact normalised comparison) ────────────
    norm_linkedin = normalize_linkedin(linkedin)
    if norm_linkedin is not None:
        result = await session.execute(
            _contact_query().where(
                Contact.linkedin_normalized == norm_linkedin
            )
        )
        contact = result.scalar_one_or_none()
        if contact:
            return ResolveResult(contact=contact, match_type="linkedin", confidence="high")

    # ── 3. NO MATCH ────────────────────────────────────────────────
    return NO_MATCH
