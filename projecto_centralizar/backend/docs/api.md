# Referencia de Integración (API REST)

La API del CRM está construida con FastAPI. Todos los endpoints que mutan o leen datos sensibles requieren autenticación.

## URL Base y Documentación Interactiva

- **API Base:** `http://localhost:8000/api` (desarrollo) / `https://tu-dominio.com/api` (producción)
- **Swagger UI:** `http://localhost:8000/docs` — explorador interactivo con esquemas JSON exactos
- **ReDoc:** `http://localhost:8000/redoc`

---

## Métodos de Autenticación

### 1. API Key (Recomendado para integraciones)

Se envía en el header `X-API-Key`. Es el método recomendado para N8N y otras integraciones automatizadas.

```http
GET /api/contacts HTTP/1.1
X-API-Key: crm_live_xyz123...
```

Un administrador debe generar la API Key desde **Sistema → API Key** y asociarla a un Service Account (`POST /api/system/api-key/service-account/{user_id}`). Sin el Service Account configurado, las peticiones con API Key serán rechazadas.

### 2. JWT Bearer (Usado por el frontend)

```http
GET /api/contacts HTTP/1.1
Authorization: Bearer eyJhbGci...
```

Se obtiene haciendo `POST /api/login` con `email` y `password`. El token expira en 60 minutos. Usa `POST /api/refresh` para renovarlo mientras siga activo.

### 3. Session Cookie (Fallback)

Cookie `crm_session` firmada. Se usa como fallback de compatibilidad. `HttpOnly`, `SameSite=Lax`.

---

## Roles y permisos

| Rol | Acceso |
|-----|--------|
| `admin` | Acceso completo. Gestión de usuarios, segmentación, configuración del sistema, logs. |
| `gestor` | Acceso operativo: contactos, empresas, segmentación, campañas, importaciones. No puede acceder a configuración ni usuarios. |

En los endpoints se aplica mediante dependencias FastAPI: `CurrentUser` (cualquier autenticado) y `AdminUser` (solo `admin`).

---

## Estándar de respuesta (paginación)

Los endpoints de listado devuelven respuestas paginadas:

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "page_size": 50
  }
}
```

Parámetros query comunes:
- `page` (default: 1)
- `page_size` (default: 50, máx: 200)

---

## Endpoints por módulo

### Autenticación

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/login` | Público | Login con email/password. Devuelve `access_token`. Rate limit: 10/min. |
| `POST` | `/api/logout` | `CurrentUser` | Invalida la sesión activa. |
| `POST` | `/api/refresh` | `CurrentUser` | Renueva el JWT mientras esté activo. Rate limit: 30/min. |
| `GET` | `/api/me` | `CurrentUser` | Datos del usuario autenticado. |
| `POST` | `/api/change-password` | `CurrentUser` | Cambia la contraseña. Rate limit: 5/min. |

### Contactos (`/api/contacts`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/contacts` | `CurrentUser` | Listado paginado con filtros. |
| `POST` | `/api/contacts` | `CurrentUser` | Crear o actualizar contacto (upsert por email → linkedin → teléfono). |
| `GET` | `/api/contacts/{id}` | `CurrentUser` | Detalle de un contacto. |
| `PATCH` | `/api/contacts/{id}` | `CurrentUser` | Actualizar un contacto (actualización no destructiva). |
| `DELETE` | `/api/contacts/{id}` | `CurrentUser` | Eliminar un contacto. |
| `POST` | `/api/contacts/bulk-delete` | `CurrentUser` | Eliminar contactos por scope (ids, filtros, o todos). |
| `POST` | `/api/contacts/bulk-update` | `CurrentUser` | Actualizar campo en masa por scope. |
| `POST` | `/api/contacts/export/affino` | `CurrentUser` | Enviar contactos a Affino. Acepta `account_id` para seleccionar cuenta. |

**Parámetros de filtro en `GET /api/contacts`:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `search` | string | Búsqueda por nombre, apellidos o email. |
| `contacto_nombre` | string | Filtra por nombre del contacto. |
| `email` | string | Filtra por email. |
| `empresa_id` | int | Contactos de una empresa específica. |
| `sector_id` | int | Contactos en empresas de ese sector. |
| `vertical_id` | int | Contactos en empresas de esa vertical. |
| `product_id` | int | Contactos en empresas con ese producto. |
| `cargo_id` | int | Contactos con ese cargo específico. |
| `categoria_cargo_id` | int | Contactos cuyo cargo pertenece a esa categoría. |
| `campaign_id` | int | Contactos asignados a esa campaña. |
| `is_enriched` | bool | Filtra por estado de enriquecimiento. |
| `page` | int | Número de página (default: 1). |
| `page_size` | int | Registros por página (default: 50, máx: 200). |

