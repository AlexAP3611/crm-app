# Reglas de Negocio del Pipeline de Importación

> **Versión:** 1.1  
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
- **Notas (`notes`):** Se realiza un `deep_merge` de diccionarios, no una sobrescritura.

---

## Sección 2 — Resolución de empresas

**Fuente:** `empresa_service.py` → `resolve_empresa()`

### Jerarquía de identidad
La resolución busca coincidencias en este orden estricto:

| Prioridad | Campo | Regla de match |
|-----------|-------|----------------|
| 0 | `empresa_id` | Match directo por PK. Bypasa todo lo demás. |
| 1 | `CIF` | Match exacto sobre el string limpio (`.strip()`). |
| 2 | `Web` | Match sobre `normalize_web()` (URL normalizada). |
| 3 | `Nombre` | Match case-insensitive sobre `normalize_company_name()`. |

> **Nota importante:** El email de empresa **no se usa** para la resolución de identidad.

### Reglas de actualización

Aplica la misma **actualización no destructiva** que en contactos (ver [Sección 1](#sección-1--resolución-de-contactos)): un campo existente que ya tiene un valor no se sobreescribe con nulos o vacíos.

### Creación automática y race conditions

- Solo se crea una nueva empresa si `auto_create=True` y viene el `empresa_nombre`.
- Si ocurre una *race condition* al insertar (ej. `IntegrityError`), el sistema reintenta un `SELECT` antes de relanzar el error.

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

| Alias Normalizado | Nombre Canónico |
|------------------|----------------|
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
- `create_strict`: Usado por la UI. Lanza `DuplicateEntityError` si la categoría ya existe, previniendo duplicados explícitos.

---

## Sección 5 — Consolidación de filas duplicadas en importación

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
El resultado consolidado en memoria, que se usará para consultar la BD, será una única entidad (*master row*):
- `cif`: B123
- `empresa_nombre`: Tech Corp *(gana la primera fila)*
- `sector_name`: ["Software", "Hardware"] *(se acumulan)*
- `empleados`: 50 *(gana el primer valor no vacío)*

---

## Sección 6 — Reglas de validación: bloqueantes vs. warnings

**Fuente:** `app/core/importer/validator.py` → `BusinessInterrogator.validate_empresa()` y lógica de resolución en `PipelineCoordinator._process_row_logic()` / `ContactCoordinator._process_row_logic()`

Los errores y avisos se clasifican por severidad, lo que determina si la fila puede continuar o se descarta:

| Código | Severidad | Efecto sobre la fila | Descripción |
|--------|-----------|---------------------|-------------|
| `MISSING_IDENTITY` | `CRITICAL` | **Bloquea** la fila; aparece en `status="error"` | La fila de empresa no tiene CIF, web ni nombre, o la fila de contacto no tiene email, LinkedIn ni teléfono. La fila no se procesa. |
| `INVALID_NAME` | `BLOCKER` | **Bloquea** la fila | El nombre de empresa tiene menos de 2 caracteres. |
| `INVALID_CIF_FORMAT` | `WARNING` | La fila continúa normalmente | El CIF tiene menos de 5 caracteres. Se avisa pero no se impide la importación. |
| `PAIS_NOT_FOUND` | `WARNING` | La fila continúa sin campo `pais_id` | El nombre de país no se encuentra en la BD. La empresa se crea o actualiza sin país asignado. |
| `PROVINCIA_NOT_FOUND` | `WARNING` | La fila continúa sin campo `provincia_id` | El nombre de provincia no se encuentra para el país dado. La empresa se crea o actualiza sin provincia. |
| `PROVINCIA_NO_PAIS` | `WARNING` | La fila continúa sin campo `provincia_id` | Se indicó provincia pero el país no se pudo resolver (ausente en el CSV o no encontrado en BD). |
| `EXISTING_ENTITY` | `INFO` | La fila continúa; acción será `updated` | La empresa ya existe en BD. Informativo, no bloquea. |
| `AUTO_EMPRESA` | `INFO` | Solo en preview; en commit se crea | Se detecta que se crearía una empresa nueva al importar contactos. |
| `AUTO_CARGO` | `INFO` | Solo en preview | Se detecta un cargo que no existe en BD y se crearía. |
| `AUTO_CAMPAIGN` | `INFO` | Solo en preview | Se detecta una campaña que no existe en BD y se crearía. |
| `ROW_CONSOLIDATED` | `INFO` | La fila se marca como `merged` | La fila fue fusionada con otra anterior dentro del mismo fichero. |

Los errores con severidad `BLOCKER` o `CRITICAL` hacen que el resultado de la fila sea `status="error"` y que la fila no llegue a la capa de persistencia. Los demás se acumulan en la lista `warnings` del resultado y se devuelven al frontend para su visualización.

---

## Sección 7 — Savepoints por fila

**Fuente:** `app/core/importer/coordinator.py` → `PipelineCoordinator.ingest_empresas()` y `ContactCoordinator.ingest_contacts()`

En modo `commit`, cada fila se procesa dentro de un savepoint de base de datos:

```python
async with self.session.begin_nested():
    result = await self._process_row_logic(...)
    if result.status == "success":
        await self.session.flush()
```

El uso de `begin_nested()` (equivalente a `SAVEPOINT` en PostgreSQL) garantiza aislamiento a nivel de fila:

- Si una fila lanza una excepción (de cualquier tipo), solo el trabajo de esa fila se revierte. Las filas anteriores procesadas con éxito permanecen pendientes en la transacción padre.
- El error se captura, se registra en `IngestionSummary.failed` y la importación continúa con la siguiente fila.
- Si `self.mode == "commit"` y `summary.expunge_all()` se llama tras excepciones no esperadas para liberar el estado de la sesión sin afectar el savepoint ya cerrado.

Al finalizar el procesamiento de todas las filas, se aplica la política de commit global:

| Condición | Acción final |
|-----------|-------------|
| `mode == "commit"` y `summary.success > 0` | `session.commit()` — se persisten todas las filas exitosas. |
| `mode == "commit"` y `summary.success == 0` | `session.rollback()` — ninguna fila tuvo éxito; se revierte todo. |
| `mode == "preview"` | No se ejecuta commit ni rollback; la sesión nunca escribe datos. |

Este diseño garantiza que una importación parcialmente exitosa (por ejemplo, 95 filas correctas y 5 con errores) persiste las 95 sin necesidad de reintentar el fichero completo.
