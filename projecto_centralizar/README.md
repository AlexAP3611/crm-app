# Prisma CRM

CRM fullstack para gestión de **contactos**, **empresas** y **campañas** con flujo de **enriquecimiento progresivo** (cada CSV/integración rellena campos sin pisar los ya existentes).

Stack: **FastAPI · PostgreSQL · React (Vite)**.

---

## Requisitos

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ con base de datos creada (por defecto `crm_db`, usuario `crm_user`)

---

## Puesta en marcha (desarrollo)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Linux/Mac
# venv\Scripts\activate           # Windows
pip install -r requirements.txt
```

Copiar la plantilla y ajustar valores:

```bash
cp .env.example .env
# Editar .env: DATABASE_URL, JWT_SECRET_KEY, SESSION_SECRET_KEY
```

Generar claves seguras:
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Aplicar migraciones (Alembic gestiona TODO el esquema, no hay `create_all`):

```bash
alembic upgrade head
```

Crear el usuario administrador inicial (ejecutar desde `backend/`):

```bash
python scripts/create_admin.py
# Por defecto: administrador@gmail.com / abc123.  ← cambiar tras primer login
```

Arrancar el servidor:

```bash
uvicorn app.main:app --reload
```

- API docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/health

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

---

## Autenticación

Tres métodos soportados (en orden de prioridad), centralizados en `app/auth.py`:

1. **JWT Bearer** — `Authorization: Bearer <token>`. Flujo principal del SPA.
   - `POST /api/login` devuelve `access_token` (firmado con `JWT_SECRET_KEY`, HS256).
   - `POST /api/refresh` renueva el token mientras el actual siga vivo (keepalive de sesión).
2. **API Key estática** — `X-API-Key: <key>` (sólo este header; **no** se acepta vía `Authorization`). La clave se almacena en la tabla `settings` (key `crm_api_key`) y la comparación es timing-safe (`hmac.compare_digest`).
   - **Service account**: la API key autentica como un usuario explícito guardado en `settings.crm_api_key_user_id`. Configurarlo con `POST /api/system/api-key/service-account/{user_id}` antes de usar la API key (recomendado: crear un usuario dedicado con rol `gestor`, no reutilizar el admin).
3. **Session cookie** — fallback de compatibilidad. Firmada con `SESSION_SECRET_KEY`.

### Roles

- `admin` — acceso total (master data, usuarios, requests, settings de API/webhooks).
- `gestor` — contactos, empresas, campañas, CSV.

El control se aplica vía dependencias FastAPI: `CurrentUser` (cualquier autenticado), `AdminUser` (solo `admin`).

---

## Módulos del backend (`app/`)

| Carpeta | Contenido |
|---------|-----------|
| `main.py` | Entry point FastAPI + middlewares (CORS, sesión) |
| `config.py` | Settings desde `.env` (Pydantic Settings) |
| `database.py` | Engine async SQLAlchemy + `get_db` dependency |
| `auth.py` | Hashing bcrypt, JWT, dependencias `CurrentUser`/`AdminUser` |
| `models/` | Contact, Empresa, Campaign, Sector, Vertical, Cargo, Product, User, UserRequest, Setting, Log, EnrichmentLog |
| `schemas/` | Pydantic schemas (entrada/salida API) |
| `routers/` | Endpoints HTTP (ver tabla abajo) |
| `services/` | Lógica de negocio (upsert, merge, enrichment, CSV…) |
| `core/` | Utilidades transversales: mapeos de campos, reglas de enrichment, view fields |
| `domain/` | Reglas de relaciones entre entidades |

### Routers

| Prefijo | Tag | Auth | Descripción |
|---------|-----|------|-------------|
| `/api` | Auth | público / `CurrentUser` | login, logout, refresh, /me, change-password |
| `/api/contacts` | Contacts | `CurrentUser` | CRUD + upsert + filtros |
| `/api/empresas` | Empresas | `CurrentUser` | CRUD empresas + relaciones M2M |
| `/api/campaigns` | Campaigns | `CurrentUser` | Gestión de campañas |
| `/api/csv/contacts` | CSV | `CurrentUser` | Import/export contactos (contrato v1) |
| `/api/csv/empresas` | CSV | `CurrentUser` | Import/export empresas (contrato v1) |
| `/api/enrichment` | Enrichment | `CurrentUser` | Ingesta de datos enriquecidos |
| `/api/master-data` | Master Data | `AdminUser` | Sectores, verticales, productos, cargos |
| `/api/users` | Users | `AdminUser` | Gestión de usuarios |
| `/api/access-requests` | Access Requests | mixto | Solicitudes de alta de gestores |
| `/api/logs` | Logs | `AdminUser` | Auditoría + cleanup según `LOG_RETENTION_DAYS` |
| `/api/system` | System | `AdminUser` | Config interna, claves API, webhooks |

---

## Módulos del frontend (`frontend/src/`)

```
src/
├── App.jsx                      # Router + layout (sidebar)
├── main.jsx
├── api/
│   ├── client.js                # fetch wrapper con JWT + 401 handler
│   ├── masterData.js
│   └── settingsService.js
├── auth/token.js                # localStorage + decode JWT
├── components/
│   ├── Login.jsx
│   ├── ProtectedRoute.jsx
│   ├── ContactsTable.jsx, ContactModal.jsx
│   ├── FilterPanel.jsx, ActiveFilters.jsx
│   ├── CampaignCard.jsx, CampaignModal.jsx
│   ├── CSV.jsx                  # Import/Export UI
│   ├── CompanyAutocomplete.jsx
│   ├── Checkbox.jsx, MultiSelect.jsx, RowMenu.jsx
│   ├── SessionTimeoutModal.jsx  # aviso de inactividad + refresh
│   └── SettingsPage.jsx         # admin (APIs y webhooks)
├── pages/
│   ├── ContactsPage.jsx
│   ├── EmpresasPage.jsx
│   ├── CampaignsPage.jsx
│   ├── MasterDataPage.jsx       # admin
│   ├── UsersPage.jsx            # admin
│   ├── RequestsPage.jsx         # admin
│   ├── RequestAccessPage.jsx    # público (solicitar acceso)
│   └── SettingsPage.jsx         # cambio de contraseña
└── hooks/
    ├── useContacts.js
    ├── useDebounce.js
    ├── useQueryParams.js
    └── useSessionTimeout.js     # auto-logout / refresh