### Empresas (`/api/empresas`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/empresas` | `CurrentUser` | Listado paginado con filtros. |
| `POST` | `/api/empresas` | `CurrentUser` | Crear empresa. |
| `PUT` | `/api/empresas/{id}` | `CurrentUser` | Actualizar empresa. |
| `DELETE` | `/api/empresas/{id}` | `CurrentUser` | Eliminar empresa (solo si no tiene contactos). |
| `GET` | `/api/empresas/{id}/contactos` | `CurrentUser` | Contactos de una empresa. |
| `POST` | `/api/empresas/bulk-delete` | `CurrentUser` | Eliminar empresas por scope. |
| `POST` | `/api/empresas/bulk-update` | `CurrentUser` | Actualizar campo en masa por scope. |
| `POST` | `/api/empresas/enrich` | `CurrentUser` | Enviar empresas al servicio de enriquecimiento. |
| `POST` | `/api/empresas/{id}/sectors/{sector_id}` | `CurrentUser` | Asignar sector a empresa. |
| `DELETE` | `/api/empresas/{id}/sectors/{sector_id}` | `CurrentUser` | Desasignar sector. |
| `POST` | `/api/empresas/{id}/verticals/{vertical_id}` | `CurrentUser` | Asignar vertical. |
| `DELETE` | `/api/empresas/{id}/verticals/{vertical_id}` | `CurrentUser` | Desasignar vertical. |
| `POST` | `/api/empresas/{id}/products/{product_id}` | `CurrentUser` | Asignar producto. |
| `DELETE` | `/api/empresas/{id}/products/{product_id}` | `CurrentUser` | Desasignar producto. |

**Parámetros de filtro en `GET /api/empresas`:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `q` | string | Búsqueda por nombre de empresa. |
| `sector_id` | int | Empresas con ese sector. |
| `vertical_id` | int | Empresas con esa vertical. |
| `product_id` | int | Empresas con ese producto. |
| `pais_id` | int | Empresas de ese país. |
| `provincia_id` | int | Empresas de esa provincia. |
| `cnae` | string | Filtra por código CNAE. |
| `numero_empleados_min` | int | Mínimo de empleados. |
| `numero_empleados_max` | int | Máximo de empleados. |
| `facturacion_min` | float | Facturación mínima. |
| `facturacion_max` | float | Facturación máxima. |
| `page` | int | Número de página (default: 1). |
| `page_size` | int | Registros por página (default: 50, máx: 200). |

**Schema de empresa (crear/actualizar):**

```json
{
  "nombre": "Tech Corp",
  "web": "techcorp.com",
  "email": "info@techcorp.com",
  "phone": "+34600000000",
  "cif": "B12345678",
  "numero_empleados": 50,
  "facturacion": 1000000,
  "cnae": "6201",
  "pais_id": 1,
  "provincia_id": 30,
  "facebook": "https://www.facebook.com/techcorp",
  "competidores": [
    { "posicion": 1, "web": "competidor1.com", "facebook": "https://facebook.com/comp1" },
    { "posicion": 2, "web": "competidor2.com", "facebook": null }
  ],
  "sector_ids": [1, 2],
  "vertical_ids": [3],
  "product_ids": [5]
}
```

> **Nota sobre competidores:** `competidores: null` (o campo ausente) preserva los competidores existentes. `competidores: []` los borra todos. Máximo 3 por empresa.

### Campañas (`/api/campaigns`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/campaigns` | `CurrentUser` | Listar todas las campañas. |
| `POST` | `/api/campaigns` | `CurrentUser` | Crear campaña. |
| `PUT` | `/api/campaigns/{id}` | `CurrentUser` | Actualizar nombre de campaña. |
| `DELETE` | `/api/campaigns/{id}` | `CurrentUser` | Eliminar campaña (solo si no tiene contactos). |

