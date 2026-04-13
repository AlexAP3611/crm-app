import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.config import settings
import urllib.request
import json

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with async_session() as session:
        result = await session.execute(text("SELECT value FROM settings WHERE key='crm_api_key'"))
        api_key = result.scalar()

    data = json.dumps({
        'nombre': 'Test Empresa New XYZ',
        'cif': None,
        'email': None,
        'web': None,
        'numero_empleados': None,
        'facturacion': None,
        'cnae': None,
        'sector_ids': [],
        'vertical_ids': [],
        'product_ids': []
    }).encode('utf-8')

    req = urllib.request.Request('http://127.0.0.1:8000/api/empresas', data=data, headers={
        'Content-Type': 'application/json',
        'X-API-Key': api_key
    })
    
    try:
        with urllib.request.urlopen(req) as res:
            print("STATUS:", res.getcode())
            print(res.read().decode())
    except urllib.error.HTTPError as e:
        print("ERROR STATUS:", e.code)
        print(e.read().decode())
    except Exception as e:
        print("OTHER ERROR:", e)

asyncio.run(main())
