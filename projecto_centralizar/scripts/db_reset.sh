#!/bin/bash
set -euo pipefail

echo "⚠️  RESET COMPLETO DE BASE DE DATOS"
read -p "¿Estás seguro? (escribe RESET para confirmar): " confirm
[[ "$confirm" != "RESET" ]] && echo "Cancelado." && exit 1

cd /home/vboxuser/crm-app/crm-app/projecto_centralizar/backend
source venv/bin/activate

# Drop y recrear tablas
python -c '
import asyncio
from app.database import engine, Base
import app.models

async def drop_all():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    async with engine.begin() as conn:
        from sqlalchemy import text
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version;"))
    await engine.dispose()
asyncio.run(drop_all())
'

# Ejecutar todas las migraciones desde cero
alembic upgrade head

echo "✅ DB recreada desde migrations"