### Importación / Exportación CSV (`/api/csv`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/csv/empresas` | `CurrentUser` | Importar empresas. Body multipart: `file` + `commit` (bool). |
| `GET` | `/api/csv/empresas/export` | `CurrentUser` | Exportar empresas a CSV con filtros activos. |
| `POST` | `/api/csv/contacts` | `CurrentUser` | Importar contactos. Body multipart: `file` + `commit` (bool). |
| `GET` | `/api/csv/contacts/export` | `CurrentUser` | Exportar contactos a CSV con filtros activos. |

**Respuesta de importación (`PipelineResult`):**

```json
{
  "summary": {
    "total": 100,
    "success": 95,
    "failed": 3,
    "skipped": 2,
    "merged": 1,
    "warnings_pais": 5,
    "warnings_provincia": 2
  },
  "results": [
    {
      "row_idx": 0,
      "status": "success",
      "action": "created",
      "entity_name": "Tech Corp",
      "warnings": [],
      "errors": []
    },
    {
      "row_idx": 3,
      "status": "success",
      "action": "updated",
      "entity_name": "Acme SL",
      "warnings": [
        {
          "code": "PAIS_NOT_FOUND",
          "message": "País 'Españaa' no reconocido. El campo país no se actualizará.",
          "field": "pais",
          "value": "Españaa",
          "severity": "WARNING"
        }
      ],
      "errors": []
    }
  ]
}
```

### Enriquecimiento (`/api/enrichment`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/enrichment/ingest` | `CurrentUser` / API Key | Recibe datos enriquecidos de herramientas externas. Aplica deep-merge en `notes`. |
| `POST` | `/api/enrichment/companies` | `CurrentUser` | Dispara el enriquecimiento de empresas por scope. |

El endpoint `/ingest` aplica actualización no destructiva. Los campos `web`, `email` y `phone` están protegidos: si ya tienen valor, el dato nuevo se guarda en `notes[source]["_enrichment_{field}"]` en lugar de sobrescribir.

### Datos Maestros (`/api/master-data`) — Solo admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/master-data/sectors` | Listar sectores. |
| `POST` | `/api/master-data/sectors` | Crear sector. |
| `DELETE` | `/api/master-data/sectors/{id}` | Eliminar sector (solo si no tiene empresas). |
| `GET` | `/api/master-data/verticals` | Listar verticales. |
| `POST` | `/api/master-data/verticals` | Crear vertical. |
| `DELETE` | `/api/master-data/verticals/{id}` | Eliminar vertical. |
| `GET` | `/api/master-data/products` | Listar productos. |
| `POST` | `/api/master-data/products` | Crear producto. |
| `DELETE` | `/api/master-data/products/{id}` | Eliminar producto. |
| `GET` | `/api/master-data/cargos` | Listar cargos con su categoría asignada. |
| `POST` | `/api/master-data/cargos` | Crear cargo. |
| `PATCH` | `/api/master-data/cargos/{id}/categoria` | Asignar o cambiar la categoría de un cargo. |
| `DELETE` | `/api/master-data/cargos/{id}` | Eliminar cargo. |
| `GET` | `/api/master-data/categorias-cargo` | Listar categorías de cargo. |
| `POST` | `/api/master-data/categorias-cargo` | Crear categoría de cargo. |
| `DELETE` | `/api/master-data/categorias-cargo/{id}` | Eliminar categoría (solo si no tiene cargos). |
| `GET` | `/api/master-data/paises` | Listar países (ordenados: España primero, resto alfabético). |
| `POST` | `/api/master-data/paises` | Crear país. |
| `DELETE` | `/api/master-data/paises/{id}` | Eliminar país (solo si no tiene empresas ni provincias). |
| `GET` | `/api/master-data/provincias` | Listar provincias. Acepta `?pais_id=X` para filtrar. |
| `POST` | `/api/master-data/provincias` | Crear provincia. Requiere `pais_id`. |
| `DELETE` | `/api/master-data/provincias/{id}` | Eliminar provincia (solo si no tiene empresas). |

### Cuentas Affino (`/api/affino-accounts`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/affino-accounts` | `CurrentUser` | Listar todas las cuentas Affino configuradas. |
| `POST` | `/api/affino-accounts` | `CurrentUser` | Crear nueva cuenta Affino. |
| `PUT` | `/api/affino-accounts/{id}` | `CurrentUser` | Editar nombre o X-User-ID de una cuenta. |
| `DELETE` | `/api/affino-accounts/{id}` | `CurrentUser` | Eliminar cuenta Affino. |

