# Arquitectura CRM

> Documento técnico de referencia. Describe la estructura del sistema, sus módulos y las
> decisiones de diseño que explican por qué está construido como está.
> Para las reglas de negocio del pipeline de importación, ver `business-rules.md`.

---

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | FastAPI + Uvicorn | 0.135.1 / 0.41.0 |
| ORM | SQLAlchemy Async | 2.0.48 |
| Driver BD | asyncpg | 0.31.0 |
| Base de datos | PostgreSQL | 14+ |
| Migraciones | Alembic | 1.18.4 |
| Validación | Pydantic | 2.12.5 |
| Autenticación | python-jose (JWT HS256) + passlib/bcrypt | — |
| Rate limiting | slowapi (en memoria del proceso) | 0.1.9 |
| Frontend | React + Vite | — |
| Automatizaciones externas | n8n (acceso vía API Key) | — |

> **Nota importante sobre dependencias:** Las versiones en `requirements.txt` están fijadas intencionalmente.
> `bcrypt==4.0.1` es incompatible con versiones superiores cuando se usa con `passlib`. No actualizar sin probar.

---

## Estructura del proyecto

```
projecto_centralizar/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Entry point FastAPI + middlewares
│   │   ├── config.py                # Settings desde .env (Pydantic Settings)
│   │   ├── database.py              # Engine async + AsyncSessionLocal + get_db
│   │   ├── auth.py                  # JWT, bcrypt, dependencias CurrentUser/AdminUser
│   │   ├── models/                  # Modelos SQLAlchemy (fuente de verdad del esquema)
│   │   ├── schemas/                 # Pydantic schemas (contratos de entrada/salida API)
│   │   ├── routers/                 # Endpoints HTTP organizados por dominio
│   │   ├── services/                # Lógica de negocio (upserts, merge, M2M base service, exports)
│   │   ├── core/
│   │   │   ├── importer/            # Pipeline de importación CSV/XLSX (ver más abajo)
│   │   │   ├── enrichment/          # Reglas declarativas de enriquecimiento
│   │   │   ├── mappings/            # Alias de campos para normalización de columnas
│   │   │   ├── domain_mappers/      # Conversión modelo → dict para upserts
│   │   │   ├── view_fields/         # Qué campos devuelve cada entidad en listados
│   │   │   ├── db/                  # Utilidades de sesión y transacciones
│   │   │   └── webhook_client.py    # Cliente para llamadas salientes a n8n u otros
│   │   └── domain/
│   │       └── relations.py         # Reglas de relaciones M2M entre entidades
│   ├── alembic/                     # Migraciones de esquema (única fuente de verdad de BD)
│   ├── scripts/
│   │   └── create_admin.py          # Bootstrap del primer usuario admin
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx                  # Router + layout (sidebar)
│       ├── api/                     # fetch wrapper con JWT + 401 handler
│       ├── auth/                    # localStorage + decode JWT
│       ├── components/              # UI components reutilizables
│       ├── pages/                   # Vistas principales (Empresas, Contactos, etc.)
│       ├── hooks/                   # useContacts, useSessionTimeout, useDebounce…
│       └── config/                  # Configuración de campos del frontend (fields.js)
└── scripts/
    └── deploy.sh                    # Pull + migraciones + build frontend + restart servicios
```

---

## Modelo de datos

### Entidades principales y sus relaciones

```
Pais ──< Provincia
           │
           └──< Empresa ──< Contact
                  │    │         │
                  │    └──< Competidor (max 3)
                  │ M2M          ├── cargo_id ──> Cargo ──> CategoriaCargo
                  ├── Sector     │
                  ├── Vertical   └── M2M ──> Campaign
                  └── Product
```

### Tabla de entidades

