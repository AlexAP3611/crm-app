from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import auth, contacts, csv, enrichment, lookup, master_data, campaigns, system, access_requests, users

# Import all models so Alembic can detect them
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: auto-create tables if they don't exist (dev convenience)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # On shutdown: dispose connection pool
    await engine.dispose()


app = FastAPI(
    title="CRM API",
    version="1.0.0",
    description="Fullstack CRM — contact management with progressive enrichment",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.middleware.sessions import SessionMiddleware
app.add_middleware(SessionMiddleware, secret_key="crm_internal_secret")

app.include_router(auth.router)
app.include_router(master_data.router)
app.include_router(contacts.router)
app.include_router(csv.router)
app.include_router(enrichment.router)
app.include_router(lookup.router)
app.include_router(campaigns.router)
app.include_router(system.router)
app.include_router(access_requests.router)
app.include_router(users.router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
