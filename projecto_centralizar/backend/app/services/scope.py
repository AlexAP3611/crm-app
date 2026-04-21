"""
Single function that applies scope to any SQLAlchemy query.
Filters are applied DIRECTLY — no subquery, no ID materialization.

Safety:
  - allow_all=False (default) → raises if no ids or filters provided
  - Filters are normalized: None/empty-string values are stripped
  - IDs are deduplicated with order preserved
  - Structured logging on every invocation

Boundary rule: apply_scope() ONLY adds WHERE clauses.
              Never joins, permissions, or business logic.
"""
import logging
from typing import Callable, Optional

from pydantic import BaseModel
from sqlalchemy.sql import Select

logger = logging.getLogger(__name__)


def _normalize_filters(filters: Optional[BaseModel]) -> Optional[BaseModel]:
    """
    Strip filters where all values are None or empty string.
    Returns None if no meaningful filter remains.
    """
    if filters is None:
        return None

    has_value = any(
        v is not None and v != ""
        for v in filters.model_dump().values()
    )
    return filters if has_value else None


def _dedupe_ids(ids: Optional[list[int]]) -> Optional[list[int]]:
    """Deduplicate IDs preserving order. Returns None if empty."""
    if not ids:
        return None
    return list(dict.fromkeys(ids))


def apply_scope(
    query: Select,
    *,
    model,
    ids: Optional[list[int]] = None,
    filters: Optional[BaseModel] = None,
    apply_filters_fn: Callable = None,
    allow_all: bool = False,
) -> Select:
    """
    Apply scope constraints directly to a query.

    Priority:
      1. ids provided → WHERE model.id IN (deduplicated ids)
      2. filters provided (with at least one non-empty value) → apply_filters_fn(query, filters)
      3. neither → if allow_all: return unmodified query. Otherwise: raise ValueError.

    This function ONLY adds WHERE clauses. Never joins, permissions, or business logic.
    """
    clean_ids = _dedupe_ids(ids)
    clean_filters = _normalize_filters(filters)

    if clean_ids:
        logger.info(
            "scope_applied",
            extra={"model": model.__name__, "type": "ids", "count": len(clean_ids)},
        )
        return query.where(model.id.in_(clean_ids))

    if clean_filters and apply_filters_fn:
        logger.info(
            "scope_applied",
            extra={
                "model": model.__name__,
                "type": "filter",
                "filters": clean_filters.model_dump(exclude_none=True),
            },
        )
        return apply_filters_fn(query, clean_filters)

    if allow_all:
        logger.info(
            "scope_applied",
            extra={"model": model.__name__, "type": "all"},
        )
        return query

    raise ValueError(
        "Scope required: provide 'ids' or 'filters'. "
        "Empty scope (all records) is not allowed for this operation."
    )
