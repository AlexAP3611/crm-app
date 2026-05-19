# Guía de Importaciones y ETL

Documentación técnica del motor de importaciones CSV/Excel del CRM. Describe el comportamiento completo del pipeline, los campos soportados, las reglas de resolución y los códigos de error.

---

## Modos de ejecución: Preview vs Commit

El endpoint de importación acepta un parámetro `commit` (por defecto `false`).

### Preview (`commit=false`)

Ejecución en seco. El sistema procesa el archivo completo aplicando todas las validaciones, normalizaciones y resoluciones contra la base de datos usando cachés, pero **no escribe nada**. Devuelve un reporte completo con exactamente lo que ocurriría si se importase.

### Commit (`commit=true`)

Importación real. Repite el proceso de validación por seguridad y ejecuta las escrituras usando un **savepoint por fila** (`session.begin_nested()`). Si una fila falla, solo se revierte esa fila; las anteriores exitosas permanecen pendientes en la transacción padre.

**Política de commit global:**

| Condición | Acción |
|-----------|--------|
| `mode=commit` y al menos 1 fila exitosa | `session.commit()` — se persisten todas las filas exitosas |
| `mode=commit` y 0 filas exitosas | `session.rollback()` — se revierte todo |
| `mode=preview` | No se ejecuta commit ni rollback |

---

## Campos soportados para importar Empresas

### Mapeo de columnas (aliases)

El sistema acepta múltiples nombres de columna para cada campo. La resolución es case-insensitive.

| Campo canónico | Aliases aceptados |
|----------------|-------------------|
| `nombre` | `empresa_nombre`, `nombre`, `empresa`, `company`, `Nombre empresa`, `name` |
| `web` | `empresa_web`, `web`, `website`, `url`, `site`, `Web Empresa` |
| `email` | `empresa_email`, `email`, `correo`, `mail`, `Email empresa` |
| `phone` | `empresa_phone`, `phone`, `telefono`, `tel`, `mobile`, `Telefono empresa` |
| `cif` | `empresa_cif`, `cif`, `vat`, `vat_number`, `CIF empresa` |
| `numero_empleados` | `numero_empleados`, `employees`, `size`, `empleados`, `num_empleados`, `Numero empleados` |
| `facturacion` | `facturacion`, `revenue`, `turnover`, `ventas` |
| `cnae` | `cnae`, `industry_code`, `actividad` |
| `facebook` | `facebook`, `fb_url`, `facebook_url`, `Facebook empresa` |
| `pais` | `pais`, `país`, `country`, `nation`, `Pais empresa` |
| `provincia` | `provincia`, `province`, `state`, `región`, `region`, `comunidad`, `Provincia empresa` |
| `web_competidor_1` | `web_competidor_1`, `competidor_1`, `competitor_1`, `competidor 1`, `Web competidor 1` |
| `web_competidor_2` | `web_competidor_2`, `competidor_2`, `competitor_2`, `competidor 2`, `Web competidor 2` |
| `web_competidor_3` | `web_competidor_3`, `competidor_3`, `competitor_3`, `competidor 3`, `Web competidor 3` |
| `facebook_competidor_1` | `Facebook competidor 1`, `Competidor 1 Facebook`, `Competitor 1 Facebook` |
| `facebook_competidor_2` | `Facebook competidor 2`, `Competidor 2 Facebook`, `Competitor 2 Facebook` |
| `facebook_competidor_3` | `Facebook competidor 3`, `Competidor 3 Facebook`, `Competitor 3 Facebook` |
| `sector_name` | `sector`, `industria`, `industry`, `sectores`, `Sector` |
| `vertical_name` | `vertical`, `subsector`, `verticales`, `Vertical` |
| `product_name` | `producto`, `product`, `servicio`, `productos`, `Producto` |

### Normalización aplicada por campo

- **`nombre`:** `.strip()` + Title Case (`normalize_company_name`). Múltiples espacios internos se colapsan a uno.
- **`web`:** Se elimina el protocolo (`https://`, `http://`) y el prefijo `www.`. Se convierte a lowercase. El resultado es `dominio.com/path`. Los subdominios distintos de `www.` se preservan (ej. `app.empresa.com` no se convierte en `empresa.com`).
- **`cif`:** Solo `.strip()` de espacios.
- **`email`, `phone`, `cnae`, `facebook`:** `.strip()` de espacios.
- **`numero_empleados`, `facturacion`:** Se convierten a entero/float. Los valores no numéricos se descartan.
- **`pais`, `provincia`:** Se buscan por nombre en la base de datos (case-insensitive). Si no se encuentran, se genera un warning no bloqueante (ver sección de códigos).
- **`web_competidor_*`:** Se aplica `normalize_web` igual que en el campo `web` principal.

### Comportamiento de País y Provincia en la importación

El sistema realiza una búsqueda estricta (lookup-only) en las tablas `paises` y `provincias`. **No crea registros nuevos** si el valor no existe.

