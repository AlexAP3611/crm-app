# Resolución de Problemas (Troubleshooting)

Guía de diagnóstico para los problemas más frecuentes del CRM. Organizada por área para localizar rápidamente la sección relevante.

---

## Problemas de Importación (ETL)

### Error `MISSING_IDENTITY` en una fila

**Causa:** El contacto o empresa no tiene ningún campo de identidad válido.
- **Contactos:** Se necesita al menos uno de Email, Teléfono o LinkedIn.
- **Empresas:** Se necesita al menos uno de CIF, Web o Nombre.

**Solución:** Rellena al menos uno de los campos de identidad correspondientes en el archivo y vuelve a subirlo.

---

### Import masivo lento o se queda colgado

**Causa:** Procesar varios miles de filas con upserts y relaciones M2M es intensivo.

**Solución:** Parte el CSV en bloques de 2.000-3.000 filas. El pipeline usa savepoints por fila, así que puedes detener la importación en cualquier momento sin que la base de datos quede en estado inconsistente. Las filas ya procesadas con éxito se persisten aunque interrumpas.

---

### Importación parcial (Success > 0, Failed > 0)

**Causa:** Algunas filas violaban reglas de negocio (nombre demasiado corto, identidad inválida, etc.) pero el resto eran correctas. Es el comportamiento esperado.

**Solución:** No necesitas volver a subir el archivo completo (aunque si lo haces, las filas ya importadas se actualizarán sin crear duplicados gracias a la actualización no destructiva). Abre el log del previsualizador, localiza las filas con error, corrígelas en el Excel y sube solo esas.

---

### Avisos amarillos de país o provincia no reconocidos

**Causa:** El nombre del país o provincia en el CSV no coincide exactamente con ningún registro de la base de datos. Causas habituales:
- El país viene en inglés desde Apollo/Clay (ej. `"Spain"` en lugar de `"España"`).
- Hay un typo (ej. `"Españaa"`).
- La provincia usa el nombre histórico en lugar del oficial INE (ej. `"Vizcaya"` en lugar de `"Bizkaia"`).

**Efecto:** La empresa se importa correctamente, pero sin país o provincia asignados. Los avisos son **no bloqueantes**.

**Solución:**
1. Corrige los valores en el archivo para que coincidan con los del catálogo de Datos Maestros.
2. Si el país o provincia es legítimo pero no está en el catálogo, un administrador puede añadirlo desde **Segmentación → Países / Provincias**.
3. Vuelve a importar el archivo corregido. Las empresas ya creadas se actualizarán con el país/provincia correcto.

---

### El mismo contacto aparece duplicado en la base de datos

**Causa:** El sistema resuelve identidades en orden Email → LinkedIn → Teléfono. Si un contacto fue creado primero con email y luego importado usando solo LinkedIn (sin email), el sistema no lo cruzó y creó una entidad nueva.

**Solución:** Fusión manual. Edita uno de los dos contactos añadiéndole el campo que falta al otro, y elimina el duplicado.

---

### Las columnas de mi CSV no se reconocen

**Causa:** El nombre de la columna no coincide con ninguno de los aliases registrados en el sistema.

**Solución:** Descarga la plantilla oficial desde el modal de importación (botón "Descargar plantilla") y usa exactamente los nombres de columna de esa plantilla. Consulta también la tabla completa de aliases en `imports.md`.

---

## Problemas con Datos Maestros y Segmentación

### Creé una Categoría de Cargo pero los contactos no aparecen filtrados por ella

**Causa:** La categoría se asigna al **cargo**, no al contacto directamente. Un cargo sin categoría asignada no filtra ningún contacto.

**Solución:** Ve a **Segmentación → Cargos** y asigna la categoría al cargo correspondiente (ej. "CEO", "Director de Marketing", etc.). Una vez asignada, todos los contactos con ese cargo quedarán automáticamente clasificados.

---

### N8N está intentando cambiar la categoría de un cargo pero no funciona

**Causa:** Comportamiento diseñado. La protección contra sobrescritura por automatizaciones es intencional. Si un cargo ya tiene una categoría asignada desde la UI, ningún flujo automático puede modificarla.

**Solución:** Si necesitas cambiar la categoría de un cargo, hazlo manualmente desde **Segmentación → Cargos**. Solo la UI puede modificar categorías ya asignadas.

---

### No puedo eliminar un sector / vertical / producto / cargo / categoría

