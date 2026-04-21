"""
Scoped request bodies for all bulk operations.
No 'mode' field. Behavior is implicit from field presence:
  - ids present → operate on those IDs
  - filters present → operate on all matching filters
  - neither → backend decides based on allow_all policy
"""
from typing import Optional

from pydantic import BaseModel

from app.schemas.empresa import EmpresaFilterFields, EmpresaUpdate
from app.schemas.contact import ContactFilterFields, ContactUpdate


# ── Empresa scoped requests ──

class EmpresaScopedDelete(BaseModel):
    ids: Optional[list[int]] = None
    filters: Optional[EmpresaFilterFields] = None
    all: bool | None = False


class EmpresaScopedUpdate(BaseModel):
    ids: Optional[list[int]] = None
    filters: Optional[EmpresaFilterFields] = None
    all: bool | None = False
    data: EmpresaUpdate


# ── Contact scoped requests ──

class ContactScopedDelete(BaseModel):
    ids: Optional[list[int]] = None
    filters: Optional[ContactFilterFields] = None


class ContactScopedUpdate(BaseModel):
    ids: Optional[list[int]] = None
    filters: Optional[ContactFilterFields] = None
    data: ContactUpdate