```

---

## Reglas de negocio clave

| Regla | Detalle |
|-------|---------|
| Identidad de contacto | `email` único o `linkedin` único |
| Identidad de empresa | Resolución `empresa_id → cif → web → nombre` (ver `CSV_CONTRACT_V1.md`) |
| Upsert | Nunca crea duplicados — busca por identidad antes de insertar |
| Strings vacíos | Se preservan los valores existentes (no se sobrescriben con `""`) |
| Placeholders inválidos | `N/A`, `Unknown`, `Desconocido`, `-`, `.` rechazados como nombre de empresa |
| M2M (campañas, sectores, verticales, productos) | Estrategia **merge-append**: añade IDs nuevos, conserva los existentes |
| `notes` (JSONB) | Deep-merge en cada update — nunca se reemplaza |
| Borrado lógico de usuarios | `is_active=False` invalida JWTs activos en `get_current_user` |

Contrato CSV detallado: [`backend/docs/CSV_CONTRACT_V1.md`](backend/docs/CSV_CONTRACT_V1.md).

---

## Migraciones (Alembic)

- Todas las versiones viven en `backend/alembic/versions/`.
- El esquema se gestiona **exclusivamente** vía Alembic — `main.py` no llama a `create_all`.
- Crear nueva migración:
  ```bash
  alembic revision --autogenerate -m "descripción"
  alembic upgrade head
  ```
- `versions_backup/` contiene el histórico previo al rebase del esquema (referencia, no se ejecuta).

---

## Despliegue

Script de referencia: [`scripts/deploy.sh`](scripts/deploy.sh) — pull + migraciones + build frontend + restart de `crm-backend` y `nginx` vía `systemctl`. Ajustar rutas y nombres de servicio según el entorno destino.

---

## Notas de seguridad

- ⚠️ El `.env` **no debe commitearse** — está cubierto por `.gitignore`. Usar `.env.example` como plantilla.
- ⚠️ Si se ha commiteado un `.env` con credenciales reales en el pasado, **rotar contraseñas y claves** y considerar reescribir el historial git.
- `JWT_SECRET_KEY` y `SESSION_SECRET_KEY` deben ser distintas y aleatorias en producción (≥ 64 bytes).
- Las versiones de `requirements.txt` están **fijadas** — `bcrypt==4.0.1` por compatibilidad con `passlib`. No actualizar sin probar.
- `bootstrap` admin (`scripts/create_admin.py`): cambiar contraseña inmediatamente tras el primer login.
- **Rate limiting** (`slowapi`, en memoria del proceso): `/api/login` 10/min, `/api/refresh` 30/min, `/api/change-password` 5/min, `/api/request-access` 3/min. Para escalar a varios workers, configurar storage Redis en [`app/core/ratelimit.py`](backend/app/core/ratelimit.py).
- **Cabeceras de seguridad** activas en todas las respuestas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. `Strict-Transport-Security` solo en producción (`DEBUG=false`).
- **Cookie de sesión** (`crm_session`): `HttpOnly`, `SameSite=Lax`, `max_age=1h`, `Secure` en producción.
- **Upload CSV/XLSX**: límite de 10 MB. Configurable en `csv_service.MAX_UPLOAD_BYTES`.
- **Service account de la API key**: configurable vía `POST /api/system/api-key/service-account/{user_id}`. Sin esto, las requests con `X-API-Key` válida son **rechazadas**.
