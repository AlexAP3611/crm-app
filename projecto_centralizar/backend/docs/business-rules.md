# Reglas de Negocio del Pipeline de Importación

> **Versión:** 1.2
> **Última actualización:** 2026-05-18
> Documento de referencia técnica para desarrolladores. Describe el comportamiento determinista
> del sistema de resolución e importación de entidades del CRM.
> Cada sección indica el archivo fuente y la función que implementa la lógica descrita.

---

## Sección 1 — Resolución de contactos

**Fuente:** `contact_service.py` → `resolve_contact()` y `upsert_contact()`

### Jerarquía de identidad

La resolución de identidad sigue este orden exacto:

| Prioridad | Campo | Regla de match |
|-----------|-------|----------------|
| 1 | `Email` | Match exacto case-insensitive usando `func.lower`. |
| 2 | `LinkedIn` | Match sobre `linkedin_normalized` (no la URL raw). |
| 3 | `Teléfono` | Match sobre el teléfono normalizado. **Importante:** Solo resuelve si devuelve *exactamente 1 resultado*. Si hay 2+ resultados es ambigüedad y se crea un contacto nuevo en lugar de resolver. |

### Reglas de actualización y merge

- **Actualización no destructiva:** Al actualizar un contacto, si el campo entrante es `None` o un string vacío, **no sobreescribe** el valor existente.
- **Notas (`notes`):** Se realiza un `deep_merge` de diccionarios, no una sobrescritura. Cada fuente de datos (enriquecimiento, importaciones, UI) escribe en su propia clave dentro de `notes` sin pisar las demás.

---

## Sección 2 — Resolución de empresas

**Fuente:** `empresa_service.py` → `resolve_empresa()`

### Jerarquía de identidad

La resolución busca coincidencias en este orden estricto:

| Prioridad | Campo | Regla de match |
|-----------|-------|----------------|
| 0 | `empresa_id` | Match directo por PK. Bypasa todo lo demás. |
| 1 | `CIF` | Match exacto sobre el string limpio (`.strip()`). |
| 2 | `Web` | Match sobre `normalize_web()` (URL normalizada: sin protocolo, sin `www.`, lowercase). |
| 3 | `Nombre` | Match case-insensitive sobre `normalize_company_name()` (Title Case, espacios colapsados). |

> **Nota importante:** El email de empresa **no se usa** para la resolución de identidad.

### Reglas de actualización

Aplica la misma **actualización no destructiva** que en contactos: un campo existente que ya tiene un valor no se sobreescribe con nulos o vacíos.

### Creación automática y race conditions

- Solo se crea una nueva empresa si `auto_create=True` y viene el `empresa_nombre`.
- Si ocurre una *race condition* al insertar (ej. `IntegrityError`), el sistema reintenta un `SELECT` antes de relanzar el error.

### Nombres de empresa inválidos

Los siguientes valores se consideran placeholders inválidos para `nombre` y bloquean la creación:

`N/A`, `Unknown`, `Desconocido`, `-`, `.`

---

## Sección 3 — Resolución de cargos

**Fuente:** `cargo_service.py` → `get_or_create_cargo()`

### Flujo de resolución

1. **Normalización del título raw (`normalize_job_title`):** Se pasa a lowercase, se eliminan los puntos, y se colapsan los espacios múltiples.
2. **Aplicación de ALIAS_MAP:** Se expanden acrónimos a su versión canónica.
3. **Búsqueda en caché:** Se busca en la caché en memoria por sesión.
4. **Búsqueda en BD:** Si no está en caché, se hace un `SELECT` por `normalized_name`.
5. **Creación atómica:** Si no existe, se ejecuta un `INSERT` atómico con `ON CONFLICT DO NOTHING`.
6. **Recuperación por colisión:** Si hay colisión (otra sesión creó el mismo cargo entre el SELECT y el INSERT), se realiza un `SELECT` de recuperación.

### Tabla de ALIAS_MAP

| Alias normalizado | Nombre canónico |
|------------------|-----------------|
| `cmo` / `c m o` / `head of marketing` | `chief marketing officer` |
| `ceo` / `c e o` | `chief executive officer` |
| `cto` / `c t o` | `chief technology officer` |
| `cfo` / `c f o` | `chief financial officer` |
| `vp of engineering` | `vice president of engineering` |

---

## Sección 4 — Resolución de categorías de cargo

**Fuente:** `categoria_cargo_service.py` → `get_or_create()` vía `M2MEntityService`

El proceso es un get-or-create idempotente por nombre normalizado (sin alias).

Existen dos modos principales:
- `get_or_create`: Usado por el pipeline de ingest. Es idempotente y seguro para ejecuciones repetidas.
- `create_strict`: Usado por la UI. Lanza `DuplicateEntityError` si la categoría ya existe, previniendo duplicados explícitos desde Datos Maestros.

### Regla de protección contra sobrescritura por N8N