**Schema de cuenta Affino:**

```json
{
  "nombre": "Cuenta de Juan",
  "x_user_id": "abc123xyz"
}
```

El endpoint `POST /api/contacts/export/affino` acepta el campo `account_id` para indicar qué cuenta usar. Si no se pasa `account_id`, se usa la configuración legacy de `settings` como fallback:

```json
{
  "tool_key": "Affino",
  "account_id": 2,
  "ids": [1, 2, 3]
}
```

### Usuarios (`/api/users`) — Solo admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/users` | Listar usuarios. |
| `POST` | `/api/users` | Crear usuario directamente (sin flujo de solicitud). |
| `PUT` | `/api/users/{id}` | Actualizar datos o rol de un usuario. |
| `PATCH` | `/api/users/{id}/activate` | Activar o desactivar un usuario. |
| `DELETE` | `/api/users/{id}` | Eliminar usuario. |

### Solicitudes de acceso (`/api/access-requests`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/request-access` | Público | Enviar solicitud de acceso. Rate limit: 3/min. |
| `GET` | `/api/access-requests` | Admin | Listar solicitudes pendientes/procesadas. |
| `POST` | `/api/access-requests/{id}/approve` | Admin | Aprobar solicitud y crear usuario. |
| `POST` | `/api/access-requests/{id}/reject` | Admin | Rechazar solicitud. |

### Sistema (`/api/system`) — Solo admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/system/settings` | Obtener configuración del sistema. |
| `POST` | `/api/system/settings/{key}` | Actualizar una clave de configuración. |
| `POST` | `/api/system/api-key/generate` | Generar una nueva API Key. |
| `POST` | `/api/system/api-key/service-account/{user_id}` | Asociar la API Key a un usuario. |

### Actividad y Logs (`/api/activity`, `/api/logs`) — Solo admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/activity/integrations` | Historial de ejecuciones de integraciones (enriquecimiento, Affino). |
| `GET` | `/api/activity/audit` | Registros de auditoría de acciones de usuarios. |
| `DELETE` | `/api/activity/integrations/cleanup` | Limpiar registros de integración antiguos. Acepta `?days=90`. |
| `GET` | `/api/logs` | Logs de auditoría detallados. Acepta `?user_id=X` para filtrar. |
| `DELETE` | `/api/logs/cleanup` | Limpiar logs según retención. Acepta `?days=90` (mín: 30, máx: 365). |

---

## Scopes para acciones en masa

Los endpoints de bulk-delete, bulk-update y export/affino usan un sistema de scope para definir sobre qué registros actuar:

```json
{ "ids": [1, 2, 3] }
```
```json
{ "filters": { "sector_id": 5, "pais_id": 1 } }
```
```json
{ "all": true }
```

Solo uno de los tres campos debe estar presente. El scope vacío es rechazado con error 400.

---

## Manejo de errores

| Código HTTP | Significado | Causa típica |
|-------------|-------------|--------------|
| `400 Bad Request` | Payload inválido o regla de negocio violada | Contacto sin email ni linkedin, empresa con nombre inválido, más de 3 competidores |
| `401 Unauthorized` | Token o API Key inválida/ausente | Token expirado, API Key incorrecta, Service Account no configurado |
| `403 Forbidden` | Token válido pero sin permisos | Usuario con rol `gestor` intentando acceder a endpoints de admin |
| `404 Not Found` | Entidad no encontrada | ID que no existe en BD |
| `409 Conflict` | Conflicto de integridad | Nombre de empresa duplicado, campaña duplicada, categoría ya existente |
| `429 Too Many Requests` | Rate limit superado | Demasiadas peticiones en el límite de tiempo |
| `500 Internal Server Error` | Excepción no controlada | Ver logs del servidor |

Todas las respuestas de error siguen el schema estándar de FastAPI:

```json
{
  "detail": "Descripción del error."
}
```

---

## Rate limiting

| Endpoint | Límite |
|----------|--------|
| `POST /api/login` | 10 req/min |
| `POST /api/refresh` | 30 req/min |
| `POST /api/change-password` | 5 req/min |
| `POST /api/request-access` | 3 req/min |

El rate limiting usa `slowapi` con almacenamiento en memoria del proceso. En despliegues con múltiples workers, configurar Redis como backend en `app/core/ratelimit.py`.