| Modelo | Tabla | Identidad única | Notas |
|--------|-------|----------------|-------|
| `Pais` | `paises` | `name` lower unique | Catálogo estático |
| `Provincia` | `provincias` | `name` lower unique + `pais_id` | M2O con Pais |
| `Empresa` | `empresas` | `nombre` (lower unique) + índices funcionales en `cif`, `web` | Propietaria de sectores/verticales/productos vía M2M |
| `Contact` | `contacts` | `email` (unique), `linkedin_normalized` (unique) | `web`, `cif`, `sectors` son propiedades delegadas a su `Empresa` |
| `Cargo` | `cargos` | `normalized_name` (unique) | FK nullable a `CategoriaCargo` |
| `CategoriaCargo` | `categorias_cargo` | `name` lower unique | Agrupación de cargos gestionada desde UI |
| `Campaign` | `campaigns` | `nombre` lower unique | M2M con `Contact` vía `contact_campaigns` |
| `Sector` | `sectors` | `name` lower unique | M2M con `Empresa` vía `empresa_sectors` |
| `Vertical` | `verticals` | `name` lower unique | M2M con `Empresa` vía `empresa_verticals` |
| `Product` | `products` | `name` lower unique | M2M con `Empresa` vía `empresa_products` |
| `User` | `users` | `email` unique | Roles: `admin` / `gestor` (CHECK constraint) |
| `UserRequest` | `user_requests` | — | Estados: `pending` / `approved` / `rejected` |
| `Log` | `logs` | — | Auditoría de acciones. Limpieza automática según `LOG_RETENTION_DAYS` (default: 90 días) |
| `IntegrationLog` | `enrichment_logs` | `run_id` (UUID PK) | Trazabilidad de ejecuciones de enriquecimiento |
| `Setting` | `settings` | `key` (PK string) | JSONB flexible. Almacena `crm_api_key` y `crm_api_key_user_id` |
| `Competidor` | `competidores` | `(empresa_id, posicion)` unique | Hasta 3 por empresa. Campos: `web`, `facebook`. `posicion` ∈ {1, 2, 3}. CASCADE DELETE desde Empresa. |
| `AffinoAccount` | `affino_accounts` | — | Cuentas para integración con Affino |

### Campos JSONB en Contact

`notes` almacena un diccionario libre con deep-merge en cada actualización. El enriquecimiento escribe
en `notes[source]["_enrichment_{field}"]` cuando el campo destino ya tiene valor (campos protegidos:
`web`, `email`, `phone`).

---

## Autenticación

Tres métodos soportados, evaluados en este orden por `get_current_user` en `auth.py`:

| Método | Header / mecanismo | Uso |
|--------|--------------------|-----|
| **JWT Bearer** | `Authorization: Bearer <token>` | Flujo principal del SPA. Token HS256 firmado con `JWT_SECRET_KEY`, expira en 60 min. `POST /api/refresh` renueva mientras el token esté activo. |
| **API Key** | `X-API-Key: <key>` | Integraciones externas (n8n). Comparación timing-safe. Requiere configurar un service account (`POST /api/system/api-key/service-account/{user_id}`). |
| **Session cookie** | `crm_session` | Fallback de compatibilidad. `HttpOnly`, `SameSite=Lax`, `Secure` en producción. |

### Roles

- `admin` — acceso completo, incluyendo master data, usuarios, logs, configuración del sistema.
- `gestor` — acceso operativo: contactos, empresas, campañas, importaciones.

Aplicados vía dependencias FastAPI: `CurrentUser` (cualquier autenticado) y `AdminUser` (solo `admin`).

Un usuario con `is_active=False` tiene sus JWTs invalidados en tiempo real en `get_current_user`.

### Rate limiting (slowapi, en memoria)

| Endpoint | Límite |
|----------|--------|
| `POST /api/login` | 10/min |
| `POST /api/refresh` | 30/min |
| `POST /api/change-password` | 5/min |
| `POST /api/request-access` | 3/min |

> Si se despliega con múltiples workers, migrar el storage de slowapi a Redis (`app/core/ratelimit.py`).

---

## Capa de Servicios

**Fuente:** `app/services/`