**Fuente:** `enrichment_ingest_service.py` (línea 38)

Cuando un flujo de N8N enriquece un contacto y envía una sugerencia de categoría para su cargo, el sistema aplica esta regla:

```python
if cargo and contact_in.categoria_cargo and not cargo.categoria_id:
    # Solo asigna si el cargo NO tiene categoría todavía
    cargo.categoria_id = cat.id
```

**Comportamiento:**
- Si el cargo **no tiene categoría asignada** → N8N puede asignarla.
- Si el cargo **ya tiene categoría asignada** → la sugerencia de N8N se ignora silenciosamente.

**Motivación:** Los modelos de IA no son deterministas. En ejecuciones distintas pueden sugerir categorías diferentes para el mismo cargo. Sin esta protección, un flujo automático podría cambiar la categoría de miles de contactos en una sola ejecución, revirtiendo decisiones de segmentación tomadas manualmente por el equipo comercial. Solo un administrador puede cambiar la categoría de un cargo desde la UI de Datos Maestros.

---

## Sección 5 — Resolución de país y provincia en importación

**Fuente:** `coordinator.py` → `_process_row_logic()` (capas 4a y 4b)

A diferencia de cargos o campañas, los campos `pais` y `provincia` usan **lookup estricto sin creación**: si el valor no existe en la base de datos, no se crea un registro nuevo.

### Flujo de resolución de país

1. Si el campo `pais` está ausente o vacío → `pais_id = None`, sin warning.
2. Si está presente, se busca en el caché local por sesión.
   - **Cache hit con valor:** Se usa el ID cacheado.
   - **Cache hit con `None` (miss previo):** `pais_id = None` + warning re-emitido (para que cada fila afectada cuente).
   - **Cache miss:** Se ejecuta `pais_service.get_by_name()`. Si encuentra → cachea el ID. Si no → cachea `None` + warning `PAIS_NOT_FOUND`.

### Flujo de resolución de provincia

Depende del resultado de la resolución de país:

- Si `pais_id` es `None` pero venía un valor de país en el CSV → warning `PROVINCIA_NO_PAIS`, `provincia_id = None`.
- Si `pais_id` es `None` y no venía país → sin warning, `provincia_id = None`.
- Si `pais_id` está resuelto → se busca la provincia por `(nombre, pais_id)` con el mismo patrón de caché que el país. Si no se encuentra → warning `PROVINCIA_NOT_FOUND`.

### Mensajes de warning contextuales

El texto del warning se adapta según si la empresa es nueva o existente:

| Situación | Mensaje |
|-----------|---------|
| Empresa nueva + país no encontrado | "País '{valor}' no reconocido. La empresa se creará sin país asignado." |
| Empresa existente + país no encontrado | "País '{valor}' no reconocido. El campo país no se actualizará." |
| Empresa nueva + provincia no encontrada | "Provincia '{valor}' no encontrada. La empresa se creará sin provincia asignada." |
| Empresa existente + provincia no encontrada | "Provincia '{valor}' no encontrada. El campo provincia no se actualizará." |

**Nota sobre upserts:** Cuando la empresa ya existe en BD y el país no se puede resolver, el `pais_id` existente se **preserva** (no se pone a NULL). El warning informa que el campo "no se actualizará", no que quedará vacío.

---

## Sección 6 — Sincronización de competidores

**Fuente:** `empresa_service.py` → `sync_competidores()`

Los competidores se almacenan en la tabla `competidores` (no como columnas en `empresas`). Cada empresa puede tener hasta 3 competidores, cada uno con `posicion` (1, 2 o 3), `web` y `facebook`.

### Distinción `None` vs `[]`

Esta distinción es crítica para el comportamiento correcto en upserts:

| Valor de `competidores` | Comportamiento |
|-------------------------|----------------|
| `None` | **Preservar.** No se toca la tabla de competidores. Los existentes permanecen. |
| `[]` (lista vacía) | **Borrar.** Se eliminan todos los competidores de la empresa. |
| `[{posicion:1, web:...}]` | **Reemplazar.** Se borran los existentes y se insertan los nuevos. |

Esta distinción permite que una importación CSV que no incluye columnas de competidores no destruya los datos de competidores ya registrados para esas empresas.

**NOTA** Desde la importación CSV nunca llega [] — solo desde la UI. Además la actualización es no destructiva a nivel de campo: si web llega con valor pero facebook llega vacío, el facebook existente se preserva.

---

## Sección 7 — Consolidación de filas duplicadas en importación

**Fuente:** `coordinator.py` → `_consolidate_rows()`

La consolidación ocurre **en memoria, antes de cualquier resolución o escritura contra la base de datos**. El pipeline agrupa las filas del mismo CSV que representan la misma entidad para evitar procesar la misma identidad múltiples veces.

