# Registro de Decisiones Arquitectónicas (ADR)

Este documento registra las decisiones técnicas clave tomadas durante el desarrollo del CRM, explicando el contexto, la alternativa considerada y el motivo por el cual se eligió la solución actual. Su objetivo es evitar tener que debatir los mismos problemas arquitectónicos repetidamente en el futuro.

## 1. Savepoint por fila en importación
**Contexto:** Los usuarios suben CSVs de miles de filas. Si una sola fila tiene un error (ej. nombre inválido), la transacción global fallaría, obligando al usuario a arreglar el error y re-importar todo, lo que causa frustración y pérdida de tiempo.
**Decisión:** Ejecutar cada fila dentro de un `session.begin_nested()` (SAVEPOINT en PostgreSQL).
**Motivación:** Garantiza aislamiento a nivel de fila. Si 999 filas son exitosas y 1 falla, las 999 se persisten y se reporta la fallida al usuario para su corrección manual posterior.

## 2. Alembic exclusivo para el esquema (sin `create_all`)
**Contexto:** A menudo en proyectos pequeños se usa `Base.metadata.create_all()` en el arranque para crear tablas rápido.
**Decisión:** Desactivar `create_all` y usar exclusivamente migraciones de Alembic.
**Motivación:** Garantiza que el esquema de desarrollo, staging y producción sea idéntico y trazable. Previene comportamientos inesperados donde una columna exista en un entorno pero no en otro porque alguien cambió el modelo sin generar la migración.

## 3. Campos M2M (Sectores, Verticales, Productos) en Empresa, no en Contacto
**Contexto:** Los contactos (personas) pertenecen a sectores de industria y comercializan productos.
**Decisión:** Establecer las relaciones `ManyToMany` (M2M) solo en el modelo `Empresa`. El modelo `Contact` no tiene relaciones directas con sectores/verticales/productos; en su lugar, delega estas propiedades a su empresa asociada.
**Motivación:** Evita la desincronización de datos. Si una empresa cambia de vertical, automáticamente todos sus empleados reflejan ese cambio. Mantiene la normalización (DRY - Don't Repeat Yourself).

## 4. Categorías de cargo en Base de Datos (no hardcodeadas)
**Contexto:** Se requiere agrupar "cargos" específicos (ej: CTO, Lead Developer) bajo "categorías" más amplias (ej: Dirección Técnica).
**Decisión:** Crear los modelos `CategoriaCargo` y `Cargo` en base de datos en lugar de usar ENUMs o un diccionario estático en el código o en n8n.
**Motivación:** Permite a los administradores gestionar, crear y renombrar categorías desde la UI sin requerir un despliegue de código nuevo. Además, facilita que herramientas externas lean las categorías activas a través de la API.

## 5. Principio de Upsert No Destructivo
**Contexto:** Constantemente entran datos desde múltiples fuentes: importaciones de CSV masivas, UI, y herramientas de enriquecimiento automático.
**Decisión:** Nunca sobreescribir un campo que ya tenga un valor con un nulo o vacío (`None` o `""`).
**Motivación:** Previene la pérdida accidental de información valiosa. Permite procesar el mismo archivo CSV varias veces (idempotencia) con la tranquilidad de que solo se añadirá información nueva, sin blanquear datos que un usuario haya rellenado a mano.

## 6. Columna `notes` como JSONB con Deep-Merge
**Contexto:** Las integraciones (Affino, Apollo, etc.) necesitan guardar metadata adicional o enriquecida que no encaja en las columnas estrictas de la BD.
**Decisión:** Usar una columna `notes` de tipo `JSONB` y, al actualizar, hacer un merge profundo de diccionarios.
**Motivación:** Evita crear docenas de columnas para cada pequeña métrica que pueda traer una herramienta externa. El `deep_merge` asegura que la ejecución de una herramienta (ej: `Apollo`) no borre la data insertada previamente por otra (ej: `n8n`).

## 7. Tres métodos de autenticación coexistentes
**Contexto:** Diferentes actores consumen la API: usuarios humanos (vía React SPA), integraciones legacy, y automatizaciones backend-to-backend (n8n).
**Decisión:** Soportar JWT (para SPA), Session Cookies (fallback/legacy) y API Keys (para system accounts).
**Motivación:** Mantiene la seguridad estricta para usuarios humanos (JWT expira rápido) mientras simplifica la vida a las automatizaciones (API Key de larga duración) sin necesidad de tener middlewares separados o puertos diferentes.
