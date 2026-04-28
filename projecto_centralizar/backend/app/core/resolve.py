"""
Contact Identity Normalization helpers.

This module contains pure normalization logic for identity fields (email, linkedin, phone).
Resolution logic is handled in the service layer (contact_service.py).
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


def normalize_phone(phone: str | None) -> str | None:
    """
    Basic phone normalization.
    Strips whitespace, dashes, and parentheses.
    """
    if not phone:
        return None
    # Remove common non-numeric separators but keep '+' if present
    cleaned = re.sub(r'[\s\-\(\)\.]', '', phone)
    return cleaned if cleaned else None
