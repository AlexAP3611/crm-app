# Referencia de Integración (API REST)

La API del CRM está construida con FastAPI. Todos los endpoints que mutan o leen datos sensibles requieren autenticación.

## URL Base y Documentación Interactiva

Si estás ejecutando el proyecto en local:
- **API Base:** `http://localhost:8000/api`
- **Swagger UI:** `http://localhost:8000/docs` (Útil para probar endpoints en vivo)
- **ReDoc:** `http://localhost:8000/redoc`

## Métodos de Autenticación

El CRM soporta dos formas principales de autenticar peticiones HTTP, dependiendo de si eres un usuario interactivo o una máquina (ej. n8n).

### 1. API Key (Recomendado para integraciones)
Se envían usando el header personalizado `X-API-Key`.
```http
GET /api/contacts HTTP/1.1
X-API-Key: crm_live_xyz123...
```
*¿Cómo conseguirla?* Un administrador debe crear una "Service Account" desde la sección `Sistema` en el frontend, lo cual generará un token único.

### 2. JWT (JSON Web Token)
Usado por el Frontend (SPA). Se envía mediante el header estándar `Authorization`.
```http
GET /api/contacts HTTP/1.1
Authorization: Bearer eyJhbGci...
```
Se obtiene haciendo un POST a `/api/login` con credenciales (usuario y contraseña).

## Estándar de Respuesta (Paginación)

Casi todos los endpoints que devuelven listas (como `GET /api/empresas` o `GET /api/contacts`) utilizan un estándar de paginación e incluyen metadata en la respuesta.

**Ejemplo de respuesta paginada:**
```json
{
  "data": [
    {
      "id": 1,
      "nombre": "Tech Corp",
      "cif": "B12345678"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "size": 50,
    "pages": 3
  }
}
```

Parámetros query comunes en estos endpoints:
- `page` (default: 1)
- `size` (default: 50, max: 100)
- `search` (búsqueda fuzzy por nombre/email)

## Endpoints Principales

Aquí hay un resumen de los módulos clave. Para la lista exhaustiva y esquemas JSON exactos, consulta `/docs` (Swagger).

### Contactos (`/api/contacts`)
- `GET /` - Listar contactos (paginado). Permite filtrar por `empresa_id`, `cargo`, `categoria`, etc.
- `POST /` - Crear un contacto manualmente.
- `GET /{id}` - Detalles de un contacto.
- `PATCH /{id}` - Actualizar un contacto (aplica actualización no destructiva por defecto a menos que se fuerce lo contrario).

### Empresas (`/api/empresas`)
- `GET /` - Listar empresas (paginado).
- `POST /` - Crear empresa.
- `GET /{id}` - Detalles de la empresa, incluyendo sus relaciones M2M (sectores, verticales).

### Enriquecimiento (`/api/enrichment`)
Endpoint especial diseñado para recibir webhooks o llamadas automatizadas de herramientas como Apollo, Lusha, etc.
- `POST /ingest` - Recibe un payload JSON flexible. Aplica la lógica de `deep_merge` sobre la columna `notes` para no pisar datos valiosos existentes (email, web, teléfono).

### Master Data (`/api/master-data`)
Solo accesible por roles `admin`. Se usa para gestionar los diccionarios del sistema.
- `/sectores`, `/verticales`, `/productos`, `/cargos`, `/categorias`

## Manejo de Errores

La API utiliza los códigos HTTP estándar:
- **400 Bad Request:** Payload malformado o regla de negocio violada (ej. intentar crear un contacto sin email ni linkedin).
- **401 Unauthorized:** Token o API Key inválida/ausente.
- **403 Forbidden:** Tienes un token válido, pero tu rol (ej. `gestor`) no tiene permisos para esa acción (requiere `admin`).
- **404 Not Found:** La entidad solicitada (ID) no existe.
- **429 Too Many Requests:** Has superado el límite de llamadas del *Rate Limiter* (slowapi).
- **500 Internal Server Error:** Excepción no controlada en el backend.

Todas las respuestas de error siguen el esquema Pydantic estándar:
```json
{
  "detail": "El email contact@ejemplo.com ya existe."
}
```
