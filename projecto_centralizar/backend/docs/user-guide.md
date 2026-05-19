# Manual del Usuario — Prisma CRM

Guía completa para gestores, comerciales y administradores que trabajan diariamente con la plataforma.

---

## Índice

1. [Acceso y sesión](#1-acceso-y-sesión)
2. [Módulo de Empresas](#2-módulo-de-empresas)
3. [Módulo de Contactos](#3-módulo-de-contactos)
4. [Módulo de Campañas](#4-módulo-de-campañas)
5. [Importaciones CSV / Excel](#5-importaciones-csv--excel)
6. [Segmentación (Datos Maestros)](#6-segmentación-datos-maestros)
7. [Integración con Affino](#7-integración-con-affino)
8. [Actividad y Registros](#8-actividad-y-registros)
9. [Gestión de Usuarios (Admin)](#9-gestión-de-usuarios-admin)
10. [Configuración del Sistema (Admin)](#10-configuración-del-sistema-admin)
11. [Errores frecuentes y soluciones](#11-errores-frecuentes-y-soluciones)

---

## 1. Acceso y sesión

### Iniciar sesión

Accede a la URL del CRM e introduce tu email y contraseña. Si no tienes cuenta, usa el enlace **"Solicitar acceso"** de la página de login para enviar una solicitud a los administradores.

### Sesión activa y cierre automático

La sesión tiene una duración de 60 minutos de inactividad. Si llevas un rato sin interactuar, el sistema mostrará un aviso antes de cerrar la sesión automáticamente. Puedes extenderla haciendo clic en **"Continuar"** cuando aparezca el aviso.

### Cambiar contraseña

En el menú lateral, accede a **Configuración** → sección **Seguridad**. Introduce tu contraseña actual y la nueva dos veces.

---

## 2. Módulo de Empresas

Las empresas son la entidad central del CRM. Los contactos, sectores, verticales y productos se organizan en torno a ellas.

### Crear una empresa

1. Navega a **Empresas** en el menú lateral.
2. Haz clic en **"Nueva Empresa"**.
3. Rellena los campos. Los únicos obligatorios son el **Nombre**. Se recomienda añadir también **CIF** y/o **Web** para evitar duplicados en el futuro.
4. Haz clic en **Crear**.

### Campos disponibles

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre comercial de la empresa. Obligatorio. |
| Web | Dominio de la empresa (sin `https://` ni `www.`). |
| Email | Email corporativo de contacto. |
| Teléfono | Teléfono principal. |
| CIF | Identificador fiscal. |
| Nº Empleados | Número aproximado de empleados. |
| Facturación | Facturación anual en euros. |
| CNAE | Código de actividad económica. |
| País | País de la empresa. Solo se activa el campo Provincia si se selecciona España. |
| Provincia | Provincia española. Solo disponible cuando el país es España. |
| Facebook | URL del perfil de Facebook de la empresa. |
| Competidores | Hasta 3 competidores, cada uno con su web y Facebook. |
| Sectores | Clasificación por industria (puede tener varios). |
| Verticales | Nicho de mercado (puede tener varios). |
| Productos | Productos o servicios clave (puede tener varios). |

### Campos M2M: Sectores, Verticales y Productos

Estos tres campos son **multivalor** — una empresa puede pertenecer a varios sectores a la vez, tener múltiples verticales y múltiples productos. Se seleccionan desde los desplegables del formulario. Los valores disponibles los gestiona un administrador desde la sección de Segmentación.

### Competidores

Cada empresa puede tener hasta 3 competidores registrados. Para cada competidor puedes añadir su **web** y su perfil de **Facebook**. Esta información se usa en el servicio de scoring externo para comparar con la competencia.

### País y Provincia

El campo **País** es un desplegable con todos los países. El campo **Provincia** solo aparece activo cuando el país seleccionado es **España**, y muestra un desplegable con las 52 provincias oficiales del INE. Si cambias el país a otro distinto de España, la provincia se limpia automáticamente.

El uso principal de la provincia es filtrar empresas por territorio para acciones comerciales vinculadas a subvenciones o convocatorias provinciales.

### Editar una empresa

Haz clic en los tres puntos `···` al final de la fila y selecciona **Editar**. Se abrirá el mismo formulario de creación con los datos actuales precargados. 

### Eliminar una empresa

Solo es posible eliminar una empresa si **no tiene contactos asociados**. Si los tiene, primero deberás reasignarlos o eliminarlos. Haz clic en `···` → **Eliminar** y confirma.

### Filtros en la tabla de empresas

La tabla de empresas permite filtrar por los siguientes criterios:

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Búsqueda | Texto libre | Filtra por nombre de empresa. |
| Sector | Desplegable | Empresas que pertenecen a ese sector. |
| Vertical | Desplegable | Empresas de esa vertical. |
| Producto | Desplegable | Empresas con ese producto asociado. |
| País | Desplegable | Empresas del país seleccionado. |
| Provincia | Desplegable | Solo disponible cuando el filtro País es España. |
| Nº Empleados | Rango (mín/máx) | Filtra por número de empleados. |
| Facturación | Rango (mín/máx) | Filtra por facturación anual. |
| CNAE | Texto | Filtra por código de actividad. |

Los filtros son acumulativos: puedes combinar varios a la vez. Hay un botón **"Limpiar filtros"** para resetearlos todos.

### Acciones en masa

Desde la tabla, puedes seleccionar varias empresas usando los checkboxes y realizar acciones sobre el conjunto seleccionado:

- **Eliminar seleccionadas** — elimina solo las empresas sin contactos.
- **Enviar a Adscore** — exporta las empresas seleccionadas a la herramienta Affino (ver sección 7).
- **Enriquecer** — envía las empresas seleccionadas al servicio de enriquecimiento externo.

Si no tienes nada seleccionado, las acciones en masa actúan sobre todos los resultados del filtro activo.

---

## 3. Módulo de Contactos

Los contactos son las personas con las que interactúas comercialmente. Cada contacto está vinculado a una empresa.

### Crear un contacto

1. Navega a **Contactos** y haz clic en **"Nuevo Contacto"**.
2. Rellena los datos. Para evitar duplicados es fundamental rellenar al menos uno de estos tres campos: **Email**, **LinkedIn** o **Teléfono**.
3. **Empresa:** Escribe el nombre de la empresa en el campo correspondiente. El sistema busca en tiempo real. Si la empresa no existe, puedes crearla al vuelo desde el mismo campo.
4. **Cargo:** Selecciona el cargo del contacto.
5. Haz clic en **Crear**.

### Campos disponibles

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre del contacto. |
| Apellidos | Apellidos del contacto. |
| Email | Correo electrónico. Clave de identidad principal. |
| Teléfono | Teléfono de contacto. |
| LinkedIn | URL del perfil de LinkedIn. Clave de identidad secundaria. |
| Empresa | Empresa a la que pertenece el contacto. |
| Cargo | Puesto en la empresa. |
| Campañas | Campañas en las que está incluido el contacto. |

### Cómo funciona la detección de duplicados

El sistema verifica si ya existe un contacto con el mismo email, LinkedIn o teléfono
antes de guardar. Si encuentra una coincidencia, **bloquea la creación** y muestra
un error indicando qué campo está duplicado y qué contacto ya lo está usando,
para que puedas localizarlo y editarlo si es necesario.

Este comportamiento aplica únicamente a la creación manual desde la UI. Las
importaciones CSV y los flujos automáticos de N8N siguen usando actualización
no destructiva (si el contacto existe, se actualiza con los datos nuevos sin
bloquear la operación).

### Editar y eliminar contactos

Haz clic en `···` al final de la fila para acceder a las opciones de editar y eliminar.

### Filtros en la tabla de contactos

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Nombre | Texto libre | Filtra por nombre o apellidos. |
| Email | Texto libre | Filtra por dirección de email. |
| Sector | Desplegable | Contactos en empresas de ese sector. |
| Vertical | Desplegable | Contactos en empresas de esa vertical. |
| Producto | Desplegable | Contactos en empresas con ese producto. |
| Cargo | Desplegable | Contactos con ese cargo específico. |
| Categoría de Cargo | Desplegable | Contactos cuyo cargo pertenece a esa categoría. |
| Campaña | Desplegable | Contactos asignados a esa campaña. |
| Enriquecido | Sí / No | Filtra según si el contacto ha pasado por enriquecimiento. |

### Acciones en masa sobre contactos

Igual que en empresas, puedes seleccionar contactos con los checkboxes y aplicar acciones en masa:

- **Eliminar seleccionados.**
- **Enviar a Affino** — exporta los contactos seleccionados a Affino (ver sección 7).
- **Actualizar campo en masa** — permite cambiar un campo concreto (por ejemplo, la campaña) en todos los contactos seleccionados a la vez.

---

## 4. Módulo de Campañas

Las campañas son agrupaciones de contactos que se usan para organizar acciones comerciales o flujos de comunicación.

### Crear una campaña

1. Ve a **Segmentación** en el menú lateral.
2. En el apartado de campañas haz clic en **"Añadir Campaña"**.
3. Introduce el nombre y confirma.

### Asignar contactos a una campaña

Desde la ficha de un contacto (editar), puedes asignarle una o varias campañas. También puedes asignar campañas en masa desde la tabla de contactos usando los filtros y la acción de actualización masiva.

### Eliminar una campaña

Una campaña solo puede eliminarse si **no tiene contactos asignados**. Si los tiene, deberás desasignar los contactos primero o eliminarlos.

---

## 5. Importaciones CSV / Excel

El sistema de importación permite cargar datos en masa de forma segura. Funciona en dos pasos: primero se muestra una vista previa de lo que ocurriría y luego se confirma.

### Formatos aceptados

- **CSV** (separador coma o punto y coma)
- **Excel** (`.xlsx`)

La primera fila del archivo debe ser la cabecera con los nombres de columna.

### Plantilla descargable

En el modal de importación hay un botón **"Descargar plantilla"** que genera un archivo Excel con las columnas ya nombradas correctamente y dos filas de ejemplo. Es la forma más rápida de preparar una importación correcta.

### Campos aceptados para importar Empresas

| Campo canónico | Nombres de columna aceptados | Obligatorio |
|----------------|------------------------------|-------------|
| Nombre | `nombre`, `empresa`, `company`, `name`, `Nombre empresa` | Sí |
| Web | `web`, `website`, `url`, `site`, `Web Empresa` | No (recomendado) |
| Email | `email`, `correo`, `mail`, `Email empresa` | No |
| Teléfono | `phone`, `telefono`, `tel`, `mobile`, `Telefono empresa` | No |
| CIF | `cif`, `vat`, `vat_number`, `CIF empresa` | No (recomendado) |
| Nº Empleados | `numero_empleados`, `employees`, `empleados`, `Numero empleados` | No |
| Facturación | `facturacion`, `revenue`, `turnover`, `ventas` | No |
| CNAE | `cnae`, `industry_code`, `actividad` | No |
| Facebook | `facebook`, `fb_url`, `facebook_url` | No |
| País | `pais`, `país`, `country`, `nation`, `Pais empresa` | No |
| Provincia | `provincia`, `province`, `state`, `region`, `región`, `Provincia empresa` | No |
| Web Competidor 1 | `web_competidor_1`, `competidor_1`, `competitor_1`, `Web competidor 1` | No |
| Web Competidor 2 | `web_competidor_2`, `competidor_2`, `competitor_2`, `Web competidor 2` | No |
| Web Competidor 3 | `web_competidor_3`, `competidor_3`, `competitor_3`, `Web competidor 3` | No |
| Facebook Competidor 1 | `Facebook competidor 1`, `Competidor 1 Facebook` | No |
| Facebook Competidor 2 | `Facebook competidor 2`, `Competidor 2 Facebook` | No |
| Facebook Competidor 3 | `Facebook competidor 3`, `Competidor 3 Facebook` | No |
| Sector | `sector`, `industria`, `industry`, `Sector` | No |
| Vertical | `vertical`, `subsector`, `Vertical` | No |
| Producto | `producto`, `product`, `servicio`, `Producto` | No |

Los campos Sector, Vertical y Producto aceptan múltiples valores separados por comas en la misma celda: `Software, Hardware`.

### Campos aceptados para importar Contactos

| Campo canónico | Nombres de columna aceptados | Obligatorio |
|----------------|------------------------------|-------------|
| Nombre | `nombre`, `first_name`, `full_name`, `contacto`, `Nombre` | No |
| Apellidos | `apellido`, `last_name`, `surname`, `apellidos`, `Apellidos` | No |
| Email | `email`, `correo`, `mail`, `Email` | Al menos uno de identidad |
| Teléfono | `phone`, `telefono`, `tel`, `mobile`, `Telefono` | Al menos uno de identidad |
| LinkedIn | `linkedin`, `linkedin_url`, `perfil linkedin`, `LinkedIn` | Al menos uno de identidad |
| Cargo | `cargo`, `job_title`, `puesto`, `position`, `rol`, `Cargo` | No |
| Empresa | `empresa`, `company`, `nombre empresa`, `Nombre empresa` | No |
| Campaña | `campaña`, `campaign`, `campana`, `origen`, `Campaña` | No |

> **Importante:** Cada contacto necesita al menos uno de Email, Teléfono o LinkedIn para poder ser identificado. Sin ninguno de los tres, la fila será rechazada.

### Comportamiento con País y Provincia

- Si el nombre del **país** no coincide con ningún país de la base de datos, la empresa se importa sin país asignado y aparece un **aviso en amarillo** en la vista previa. No bloquea la importación.
- Si el nombre de la **provincia** no coincide, ocurre lo mismo: se importa sin provincia y aparece el aviso. No bloquea.
- Si en el CSV viene una provincia pero el país no se ha podido resolver, la provincia tampoco se asigna (no tiene sentido sin el país).

Los avisos de este tipo se muestran diferenciados visualmente (amarillo/naranja) respecto a los errores bloqueantes (rojo).

### Paso 1: Vista previa

Sube el archivo y el sistema analiza su contenido **sin escribir nada en la base de datos**. Recibirás un informe con:

- **Nuevos:** Entidades que se crearán por primera vez.
- **Actualizar:** Entidades que ya existen y se actualizarán con nuevos datos.
- **Fusiones:** Filas que el sistema ha consolidado porque representaban la misma entidad dentro del mismo archivo.
- **Omitidos / Errores:** Filas que no se pueden importar por errores bloqueantes.

Si hay avisos de ubicación (país o provincia no reconocidos), aparece un banner amarillo indicando cuántas empresas se importarán sin ese campo.

### Paso 2: Confirmar importación

Si el resultado de la vista previa es satisfactorio, haz clic en **"Confirmar Importación"**. El sistema ejecuta la importación real.

### Principio de actualización no destructiva

Si una empresa ya existe en la base de datos y la importas de nuevo con un campo vacío en el CSV, **el campo existente en la base de datos no se borra**. Solo se añaden o actualizan campos con valores reales. Esto permite subir el mismo CSV varias veces de forma segura.

### Filas duplicadas dentro del mismo archivo

Si el archivo contiene dos filas que representan la misma empresa (mismo CIF, web o nombre), el sistema las fusiona en memoria antes de procesar. Los campos M2M (sectores, verticales, productos) se acumulan; para el resto de campos gana el primer valor no vacío. La fila fusionada aparece con el estado `Fusión` en la vista previa.

### Exportar a CSV

Desde las tablas de Empresas y Contactos hay un botón **"Exportar"** que descarga los resultados actuales (con los filtros aplicados) en formato CSV. Los campos de país, provincia, competidores y categoría de cargo se exportan como texto legible, no como IDs internos.

---

## 6. Segmentación (Datos Maestros)

La sección de **Segmentación** permite gestionar los catálogos que se usan para clasificar empresas y contactos: sectores, verticales, productos, cargos, categorías de cargo, países y provincias.

### Sectores, Verticales y Productos

Estos tres elementos se usan para clasificar empresas. Para crear uno:

1. Ve a **Segmentación**.
2. En la sección correspondiente, haz clic en el botón de crear.
3. Escribe el nombre y pulsa Enter.
4. El sistema normaliza el nombre para evitar duplicados (por ejemplo, `SOFTWARE` y `software` se tratan como el mismo elemento).

Para **eliminar** un elemento, solo es posible si ninguna empresa lo tiene asignado actualmente.

### Cargos

Los cargos se crean automáticamente cuando un contacto se crea con un cargo nuevo (desde la UI o por importación). También se pueden crear y gestionar manualmente desde Segmentación.

El sistema normaliza los cargos al guardarlos: elimina puntos, colapsa espacios y expande acrónimos comunes (`CEO` → `Chief Executive Officer`).

Cada cargo puede tener asignada una **Categoría de Cargo**. Para asignarla, selecciona la categoría en el desplegable que aparece junto a cada cargo en la lista.

### Categorías de Cargo

Las categorías son agrupaciones de cargos que permiten segmentar contactos por nivel de influencia o decisión (por ejemplo: Decisor, Influenciador, Técnico, Operativo).

Para crear una categoría:

1. En Segmentación, ve a la sección **Categorías de Cargo**.
2. Haz clic en el botón de crear, escribe el nombre y pulsa Enter.

Para eliminar una categoría, primero debes desasignarla de todos los cargos que la usen.

**Regla importante sobre el enriquecimiento:** Cuando los flujos automáticos de N8N enriquecen contactos, pueden sugerir una categoría para un cargo. Sin embargo, si el cargo ya tiene una categoría asignada manualmente, la sugerencia del flujo automático se ignora.

### Países y Provincias

El catálogo de países viene pre-cargado con la lista ISO completa (en español). Las 52 provincias españolas también vienen incluidas por defecto.

Si en alguna importación aparece un país o provincia que no se reconoce, el dato se importa sin asignar ese campo, pero puedes añadir manualmente el valor faltante desde esta sección si es necesario.

---

## 7. Integración con Affino

Affino es la herramienta externa de captación de leads y envío de mensajes. El CRM está integrado para enviar contactos directamente a las cuentas de Affino configuradas.

### Configurar cuentas de Affino

Antes de poder enviar contactos a Affino, un administrador debe configurar al menos una cuenta. Ve a **APIs y Webhooks** en el menú de administración.

En la sección **Cuentas Affino** verás una tabla con las cuentas configuradas. Cada cuenta tiene:

- **Nombre** — identificador descriptivo (por ejemplo, "Cuenta de Juan").
- **X-User-ID** — credencial personal de la cuenta de Affino (se muestra ofuscada por seguridad).

Para añadir una cuenta, haz clic en **"+ Añadir cuenta"**, introduce el nombre y el X-User-ID y guarda.

Debajo de la tabla de cuentas está la sección **Configuración de Conexión**, donde se configura la URL del endpoint de Affino y el método de autenticación. Esta configuración es global y compartida por todas las cuentas.

### Enviar contactos a Affino

1. En la tabla de **Contactos**, selecciona los contactos que quieres enviar (o aplica los filtros para definir el conjunto sin seleccionar individualmente).
2. Haz clic en el botón **"Enviar a Affino"**.
3. Aparecerá un modal con la lista de cuentas de Affino disponibles.
4. Selecciona la cuenta a la que quieres enviar los contactos.
5. Haz clic en **"Enviar"**.

Si no hay cuentas configuradas, el modal mostrará un aviso indicando que un administrador debe configurar una desde APIs y Webhooks.

---

## 8. Actividad y Registros

La sección de **Actividad** (disponible para administradores) centraliza el historial de operaciones del sistema.

### Registros de integración

Muestra el historial de ejecuciones de herramientas externas (enriquecimientos, envíos a Affino, etc.). Para cada ejecución se registra:

- La herramienta usada.
- El estado (éxito, error).
- Las métricas de la ejecución (cuántos contactos procesados, errores, etc.).
- La fecha y hora.

### Registros de auditoría

Muestra las acciones realizadas por los usuarios del CRM: creaciones, ediciones, eliminaciones y acciones en masa. Es útil para rastrear quién hizo qué y cuándo.

### Retención de registros

Los registros se conservan por defecto 90 días. Un administrador puede ajustar este período y lanzar una limpieza manual desde esta sección.

---

## 9. Gestión de Usuarios (Admin)

La sección de **Usuarios** (solo administradores) permite ver y gestionar las cuentas de los usuarios del CRM.

### Roles

Existen dos roles:

- **Admin** — acceso completo. Puede gestionar usuarios, segmentación, configuración del sistema y ver todos los registros.
- **Gestor** — acceso operativo. Puede trabajar con contactos, empresas, segmentación e importaciones, pero no accede a la configuración del sistema ni a la gestión de usuarios.

### Activar y desactivar usuarios

Un administrador puede desactivar una cuenta de usuario. Un usuario desactivado no puede iniciar sesión y sus sesiones activas se invalidan de inmediato.

### Flujo de solicitud de acceso

Los nuevos usuarios no pueden registrarse directamente. Deben solicitar acceso desde la página pública de login. La solicitud llega a los administradores en la sección **Solicitudes de Acceso**, donde pueden aprobarla (creando la cuenta con el rol que elijan) o rechazarla.

---

## 10. Configuración del Sistema (Admin)

### APIs y Webhooks

Desde esta sección se configuran las integraciones con herramientas externas:

- **Cuentas Affino** — gestión de las cuentas de Affino para el envío de contactos (ver sección 7).
- **Otros servicios** — configuración de API keys y URLs de webhook para otras integraciones (enriquecimiento, etc.).

### API Key del sistema

Para que N8N u otras herramientas externas puedan llamar a la API del CRM, un administrador debe generar una API Key desde **Sistema** → **API Key**. Esta clave se envía en el header `X-API-Key` en cada petición.

Es recomendable crear un usuario dedicado con rol `gestor` y asociarlo a la API Key, en lugar de usar la cuenta del administrador principal.

---

## 11. Errores frecuentes y soluciones

### Importación

**La fila aparece en rojo con error `MISSING_IDENTITY`**
El contacto no tiene Email, LinkedIn ni Teléfono. El sistema no puede identificarlo. Añade al menos uno de estos campos en tu archivo.

**Aparecen avisos en amarillo sobre país o provincia**
El nombre del país o provincia no coincide exactamente con ningún valor de la base de datos. La empresa se importará igualmente pero sin ese campo asignado. Puedes corregir el valor en tu archivo (asegurándote de que el nombre coincida exactamente con los valores del catálogo) y volver a importar.

**"Importación parcial" (algunas filas con éxito, otras con error)**
Es el comportamiento esperado. Las filas correctas se han guardado. Solo tienes que corregir las filas con error en tu Excel y volver a subirlas — no se crearán duplicados gracias a la actualización no destructiva.

**La importación es muy lenta con archivos grandes**
Para archivos de más de 2.000-3.000 filas, considera partirlos en bloques. El sistema usa savepoints por fila, por lo que puedes detenerlo en cualquier momento sin dejar la base de datos en mal estado.

### Lógica de datos

**Tengo un contacto duplicado en la base de datos**
Puede ocurrir si un contacto fue creado con email y luego importado con LinkedIn (sin email). El sistema no cruza identidades automáticamente. Edita uno de los dos para añadirle el campo que falta al otro, y elimina el duplicado.

**Creé una Categoría de Cargo pero los contactos no aparecen filtrados por ella**
La categoría de cargo se asigna al cargo, no directamente al contacto. Ve a **Segmentación → Cargos** y asigna la categoría a los cargos correspondientes (CEO, Director, etc.). Una vez asignada, todos los contactos con esos cargos quedarán automáticamente clasificados bajo esa categoría.

**N8N está sobrescribiendo campos con valores vacíos**
No debería ocurrir. El CRM aplica actualización no destructiva: si N8N envía un campo vacío o nulo, el valor existente se conserva. Si el problema persiste, revisa el flujo de N8N para asegurarte de que envía `null` (tipo nulo) y no strings como `"null"` o `" "` (espacio en blanco), que el sistema interpreta como valores con contenido.

**No puedo eliminar una empresa**
Las empresas con contactos asociados no pueden eliminarse. Reasigna o elimina los contactos primero.

**No puedo eliminar un sector/vertical/producto/cargo**
Solo se pueden eliminar si ninguna empresa o contacto los tiene asignados actualmente.

### Acceso y sesión

**Error 401 al usar la API desde N8N**
La API Key puede haber cambiado o no estar configurada correctamente. Pide al administrador que verifique la API Key y que tenga un Service Account asociado.

**La sesión se cierra sola antes de tiempo**
La sesión expira tras 60 minutos de inactividad. Si necesitas trabajar durante períodos más largos sin interacción, recuerda hacer clic periódicamente o responder al aviso de sesión cuando aparezca.
