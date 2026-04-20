"""
Domain-level relationship configuration for Contact and Empresa entities.
This module is strictly declarative and defines M2M relationship structures.
"""

# M2M fields that belong to Contact
M2M_FIELD_MAP = {
    "campaign_ids": {"relation_name": "campaigns", "model": "Campaign"}
}

# M2M fields that belong to Empresa
EMPRESA_M2M_FIELD_MAP = {
    "sector_ids": {"relation_name": "sectors", "model": "Sector"},
    "vertical_ids": {"relation_name": "verticals", "model": "Vertical"},
    "product_ids": {"relation_name": "products_rel", "model": "Product"},
}
