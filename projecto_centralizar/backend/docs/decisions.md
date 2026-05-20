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

## 8. Resolución de la Deuda Técnica: Flujo de Enriquecimiento (Trigger-Callback)
**Contexto:** Los tres problemas de diseño identificados originalmente en el pipeline de enriquecimiento han sido resueltos de forma definitiva con una arquitectura asíncrona robusta y desacoplada:

1. **Desbloqueo de Conexiones (Background Tasks):** El endpoint `/api/empresas/enrich` y los endpoints de herramientas de contactos en `/api/contacts` han sido desacoplados del webhook HTTP externo. Ahora, validan la solicitud, registran la intención en `enrichment_logs` de forma persistente, actualizan el estado visual síncronamente (para retrocompatibilidad total del frontend) y responden `202 Accepted` de inmediato. La llamada real al webhook se delega a `FastAPI BackgroundTasks` utilizando un contexto serializable de tipos primitivos (evitando `DetachedInstanceError`) y abriendo su propia sesión limpia de BD (`AsyncSessionLocal()`).
2. **Sincronización del Estado con `enrichment_run_id`:** Se modificó el esquema `IngestRequest` del callback `/api/enrichment/ingest` para incluir un campo opcional `enrichment_run_id`. Si se proporciona, el servicio `bulk_ingest` localiza el registro de auditoría en la tabla `enrichment_logs` y actualiza su estado a `"completed"` junto con las métricas detalladas de procesamiento de empresas y contactos.
3. **Expiración de Ejecuciones Atascadas ("Stuck in sent"):**
   - **Timeout de Configuración:** Se introdujo la variable `ENRICHMENT_TIMEOUT_MINUTES` en `Settings` (por defecto `180` minutos / 3 horas).
   - **Lógica de Expiración:** El servicio `expire_stale_runs` busca ejecuciones en estado `"pending"` o `"sent"` que hayan superado el timeout, marca el log como `"expired"` y libera a las empresas bloqueadas reseteando su `enrichment_status` a `None`.
   - **Ejecución Standalone & Endpoints:** Se implementó un endpoint de administración `POST /api/system/expire-enrichments` para activarla de forma manual, y un script standalone ejecutable por cron en `scripts/expire_enrichments.py`.
   - **Política de Descarte de Callbacks Tardíos:** Si un callback llega después de que una ejecución haya sido marcada como `"expired"`, el servicio `bulk_ingest` descarta deliberadamente el procesamiento de los datos recibidos de manera segura para prevenir inconsistencias de estado, registrando una advertencia detallada en los logs del servidor.


## 9. Normalización de Competidores (Tabla Relacionada)
**Contexto:** Originalmente, las empresas tenían tres campos planos para competidores: `web_competidor_1`, `web_competidor_2`, y `web_competidor_3` en la propia tabla `empresas`. Esto limitaba la estructura, dificultaba validar o enriquecer datos de competidores adicionales de forma homogénea (por ejemplo, URLs de redes sociales asociadas a cada competidor), y contaminaba la tabla principal de empresas con columnas específicas y rígidas.
**Decisión:** Eliminar las columnas planas de competidores de la tabla `empresas` y crear una tabla normalizada `competidores` con una relación uno-a-muchos (máximo 3 competidores por empresa, identificados de forma única por la clave compuesta `(empresa_id, posicion)`). Cada competidor registra campos individuales (`web` y `facebook`).
**Motivación:** 
- **Flexibilidad y Normalización:** Separa la entidad competidor en su propia estructura de base de datos, permitiendo almacenar múltiples canales de información por competidor (por ejemplo, `facebook` y `web` simultáneamente) sin añadir decenas de columnas dispersas en la tabla `empresas`.
- **Compatibilidad e Integridad:** Los pipelines de importación y exportación CSV/Excel se adaptaron para aplanar/mapear dinámicamente esta relación uno-a-muchos, garantizando la compatibilidad round-trip sin alterar el flujo de trabajo del usuario. Las validaciones de negocio (como las reglas de Adscore) y exportaciones/importaciones ahora operan sobre esta relación limpia.
