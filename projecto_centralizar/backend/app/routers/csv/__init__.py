from fastapi import APIRouter, Depends
from app.auth import get_current_user
from .contacts import router as contacts_router
from .empresas import router as empresas_router

router = APIRouter(
    prefix="/api/csv",
    tags=["CSV"],
    dependencies=[Depends(get_current_user)]
)

router.include_router(contacts_router, prefix="/contacts")
router.include_router(empresas_router, prefix="/empresas")