- Si el país no se encuentra → warning `PAIS_NOT_FOUND`. La empresa se importa con `pais_id = NULL`.
- Si la provincia no se encuentra → warning `PROVINCIA_NOT_FOUND`. La empresa se importa con `provincia_id = NULL`.
- Si viene provincia pero el país no se pudo resolver → warning `PROVINCIA_NO_PAIS`. La provincia también queda NULL porque sin país válido no tiene sentido resolverla.
- Si el CSV no incluye columnas de país/provincia → sin warning, ambos campos quedan NULL.

Los warnings de ubicación son **no bloqueantes**: la empresa se importa correctamente sin esos campos. Aparecen diferenciados visualmente (amarillo/naranja) en el previsualizador respecto a los errores bloqueantes (rojo).

En el resumen del previsualizador se muestran contadores específicos:
- "X empresa(s) se importarán sin país por no encontrar coincidencia"
- "Y empresa(s) se importarán sin provincia por no encontrar coincidencia"

### Comportamiento de Competidores en la importación

Los campos `web_competidor_1/2/3` y `facebook_competidor_1/2/3` se extraen del CSV antes de construir el payload de `EmpresaCreate`, se agrupan en un array de hasta 3 competidores por posición, y se sincronizan en la tabla `competidores`.

**Distinción crítica para upserts:**
- Si el CSV no contiene ninguna columna de competidores → `competidores = None` → los competidores existentes en la BD se **preservan**.
- Si el CSV contiene columnas de competidores con valores vacíos → `competidores = []` → los competidores existentes se **preservan**.
- Si el CSV contiene columnas con valores → los competidores existentes se reemplazan con los nuevos.

---

## Campos soportados para importar Contactos

### Mapeo de columnas (aliases)

| Campo canónico | Aliases aceptados |
|----------------|-------------------|
| `first_name` | `nombre`, `contact_name`, `first_name`, `full_name`, `nombre completo`, `contacto`, `Nombre` |
| `last_name` | `apellido`, `last_name`, `surname`, `apellidos`, `Apellidos` |
| `email` | `email`, `correo`, `mail`, `email_address`, `correo electrónico`, `Email` |
| `phone` | `phone`, `telefono`, `tel`, `mobile`, `celular`, `teléfono`, `Telefono` |
| `linkedin` | `linkedin`, `linkedin_url`, `perfil linkedin`, `li_url`, `LinkedIn` |
| `job_title` | `cargo`, `job_title`, `puesto`, `position`, `rol`, `Cargo` |
| `empresa_nombre` | `empresa`, `company`, `empresa_nombre`, `nombre empresa`, `Nombre empresa` |
| `campaña` | `campaña`, `campaign`, `campana`, `origen`, `campañas`, `Campaña` |

### Normalización aplicada por campo

- **`first_name`, `last_name`:** `.strip()` + Title Case.
- **`email`:** Lowercase + `.strip()`.
- **`phone`:** Se conservan solo dígitos y el `+` inicial.
- **`linkedin`:** Se normaliza eliminando protocolo, queries y parámetros (`normalize_linkedin`). El resultado es `linkedin.com/in/handle`.
- **`job_title`:** Lowercase, eliminación de puntos, colapso de espacios + expansión de alias (ver tabla de alias en `business-rules.md`).

### Identidad de contactos

Cada contacto necesita al menos uno de los tres campos de identidad: **Email**, **Teléfono** o **LinkedIn**. Sin ninguno, la fila es rechazada con `MISSING_IDENTITY`.

La resolución de identidad sigue este orden al buscar si el contacto ya existe:

1. **Email** — coincidencia exacta case-insensitive.
2. **LinkedIn** — coincidencia sobre el valor normalizado (`linkedin_normalized`).
3. **Teléfono** — solo resuelve si devuelve exactamente 1 resultado. Si hay 2+ contactos con el mismo teléfono, se crea un contacto nuevo.

---

## Consolidación de filas duplicadas

Ocurre **en memoria, antes de cualquier escritura**. Si el archivo contiene dos filas que representan la misma entidad, se fusionan en una única fila maestra.

**Identidad para consolidación de empresas:** CIF > Web > Nombre (igual que la resolución en BD).

**Reglas de fusión:**
- Campos `sector_name`, `vertical_name`, `product_name`: se **acumulan** (merge de sets). Si la fila 1 tiene "Software" y la fila 2 tiene "Hardware", el resultado es `["Software", "Hardware"]`.
- Resto de campos: gana el **primer valor no vacío**. Si la fila 1 tiene el campo vacío y la fila 2 tiene un valor, gana el de la fila 2.

Las filas fusionadas aparecen en el reporte con `action: "merged"` y el warning `ROW_CONSOLIDATED`.

---

## Códigos de validación y severidad

