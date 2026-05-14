from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import pycountry
import gettext
import os

# revision identifiers, used by Alembic.
revision = '5df2ed5a489d'
down_revision = '20260514_add_paises_provincias'
branch_labels = None
depends_on = None

PROVINCIAS_INE = [
    'Albacete', 'Alicante/Alacant', 'Almería', 'Araba/Álava', 'Asturias', 'Ávila', 
    'Badajoz', 'Balears, Illes', 'Barcelona', 'Bizkaia', 'Burgos', 'Cáceres', 
    'Cádiz', 'Cantabria', 'Castellón/Castelló', 'Ciudad Real', 'Córdoba', 'Coruña, A', 
    'Cuenca', 'Gipuzkoa', 'Girona', 'Granada', 'Guadalajara', 'Huelva', 'Huesca', 
    'Jaén', 'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 
    'Ourense', 'Palencia', 'Palmas, Las', 'Pontevedra', 'Rioja, La', 'Salamanca', 
    'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 
    'Toledo', 'Valencia/València', 'Valladolid', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'
]

def upgrade() -> None:
    conn = op.get_bind()
    
    # 1. Generate country list in Spanish using pycountry
    locales_dir = pycountry.LOCALES_DIR
    try:
        spanish = gettext.translation('iso3166-1', locales_dir, languages=['es'])
        def get_spanish_name(country):
            return spanish.gettext(country.name)
    except Exception:
        # Fallback to English if translation fails
        def get_spanish_name(country):
            return country.name

    print("Seeding countries from pycountry...")
    for country in pycountry.countries:
        name = get_spanish_name(country)
        conn.execute(
            text("INSERT INTO paises (name) VALUES (:name) ON CONFLICT DO NOTHING"),
            {"name": name}
        )

    # 2. Ensure "España" exists (it might have been inserted with a different name or already exists)
    # pycountry name for ES in Spanish is "España"
    spain_name = "España"
    conn.execute(
        text("INSERT INTO paises (name) VALUES (:name) ON CONFLICT DO NOTHING"),
        {"name": spain_name}
    )
    
    spain_row = conn.execute(
        text("SELECT id FROM paises WHERE lower(name) = lower(:name)"),
        {"name": spain_name}
    ).fetchone()
    
    if spain_row:
        spain_id = spain_row[0]
        print(f"Seeding {len(PROVINCIAS_INE)} provinces for Spain (ID: {spain_id})...")
        for prov_name in PROVINCIAS_INE:
            conn.execute(
                text("INSERT INTO provincias (name, pais_id) VALUES (:name, :pais_id) ON CONFLICT DO NOTHING"),
                {"name": prov_name, "pais_id": spain_id}
            )
    else:
        print("Warning: Could not find or create 'España' in paises table.")

def downgrade() -> None:
    pass
