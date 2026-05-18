# Guía de Importaciones y ETL

Esta guía documenta técnicamente cómo funciona el motor de importaciones (CSVs y Excel) de nuestro CRM. Es el componente más complejo del backend y está diseñado para ingerir miles de filas aplicando reglas de negocio complejas sin bloquearse.

## Modos de Ejecución: Preview vs Commit

El endpoint de importación (`POST /api/csv/empresas` o `/api/csv/contacts`) acepta un parámetro booleano `commit` (por defecto `false`).

### 1. Preview Mode (`commit=false`)
- Es una "ejecución en seco" (dry run).
- El sistema procesa el archivo entero aplicando todas las validaciones, normalizaciones y resoluciones en la base de datos (usando cachés).
- **No se escribe absolutamente nada en la base de datos.**
- Devuelve un reporte completo detallando exactamente qué sucedería si el archivo se importase (ej. "3 nuevos, 10 actualizados, 2 con error").
- Permite a la UI mostrar una tabla previa para que el usuario humano apruebe los cambios.

### 2. Commit Mode (`commit=true`)
- Es la importación real.
- Repite el proceso de validación por seguridad.
- Ejecuta las escrituras reales en la base de datos usando un **Savepoint por fila** (`session.begin_nested()`).
- Si una fila falla en la escritura (por ejemplo, un error de base de datos imprevisto o `IntegrityError` no recuperable), el sistema hace rollback *solo de esa fila*.
- Devuelve un reporte final idéntico al de Preview, pero con confirmación de guardado.

## Consolidación de Filas Duplicadas

Si en el archivo de importación hay dos filas que representan a la misma entidad (ej. mismo CIF para Empresa, o mismo Email para Contacto), el sistema hace una pre-fusión (consolidación) **en memoria** antes de tocar la base de datos.

- **Campos M2M (Sectores, Verticales, Productos):** Se agrupan. Si la Fila 1 tiene "Software" y la Fila 2 tiene "Hardware", el resultado consolidado tendrá `["Software", "Hardware"]`.
- **Resto de campos:** Gana el primer valor encontrado que no sea nulo (política "fill-only").
- Estas filas consolidadas generan un aviso de tipo `ROW_CONSOLIDATED` indicando con qué fila se fusionaron.

## Estructura de CSV Esperada

### CSV de Empresas
| Columna Esperada | Normalización Aplicada | Requerido |
|------------------|------------------------|-----------|
| `nombre` | Trim + Title Case (`normalize_company_name`) | Sí |
| `cif` | Strip de espacios | No (Pero muy recomendado) |
| `web` | Sin protocolo, sin `www.`, lowercase (`normalize_web`) | No (Pero recomendado) |
| `pais` | Match contra BD (`pais.name`) | No |
| `provincia` | Match contra BD (`provincia.name`) | No |
| `sector`, `vertical`, `product` | Aceptan valores separados por comas | No |

### CSV de Contactos
| Columna Esperada | Normalización Aplicada | Requerido |
|------------------|------------------------|-----------|
| `email` | Lowercase + Strip | Al menos uno de identidad |
| `linkedin` | Sin protocolo ni queries (`normalize_linkedin`) | Al menos uno de identidad |
| `telefono` | Solo números y `+` inicial | Al menos uno de identidad |
| `nombre`, `apellidos` | Trim + Title Case | Sí |
| `empresa` | Resolve a Empresa ID | Sí |
| `cargo` | `normalize_job_title` + Alias Expansión | No |

## Códigos de Validación y Severidad

Durante el procesamiento de cada fila, el `BusinessInterrogator` valida las reglas de negocio. Devuelve avisos (`warnings`) o bloqueos (`errors`).

| Código | Nivel | Significado | Acción del Pipeline |
|--------|-------|-------------|---------------------|
| `MISSING_IDENTITY` | **CRÍTICO** | El contacto no tiene Email, LinkedIn ni Teléfono, o la empresa no tiene Nombre, Web ni CIF. | Fila rechazada (`status: "error"`). No se guarda. |
| `INVALID_NAME` | **BLOQUEANTE**| El nombre de la empresa es menor de 2 caracteres. | Fila rechazada. |
| `INVALID_CIF_FORMAT` | *Warning* | CIF con menos de 5 caracteres. | Se importa, pero se avisa. |
| `PAIS_NOT_FOUND` | *Warning* | El nombre del país no existe en la BD. | Se importa sin vincular país. |
| `PROVINCIA_NO_PAIS`| *Warning* | Viene provincia pero no viene país, o el país falló. | Se importa sin vincular provincia. |
| `EXISTING_ENTITY` | *Info* | La entidad ya existe en base de datos. | Se hace un Update No Destructivo. |
| `ROW_CONSOLIDATED` | *Info* | Esta fila es un duplicado en el archivo actual. | Se ignora en DB, se consolida con el "Master Row". |
| `AUTO_EMPRESA` | *Info* | Se va a crear una empresa al vuelo importando el contacto. | (Solo preview) Se avisa al usuario. |
