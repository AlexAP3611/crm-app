"""
Shared contact filtering logic.
Used by: contact_service, integration_service, enrichment_service.

Pure query-building module: no DB writes, no service-layer dependencies.
Only imports models and SQLAlchemy primitives.
"""
from sqlalchemy import or_
from sqlalchemy.sql import exists

from app.models.contact import Contact
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products


def apply_contact_filters(query, filters):
    """
    Apply contact business filters to a SQLAlchemy query.

    Uses EXISTS subqueries for M2M relationships (sector, vertical, product,
    campaign) so the filtering is independent of the query's loading strategy
    (joinedload / selectinload).

    No pagination — callers handle page/page_size separately.
    """
    if filters.empresa_id is not None:
        query = query.where(Contact.empresa_id == filters.empresa_id)

    if filters.contacto_nombre:
        term = f"%{filters.contacto_nombre}%"
        query = query.where(
            or_(
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term)
            )
        )

    if filters.sector_id is not None:
        query = query.where(
            exists().where(
                (empresa_sectors.c.empresa_id == Contact.empresa_id) &
                (empresa_sectors.c.sector_id == filters.sector_id)
            )
        )
    if filters.vertical_id is not None:
        query = query.where(
            exists().where(
                (empresa_verticals.c.empresa_id == Contact.empresa_id) &
                (empresa_verticals.c.vertical_id == filters.vertical_id)
            )
        )
    if filters.product_id is not None:
        query = query.where(
            exists().where(
                (empresa_products.c.empresa_id == Contact.empresa_id) &
                (empresa_products.c.product_id == filters.product_id)
            )
        )

    if filters.cargo_id is not None:
        query = query.where(Contact.cargo_id == filters.cargo_id)
    if filters.campaign_id is not None:
        from app.models.campaign import contact_campaigns as ccamp_table
        query = query.where(
            exists().where(
                (ccamp_table.c.contact_id == Contact.id) &
                (ccamp_table.c.campaign_id == filters.campaign_id)
            )
        )

    if filters.email:
        term = f"%{filters.email}%"
        query = query.where(
            or_(
                Contact.email.ilike(term),
                Contact.empresa_rel.has(Empresa.email.ilike(term))
            )
        )

    if filters.search:
        term = f"%{filters.search}%"
        query = query.where(
            or_(
                Contact.empresa_rel.has(Empresa.nombre.ilike(term)),
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term),
                Contact.empresa_rel.has(Empresa.email.ilike(term)),
                Contact.email.ilike(term),
            )
        )

    if filters.is_enriched is True:
        query = query.where(Contact.enriched.is_(True))
    elif filters.is_enriched is False:
        query = query.where(Contact.enriched.is_(False))

    if filters.categoria_cargo_id is not None:
        from app.models.cargo import Cargo
        query = query.where(
            Contact.cargo.has(Cargo.categoria_id == filters.categoria_cargo_id)
        )

    return query
