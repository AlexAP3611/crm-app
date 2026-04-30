"""
Generic M2M Entity Service Base.

Provides reusable normalize, prefill_cache, and get_or_create logic
for simple name-based M2M entities (Sector, Vertical, Product).

Usage:
    sector_svc = M2MEntityService(Sector)
    cache = await sector_svc.prefill_cache(session, {"tech", "finanzas"})
    entity = await sector_svc.get_or_create(session, "Tech", cache=cache)
"""
import re
from typing import TypeVar, Type
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.database import Base
from app.core.exceptions import DuplicateEntityError

ModelT = TypeVar("ModelT", bound=Base)


class M2MEntityService:
    """
    Generic service for simple name-based M2M entities.
    
    Each entity model MUST have:
      - `id` (int, primary key)
      - `name` (str, unique via case-insensitive index)
    """

    def __init__(self, model: Type[ModelT]):
        self.model = model

    def normalize_name(self, raw_name: str) -> str | None:
        """
        Normalize a raw entity name for consistent lookup/storage.
        
        Rules:
          1. Strip leading/trailing whitespace
          2. Collapse multiple internal spaces to one
          3. Title Case for display
        
        Cache keys use .lower() of the normalized result.
        Returns None if the result is empty.
        """
        if not raw_name:
            return None
        val = raw_name.strip()
        val = re.sub(r'\s+', ' ', val)
        if not val:
            return None
        return val.title()

    def cache_key(self, raw_name: str) -> str | None:
        """Compute the lowercase cache key for a raw name."""
        norm = self.normalize_name(raw_name)
        if not norm:
            return None
        return norm.lower()

    async def prefill_cache(
        self, session: AsyncSession, raw_names: set[str]
    ) -> dict[str, ModelT]:
        """
        Batch-fetch existing entities for a set of raw names.
        Returns dict[lowercase_normalized_name, Entity].
        Eliminates N+1 queries during import loops.
        """
        if not raw_names:
            return {}

        # Build set of lowercase normalized names for the IN clause
        norm_keys = set()
        for name in raw_names:
            key = self.cache_key(name)
            if key:
                norm_keys.add(key)

        if not norm_keys:
            return {}

        result = await session.execute(
            select(self.model).where(
                func.lower(self.model.name).in_(norm_keys)
            )
        )
        return {entity.name.lower(): entity for entity in result.scalars().all()}

    async def get_or_create(
        self,
        session: AsyncSession,
        raw_name: str,
        cache: dict[str, ModelT] | None = None,
    ) -> ModelT | None:
        """
        Idempotent get-or-create for a single entity name.
        Uses create_strict internally if the entity is not found.
        """
        normalized = self.normalize_name(raw_name)
        if not normalized:
            return None

        key = normalized.lower()

        # 1. Cache hit
        if cache is not None and key in cache:
            return cache[key]

        # 2. DB lookup
        result = await session.execute(
            select(self.model).where(func.lower(self.model.name) == key)
        )
        entity = result.scalars().first()

        if not entity:
            # 3. Attempt to create via create_strict
            try:
                entity = await self.create_strict(session, raw_name)
            except (DuplicateEntityError, ValueError):
                # Race condition or validation error: try lookup one last time
                result = await session.execute(
                    select(self.model).where(func.lower(self.model.name) == key)
                )
                entity = result.scalars().first()

        # 4. Populate cache
        if cache is not None and entity:
            cache[key] = entity

        return entity

    async def create_strict(
        self, session: AsyncSession, raw_name: str
    ) -> ModelT:
        """
        Strict creation for UI/Manual input.
        Raises DuplicateEntityError if already exists (case-insensitive).
        """
        if not raw_name:
            raise ValueError("El nombre no puede estar vacío")

        normalized = self.normalize_name(raw_name)
        if not normalized:
            raise ValueError("El nombre no puede estar vacío")

        key = normalized.lower()

        # 1. Pre-emptive check
        result = await session.execute(
            select(self.model).where(func.lower(self.model.name) == key)
        )
        if result.scalars().first():
            raise DuplicateEntityError(f"El valor '{normalized}' ya existe")

        # 2. Try to create
        try:
            async with session.begin_nested():
                entity = self.model(name=normalized)
                session.add(entity)
                await session.flush()
            return entity
        except IntegrityError:
            # Race condition fallback
            raise DuplicateEntityError(f"El valor '{normalized}' ya existe")
