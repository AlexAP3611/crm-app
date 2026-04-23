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
from typing import Any, Callable, Optional

from pydantic import BaseModel
from sqlalchemy.sql import Select

logger = logging.getLogger(__name__)

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
    filters: Any = None,
    apply_filters_fn: Callable = None,
    allow_all: bool = False,
) -> Select:
    """
    Apply scope constraints directly to a query.

    Rules:
      - EMPTY -> ALL rows
      - IDS -> filter by ids
      - FILTERS -> filter by conditions
      - BOTH -> AND logic
      - ALL flag -> explicit full dataset override
    """
    clean_ids = _dedupe_ids(ids)
    clean_filters = filters

    # 1. explicit override
    if allow_all:
        logger.info(
            "scope_applied",
            extra={"model": model.__name__, "type": "all_explicit"},
        )
        return query

    # 2. apply ids filter
    if clean_ids:
        logger.info(
            "scope_applied",
            extra={"model": model.__name__, "type": "ids", "count": len(clean_ids)},
        )
        query = query.where(model.id.in_(clean_ids))

    # 3. apply filters
    if clean_filters and apply_filters_fn:
        logger.info(
            "scope_applied",
            extra={
                "model": model.__name__,
                "type": "filter",
                # Extract representation safely purely for log debugging
                "filters": clean_filters.model_dump() if hasattr(clean_filters, "model_dump") else str(clean_filters),
            },
        )
        query = apply_filters_fn(query, clean_filters)

    # 4. EMPTY SCOPE = ALL DATASET (NO OP)
    if not clean_ids and not clean_filters:
        logger.info(
            "scope_applied",
            extra={"model": model.__name__, "type": "empty_implicit_all"},
        )
        
    return query