Aísla la lógica de negocio de los controladores HTTP (Routers). Los servicios son clases o módulos independientes de FastAPI.

- **Base Service M2M (`m2m_base_service.py`):** Centraliza el comportamiento `get_or_create` de entidades puente (Sectores, Verticales, Productos) manejando la normalización y prevención de colisiones (race conditions).
- **Merge (`merge.py`):** Lógica utilitaria para el `deep_merge` de diccionarios JSONB en la columna `notes`.
- **Export Mappers (`*_export_mapper.py`):** Separa la lógica de serialización compleja del acceso a datos.

---

## Routers (API)

| Prefijo | Auth requerida | Descripción |
|---------|---------------|-------------|
| `/api` (auth) | Público / `CurrentUser` | login, logout, refresh, /me, change-password |
| `/api/contacts` | `CurrentUser` | CRUD contactos + upsert + filtros paginados |
| `/api/empresas` | `CurrentUser` | CRUD empresas + relaciones M2M |
| `/api/campaigns` | `CurrentUser` | Gestión de campañas |
| `/api/csv/contacts` | `CurrentUser` | Import/export contactos (preview + commit) |
| `/api/csv/empresas` | `CurrentUser` | Import/export empresas (preview + commit) |
| `/api/enrichment` | `CurrentUser` | Ingesta de datos enriquecidos por entidad |
| `/api/master-data` | `AdminUser` | Sectores, verticales, productos, cargos, categorías |
| `/api/users` | `AdminUser` | Gestión de usuarios y roles |
| `/api/access-requests` | Mixto | Flujo de solicitud y aprobación de acceso |
| `/api/logs` | `AdminUser` | Auditoría + cleanup periódico |
| `/api/system` | `AdminUser` | Configuración interna, claves API, webhooks |
| `/api/activity` | `AdminUser` | Historial de integraciones y auditoría |
| `/api/affino-accounts` | `CurrentUser` | Cuentas Affino |
| `/health` | Público | Health check |

---

## Pipeline de importación

**Fuente:** `app/core/importer/`

El pipeline es el componente más complejo del sistema. Se ejecuta en dos modos:
`preview` (no escribe nada en BD, devuelve análisis) y `commit` (persiste con savepoints por fila).

### Componentes del pipeline

| Módulo | Responsabilidad |
|--------|----------------|
| `coordinator.py` | Orquestador principal. Gestiona el flujo completo: consolidación → validación → resolución → persistencia. |
| `schema.py` | Tipos de datos del pipeline: `RowResult`, `IngestionSummary`, `PipelineResult`, `IngestionError`. |
| `validator.py` | `BusinessInterrogator` — valida reglas de negocio antes de persistir (MISSING_IDENTITY, INVALID_NAME, etc.). |
| `resolver.py` | `CanonicalResolver` — mapea nombres de columnas del CSV a los nombres canónicos internos. |
| `sanitizer.py` | `StatelessSanitizer` — limpieza de valores (strip, lowercase, normalización de URLs, etc.). |
| `cache.py` | `IdentityCache` — precarga entidades de BD para evitar N+1 queries durante la importación. |
| `registry.py` | `EMPRESA_REGISTRY` / `CONTACT_REGISTRY` — mapas de columnas válidas por tipo de importación. |

### Flujo de una importación

```
CSV/XLSX recibido
      │
      ▼
1. Resolución de columnas (CanonicalResolver)
      │
      ▼
2. Consolidación de filas duplicadas (_consolidate_rows)
   └── Agrupa por CIF > Web > Nombre
   └── Campos M2M acumulan (merge de sets)
   └── Resto de campos: primer valor no vacío gana
      │
      ▼
3. Por cada fila → SAVEPOINT
   ├── Validación (BusinessInterrogator)
   ├── Resolución de empresa (empresa_service)
   ├── Resolución de cargo + categoría (cargo_service)
   ├── Upsert no destructivo
   └── Commit / rollback del savepoint según resultado
      │
      ▼
4. Política de commit global
   ├── mode=preview   → sin commit (siempre)
   ├── mode=commit + success > 0  → session.commit()
   └── mode=commit + success = 0  → session.rollback()
      │
      ▼
5. PipelineResult con IngestionSummary + RowResult por fila
```

