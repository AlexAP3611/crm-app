import asyncio
from app.database import get_db
from app.models.empresa import Empresa
from app.schemas.empresa import EmpresaCreate
from app.routers.empresas import create_empresa

async def main():
    async for db in get_db():
        payload = EmpresaCreate(
            nombre="Test Local Create 123",
            cif=None,
            email=None,
            web=None,
            numero_empleados=None,
            facturacion=None,
            cnae=None,
            sector_ids=[],
            vertical_ids=[],
            product_ids=[]
        )
        try:
            res = await create_empresa(payload, db)
            print("SUCCESS")
            print(res.id)
        except Exception as e:
            print("ERROR IN ROUTE:", type(e), e)
            import traceback
            traceback.print_exc()

asyncio.run(main())
