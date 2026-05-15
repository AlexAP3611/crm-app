import asyncio
import sys
import os
import unicodedata
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import text
from app.database import engine

def normalize_name(name: str) -> str:
    """Normalize string: lowercase, remove accents and take the first part of slash-separated names."""
    if not name:
        return ""
    # Use only first part if there is a slash (e.g. 'Alicante/Alacant' -> 'alicante')
    name = name.split('/')[0].strip()
    # Remove accents
    name = "".join(
        c for c in unicodedata.normalize('NFD', name)
        if unicodedata.category(c) != 'Mn'
    )
    return name.lower()

async def cleanup():
    print("🚀 Iniciando limpieza de base de datos...")
    async with engine.begin() as conn:
        # 1. Borrar columna contacts.categoria si existe
        print("Checking for contacts.categoria column...")
        col_exists = await conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='contacts' AND column_name='categoria'"
        ))
        if col_exists.fetchone():
            print("Dropping contacts.categoria column...")
            await conn.execute(text("ALTER TABLE contacts DROP COLUMN categoria"))

        # 2. Unificar Provincias Duplicadas
        print("Analyzing duplicate provinces...")
        res = await conn.execute(text("SELECT id, name FROM provincias ORDER BY id"))
        provincias = res.fetchall()
        
        # map normalized name -> [list of IDs]
        buckets = {}
        for pid, name in provincias:
            norm = normalize_name(name)
            if norm not in buckets: buckets[norm] = []
            buckets[norm].append({"id": pid, "name": name})

        for norm, items in buckets.items():
            if len(items) > 1:
                # We have duplicates. 
                # Strategy: Keep the one with the longer name (usually the INE one like 'Araba/Álava' or 'Castellón/Castelló')
                # OR if one name contains '/', prefer that one as 'Official'.
                items.sort(key=lambda x: (1 if '/' in x['name'] else 0, len(x['name'])), reverse=True)
                canonical = items[0]
                to_delete = items[1:]
                
                print(f"  Unifying '{norm}': Keeping '{canonical['name']}' (ID {canonical['id']})")
                for dup in to_delete:
                    print(f"    - Remapping ID {dup['id']} ('{dup['name']}') -> {canonical['id']}")
                    # Remap Empresas
                    await conn.execute(
                        text("UPDATE empresas SET provincia_id = :canonical_id WHERE provincia_id = :dup_id"),
                        {"canonical_id": canonical['id'], "dup_id": dup['id']}
                    )
                    # Delete the duplicate
                    await conn.execute(
                        text("DELETE FROM provincias WHERE id = :dup_id"),
                        {"dup_id": dup['id']}
                    )

        # 3. Final Integrity Check
        print("\n🔍 Verificando integridad referencial...")
        check_res = await conn.execute(text("""
            SELECT COUNT(*) FROM empresas e 
            LEFT JOIN provincias p ON e.provincia_id = p.id 
            WHERE e.provincia_id IS NOT NULL AND p.id IS NULL
        """))
        orphans = check_res.scalar()
        
        if orphans == 0:
            print("✅ INTEGRIDAD OK: No hay IDs huérfanos.")
        else:
            print(f"❌ ERROR: Se encontraron {orphans} registros huérfanos. Revisa la lógica.")

    print("\n✨ Limpieza completada.")

if __name__ == "__main__":
    asyncio.run(cleanup())