| Código | Severidad | Efecto | Descripción |
|--------|-----------|--------|-------------|
| `MISSING_IDENTITY` | `CRITICAL` | **Bloquea** la fila | La fila no tiene ningún campo de identidad (empresa sin CIF/web/nombre, o contacto sin email/linkedin/teléfono). |
| `INVALID_NAME` | `BLOCKER` | **Bloquea** la fila | El nombre de empresa tiene menos de 2 caracteres. |
| `INVALID_CIF_FORMAT` | `WARNING` | La fila continúa | El CIF tiene menos de 5 caracteres. Se avisa pero no bloquea. |
| `PAIS_NOT_FOUND` | `WARNING` | La fila continúa sin `pais_id` | El nombre de país no coincide con ningún registro en la tabla `paises`. La empresa se importa sin país. |
| `PROVINCIA_NOT_FOUND` | `WARNING` | La fila continúa sin `provincia_id` | El nombre de provincia no coincide para el país resuelto. La empresa se importa sin provincia. |
| `PROVINCIA_NO_PAIS` | `WARNING` | La fila continúa sin `provincia_id` | Se indicó provincia pero el país no se pudo resolver (no estaba en el CSV o no se encontró en BD). |
| `EXISTING_ENTITY` | `INFO` | La fila continúa; acción será `updated` | La entidad ya existe en BD. Informativo. |
| `AUTO_EMPRESA` | `INFO` | Solo en preview | Se detecta que se crearía una empresa nueva al importar un contacto. |
| `AUTO_CARGO` | `INFO` | Solo en preview | Se detecta un cargo nuevo que no existe en BD y se crearía. |
| `AUTO_CAMPAIGN` | `INFO` | Solo en preview | Se detecta una campaña nueva que no existe en BD y se crearía. |
| `ROW_CONSOLIDATED` | `INFO` | La fila se marca como `merged` | La fila fue fusionada con otra fila anterior dentro del mismo archivo. |

Los errores con severidad `BLOCKER` o `CRITICAL` hacen que el resultado de la fila sea `status="error"` y que no llegue a la capa de persistencia. Los demás se acumulan en la lista `warnings` del resultado y se muestran al usuario en el previsualizador.

---

## Savepoints por fila

En modo `commit`, cada fila se procesa dentro de un savepoint de base de datos:

```python
async with self.session.begin_nested():
    result = await self._process_row_logic(...)
    if result.status == "success":
        await self.session.flush()
```

El uso de `begin_nested()` (equivalente a `SAVEPOINT` en PostgreSQL) garantiza aislamiento a nivel de fila. Si una fila lanza una excepción, solo el trabajo de esa fila se revierte. El error se registra en `IngestionSummary.failed` y la importación continúa con la siguiente fila.

Esto permite que una importación con 95 filas correctas y 5 erróneas persista las 95 sin necesidad de reintentar el archivo completo.

---

## Contrato CSV v1

El contrato de exportación garantiza round-trip: los archivos exportados pueden reimportarse sin pérdida de datos.

**Reglas clave del contrato:**

- **Strings vacíos:** Se tratan como "preservar". No sobrescriben datos existentes en BD.
- **Valores placeholder inválidos para nombre de empresa:** `N/A`, `Unknown`, `Desconocido`, `-`, `.` — se rechazan y bloquean la fila.
- **Relaciones M2M (sectores, verticales, productos, campañas):** Estrategia merge-append. Las relaciones existentes se conservan y las nuevas se añaden. Los IDs duplicados se ignoran.
- **Campos de país/provincia en exportación:** Se exportan como nombres legibles (ej. "España", "Pontevedra"), no como IDs internos. Esto garantiza que un CSV exportado puede reimportarse y los campos se resolverán correctamente.
- **Competidores en exportación:** Se exportan como columnas planas `web_competidor_1`, `web_competidor_2`, `web_competidor_3`, `facebook_competidor_1`, etc. Compatible con el formato de importación.

---

## Caché y rendimiento

Para evitar N+1 queries durante el procesamiento de filas, el pipeline precarga en memoria al inicio de cada importación:

- **Empresas:** Precarga por CIF, web y nombre los registros que coincidan con las identidades del CSV.
- **Países:** Precarga todos los valores únicos de `pais` presentes en el CSV en una única query `WHERE IN`.
- **Provincias:** Precarga por grupos de (país, nombres de provincia) en queries separadas por país.
- **Cargos:** Precarga todos los cargos presentes en el CSV.
- **Campañas:** Precarga todas las campañas presentes en el CSV.

Los cache misses se almacenan como `None` para que las filas repetidas con el mismo valor inválido no generen queries adicionales. El warning se re-emite para cada fila afectada, independientemente de si el valor estaba ya cacheado como miss.

---

## Límites

- Tamaño máximo de archivo: **10 MB** (configurable en `csv_service.MAX_UPLOAD_BYTES`).
- Para archivos muy grandes (>3.000 filas), se recomienda partir en bloques para evitar timeouts.