**Causa:** El elemento tiene registros asociados. Las reglas son:
- **Sector, Vertical, Producto:** No se puede eliminar si alguna empresa lo tiene asignado.
- **Cargo:** No se puede eliminar si algún contacto lo tiene asignado.
- **Categoría de Cargo:** No se puede eliminar si algún cargo la tiene asignada.
- **País:** No se puede eliminar si tiene provincias o empresas asociadas.
- **Provincia:** No se puede eliminar si hay empresas asignadas a ella.

**Solución:** Desasocia primero todos los registros que usan el elemento. Para sectores/verticales/productos esto puede requerir edición masiva de empresas.

---

## Problemas con Affino

### El botón "Enviar a Affino" no muestra ninguna cuenta disponible

**Causa:** No hay cuentas de Affino configuradas en el sistema.

**Solución:** Un administrador debe añadir al menos una cuenta desde **APIs y Webhooks → Cuentas Affino**. Cada cuenta necesita un nombre descriptivo y su X-User-ID.

---

### El envío a Affino da error 400 "No hay cuenta Affino configurada"

**Causa:** Se llamó al endpoint `POST /api/contacts/export/affino` sin pasar `account_id` y tampoco existe la configuración legacy en `settings.ext_config_affino.xUserId`.

**Solución:** Usa siempre el selector de cuentas desde la UI (modal "¿A qué cuenta de Affino enviar?"). Si el problema ocurre desde N8N o una integración, asegúrate de pasar el campo `account_id` en el payload de la petición.

---

### El envío llega a Affino pero con el X-User-ID incorrecto

**Causa:** Se seleccionó la cuenta equivocada al enviar, o la cuenta tiene el X-User-ID desactualizado.

**Solución:** Ve a **APIs y Webhooks → Cuentas Affino**, haz clic en Editar en la cuenta correspondiente, activa el toggle de visibilidad del X-User-ID para verificar el valor, y corrígelo si es necesario.

---

### La URL de Affino no responde / error de conexión

**Causa:** La URL del endpoint de Affino en la Configuración de Conexión es incorrecta o el servicio está caído.

**Solución:**
1. Ve a **APIs y Webhooks → Configuración de Conexión**.
2. Verifica que la URL del servicio es correcta y accesible.
3. Comprueba que el tipo de autenticación y el token son correctos.
4. Prueba la URL directamente desde un cliente HTTP (Postman, curl) para descartar problemas de red.

---

## Problemas con N8N y Enriquecimiento

### N8N está sobreescribiendo campos con valores vacíos

**Causa esperada:** No debería ocurrir. El CRM aplica actualización no destructiva: si N8N envía un campo nulo, el valor existente se conserva.

**Causa real más probable:** N8N está enviando valores que no son verdaderamente nulos en JSON. Valores problemáticos habituales:
- String `"null"` en lugar del tipo `null`
- String `" "` (espacio en blanco) — el sistema lo trata como valor con contenido
- String `"undefined"`

**Solución:** Revisa el nodo de N8N que construye el payload. Asegúrate de que los campos vacíos se envían como `null` (JSON nativo), no como strings.

---

### El enriquecimiento no actualiza el campo `web` o `email` de una empresa

**Causa:** Diseñado así. Los campos `web`, `email` y `phone` están protegidos en el enriquecimiento. Si ya tienen un valor, los datos del enriquecimiento se guardan en `notes[source]["_enrichment_{field}"]` en lugar de sobrescribir.

**Motivo:** Proteger datos validados manualmente de ser sobrescritos por datos externos de calidad incierta.

**Solución:** Si quieres actualizar estos campos desde el enriquecimiento, edita la empresa manualmente desde la UI con el valor correcto.

---

## Problemas de Acceso y Sesión

### Error 401 (Unauthorized) desde N8N o integración externa

**Causas posibles:**
1. La API Key no está configurada o ha cambiado.
2. La API Key no tiene un Service Account asociado.
3. El usuario asociado a la API Key está desactivado.

**Diagnóstico:**
1. Ve a **Sistema → API Key** y verifica que hay una clave generada.
2. Comprueba que hay un Service Account vinculado (`POST /api/system/api-key/service-account/{user_id}`).
3. Verifica que el usuario del Service Account está activo.

---

### La sesión se cierra antes de tiempo

**Causa:** La sesión expira tras 60 minutos de inactividad. Este es el comportamiento esperado.

**Solución:** Cuando aparezca el aviso de sesión próxima a expirar, haz clic en "Continuar" para extenderla. Si trabajas con el CRM abierto sin interacción durante períodos largos (ej. con la pantalla en segundo plano), la sesión cerrará automáticamente.

