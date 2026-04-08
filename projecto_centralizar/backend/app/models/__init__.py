"""
Registro central de todos los modelos SQLAlchemy del CRM.

Este archivo importa todos los modelos para que:
1. Alembic pueda detectarlos al generar migraciones automáticas
2. Base.metadata.create_all() cree todas las tablas al iniciar
3. Se puedan importar desde app.models directamente

Al añadir un nuevo modelo, importarlo aquí y añadirlo a __all__.
"""

from app.models.campaign import Campaign, contact_campaigns
from app.models.contact import Contact, contact_cargos
from app.models.sector import Sector
from app.models.user import User
from app.models.vertical import Vertical
from app.models.cargo import Cargo
from app.models.product import Product
from app.models.empresa import Empresa, empresa_sectors, empresa_verticals, empresa_products
# ── Nuevos modelos (Parte 3) ──
from app.models.user_request import UserRequest  # Solicitudes de acceso
from app.models.log import Log                    # Registro de auditoría

__all__ = [
    "Campaign",
    "Contact",
    "Sector",
    "Vertical",
    "User",
    "Cargo",
    "Product",
    "Empresa",
    # Parte 3: Persistencia de solicitudes y logs
    "UserRequest",
    "Log",
]