- **Identidad:** Usa la misma jerarquía que la resolución de empresa (`CIF > Web > Nombre`).
- **Campos acumulativos:** Los campos `sector_name`, `vertical_name` y `product_name` se acumulan realizando un merge de sets.
- **Master row:** Para el resto de campos, gana el primer valor que no esté vacío.
- Las filas duplicadas aparecen en el resultado con `action: "merged"` y un warning `ROW_CONSOLIDATED`.

### Ejemplo de consolidación

Si el CSV de entrada tiene estas dos filas:

```csv
cif,empresa_nombre,sector_name,empleados
B123,Tech Corp,Software,
B123,Tech Corp SL,Hardware,50
```

El resultado consolidado en memoria será una única entidad:
- `cif`: B123
- `empresa_nombre`: Tech Corp *(gana la primera fila)*
- `sector_name`: ["Software", "Hardware"] *(se acumulan)*
- `empleados`: 50 *(gana el primer valor no vacío)*

---

## Sección 8 — Reglas de validación: bloqueantes vs. warnings

**Fuente:** `app/core/importer/validator.py` → `BusinessInterrogator` y `coordinator.py` → `_process_row_logic()`

| Código | Severidad | Efecto sobre la fila | Descripción |
|--------|-----------|---------------------|-------------|
| `MISSING_IDENTITY` | `CRITICAL` | **Bloquea** | La fila no tiene ningún identificador válido. |
| `INVALID_NAME` | `BLOCKER` | **Bloquea** | Nombre de empresa con menos de 2 caracteres. |
| `INVALID_CIF_FORMAT` | `WARNING` | Continúa | CIF con menos de 5 caracteres. |
| `PAIS_NOT_FOUND` | `WARNING` | Continúa sin `pais_id` | País no encontrado en BD. |
| `PROVINCIA_NOT_FOUND` | `WARNING` | Continúa sin `provincia_id` | Provincia no encontrada para el país dado. |
| `PROVINCIA_NO_PAIS` | `WARNING` | Continúa sin `provincia_id` | Provincia indicada pero país no resuelto. |
| `EXISTING_ENTITY` | `INFO` | Continúa; acción = `updated` | La entidad ya existe en BD. |
| `AUTO_EMPRESA` | `INFO` | Solo en preview | Se crearía una empresa nueva al importar contactos. |
| `AUTO_CARGO` | `INFO` | Solo en preview | Se detecta un cargo nuevo que se crearía. |
| `AUTO_CAMPAIGN` | `INFO` | Solo en preview | Se detecta una campaña nueva que se crearía. |
| `ROW_CONSOLIDATED` | `INFO` | Acción = `merged` | La fila fue fusionada con otra dentro del mismo archivo. |

---

## Sección 9 — Savepoints por fila

**Fuente:** `coordinator.py` → `PipelineCoordinator.ingest_empresas()` y `ContactCoordinator.ingest_contacts()`

En modo `commit`, cada fila se procesa dentro de un savepoint de base de datos:

```python
async with self.session.begin_nested():
    result = await self._process_row_logic(...)
    if result.status == "success":
        await self.session.flush()
```

El uso de `begin_nested()` (equivalente a `SAVEPOINT` en PostgreSQL) garantiza aislamiento a nivel de fila:

- Si una fila lanza una excepción, solo el trabajo de esa fila se revierte.
- Las filas anteriores procesadas con éxito permanecen pendientes en la transacción padre.
- El error se captura, se registra en `IngestionSummary.failed` y la importación continúa.

**Política de commit global:**

| Condición | Acción final |
|-----------|-------------|
| `mode=commit` y `summary.success > 0` | `session.commit()` — se persisten todas las filas exitosas. |
| `mode=commit` y `summary.success == 0` | `session.rollback()` — ninguna fila tuvo éxito; se revierte todo. |
| `mode=preview` | No se ejecuta commit ni rollback; la sesión nunca escribe datos. |

Este diseño garantiza que una importación parcialmente exitosa (por ejemplo, 95 filas correctas y 5 con errores) persiste las 95 sin necesidad de reintentar el fichero completo.

---

## Sección 10 — Enriquecimiento no destructivo

**Fuente:** `enrichment_service.py`, `core/enrichment/rules.py`

El enriquecimiento es un upsert no destructivo especializado: recibe datos externos (de herramientas o integraciones) y los aplica sobre entidades existentes sin sobrescribir campos protegidos.

**Campos protegidos** (`ENRICHMENT_PROTECTED_FIELDS`): `web`, `email`, `phone`.

Si un valor nuevo llega para uno de estos campos y el campo ya tiene valor, el dato nuevo se escribe en `notes[source]["_enrichment_{field}"]` en lugar de sobrescribir el valor existente. Esto preserva los datos validados manualmente mientras mantiene acceso a los valores sugeridos por el enriquecimiento.

Cada ejecución queda trazada en `enrichment_logs` con `run_id` (UUID), `tool`, `status`, `metrics` (JSONB) y `error_log`.