---

### No puedo activar/desactivar un usuario

**Causa:** Solo los usuarios con rol `admin` pueden gestionar cuentas de otros usuarios.

**Solución:** Accede con una cuenta de administrador a **Usuarios** y usa el toggle de activación en la fila correspondiente.

---

## Problemas de Entorno (Desarrolladores)

### La migración de Alembic dice "Target database is not up to date"

**Causa:** El esquema de la BD no coincide con el estado que Alembic espera. Ocurre si alguien modificó el esquema directamente en SQL, o si hay migraciones sin aplicar.

**Solución:**
```bash
alembic current    # Ver qué revisión tiene la BD
alembic history    # Ver todas las revisiones
alembic upgrade head  # Aplicar todas las pendientes
```

Si el problema persiste porque hay migraciones modificadas (hash válido pero contenido diferente), puede ser necesario comparar el esquema actual con el esperado:
```bash
alembic check  # Detecta diferencias entre modelos y BD
```

---

### Error `no existe la columna X` al arrancar

**Causa:** El modelo SQLAlchemy tiene un campo que no existe en la BD. O hay una migración pendiente de aplicar, o se añadió el campo al modelo sin generar la migración.

**Solución:**
```bash
alembic upgrade head  # Aplicar migraciones pendientes
```

Si el error persiste, el campo puede haberse añadido al modelo pero no a ninguna migración. Genera una:
```bash
alembic revision --autogenerate -m "add campo X"
alembic upgrade head
```

---

### Error 401 al probar endpoints en Swagger UI (local)

**Causa:** JWT ausente o caducado en Swagger.

**Solución:** En Swagger UI (`http://localhost:8000/docs`), haz clic en el botón **Authorize** (arriba a la derecha), introduce `Bearer <token>` donde el token lo obtienes haciendo `POST /api/login` desde la misma interfaz.

---

### Incompatibilidad de Passlib con Bcrypt

**Causa:** En 2024, `bcrypt` lanzó versiones >4.1 que rompieron la compatibilidad con `passlib`, la librería usada para hashear contraseñas.

**Solución:** El `requirements.txt` tiene fijado `bcrypt==4.0.1`. No actualices esta dependencia sin verificar compatibilidad con `passlib` primero.

---

### Error de `MissingGreenlet` o `greenlet_spawn` en tests o scripts

**Causa:** Se está accediendo a un atributo de un objeto SQLAlchemy fuera de una sesión async activa. Ocurre típicamente cuando se intenta acceder a una relación lazy (`lazy="select"`) fuera del contexto de una request.

**Solución:**
1. Asegúrate de que todas las relaciones que se van a usar están configuradas con `lazy="selectin"` en el modelo, o
2. Añade `selectinload(Modelo.relacion)` explícitamente en la query antes de acceder al atributo.

---

### `pycountry` no está instalado (migración falla)

**Causa:** El paquete `pycountry` es necesario para la migración de seeds de países pero no está instalado en el entorno.

**Solución:**
```bash
pip install pycountry
alembic upgrade head
```

---

## Referencia rápida de códigos de error de importación

| Código | Severidad | Descripción |
|--------|-----------|-------------|
| `MISSING_IDENTITY` | CRITICAL | Sin Email/LinkedIn/Teléfono (contacto) o CIF/Web/Nombre (empresa). La fila no se importa. |
| `INVALID_NAME` | BLOCKER | Nombre de empresa con menos de 2 caracteres. La fila no se importa. |
| `INVALID_CIF_FORMAT` | WARNING | CIF con menos de 5 caracteres. La fila continúa. |
| `PAIS_NOT_FOUND` | WARNING | País no encontrado en BD. La empresa se importa sin país. |
| `PROVINCIA_NOT_FOUND` | WARNING | Provincia no encontrada para el país dado. La empresa se importa sin provincia. |
| `PROVINCIA_NO_PAIS` | WARNING | Provincia indicada pero país no resuelto. La empresa se importa sin provincia. |
| `EXISTING_ENTITY` | INFO | La entidad ya existe y se actualizará. |
| `AUTO_EMPRESA` | INFO | Se crearía una empresa nueva al importar este contacto. |
| `AUTO_CARGO` | INFO | Se detecta un cargo nuevo que se crearía. |
| `AUTO_CAMPAIGN` | INFO | Se detecta una campaña nueva que se crearía. |
| `ROW_CONSOLIDATED` | INFO | Esta fila fue fusionada con otra dentro del mismo archivo. |