Para el detalle de las reglas de resolución y validación, ver `business-rules.md`.

---

## Enriquecimiento

**Fuente:** `app/services/enrichment_service.py`, `app/core/enrichment/rules.py`

El enriquecimiento es un upsert no destructivo especializado: recibe datos externos (de herramientas
o integraciones) y los aplica sobre entidades existentes sin sobreescribir campos protegidos.

**Campos protegidos** (`ENRICHMENT_PROTECTED_FIELDS`): `web`, `email`, `phone`.
Si un valor nuevo llega para uno de estos campos y el campo ya tiene valor, se escribe en
`notes[source]["_enrichment_{field}"]` en lugar de sobreescribir.

Cada ejecución queda trazada en `enrichment_logs` con `run_id` (UUID), `tool`, `status`,
`metrics` (JSONB) y `error_log`.

---

## Gestión del esquema (Alembic)

- `main.py` no llama a `create_all()`. **Alembic es la única fuente de verdad del esquema.**
- Todas las versiones activas viven en `alembic/versions/`.
- `alembic/versions_backup/` contiene el histórico pre-rebase (referencia, no se ejecuta).

```bash
# Crear nueva migración
alembic revision --autogenerate -m "descripción"
alembic upgrade head

# Ver estado actual
alembic current
alembic history
```

---

## Seguridad

- `.env` **no debe commitearse** — cubierto por `.gitignore`. Usar `.env.example` como plantilla.
- `JWT_SECRET_KEY` y `SESSION_SECRET_KEY` deben ser distintas, aleatorias y de ≥ 64 bytes en producción.
- Cabeceras de seguridad activas en todas las respuestas: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. `HSTS` solo si `DEBUG=false`.
- Upload CSV/XLSX: límite de 10 MB (`csv_service.MAX_UPLOAD_BYTES`).
- El admin de bootstrap (`scripts/create_admin.py`) crea `administrador@gmail.com / abc123.` — cambiar inmediatamente tras el primer login.

---

## Despliegue

Script de referencia: `scripts/deploy.sh` — git pull + `alembic upgrade head` + `npm run build` + restart de `crm-backend` y `nginx` vía `systemctl`. Ajustar rutas y nombres de servicio según el entorno.

Endpoints de referencia en desarrollo:

| Servicio | URL |
|---------|-----|
| Backend (API) | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |
| Frontend | http://localhost:5173 |

---

## Decisiones arquitectónicas

Las decisiones de diseño concretas (con contexto y alternativas descartadas) se documentan en `decisions.md`.

Resumen de las más relevantes:

| Decisión | Motivación |
|----------|-----------|
| Savepoint por fila en importación | Evita que un error en una fila rompa una importación de 1000 registros. Las filas exitosas se persisten aunque otras fallen. |
| Alembic exclusivo para esquema (sin `create_all`) | Garantiza que desarrollo y producción usan exactamente el mismo esquema. Sin sorpresas en despliegues. |
| Campos M2M (sectores, verticales, productos) en Empresa, no en Contact | Los sectores/verticales son atributos de la empresa, no del individuo. Los contactos los heredan vía propiedad delegada. |
| `CategoriaCargo` en BD (no hardcodeada) | Permite gestión desde UI sin tocar código ni redeployar. n8n las lee vía API. |
| Upsert no destructivo como principio global | Permite importar el mismo CSV varias veces de forma segura. Cada ejecución solo añade o actualiza, nunca elimina ni blanquea. |
| `notes` como JSONB con deep-merge | Permite que múltiples fuentes (enriquecimiento, importaciones, UI) escriban datos sin pisarse. |
| Tres métodos de autenticación | JWT para el SPA, API Key para n8n/integraciones, session cookie como fallback. Sin duplicar middleware. |
