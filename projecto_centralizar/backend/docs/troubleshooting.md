# Resolución de Problemas (Troubleshooting)

Este documento centraliza los problemas comunes encontrados en el CRM y cómo resolverlos rápidamente, ahorrando tiempo de depuración en la base de datos o en FastAPI.

## Problemas de Importación (ETL)

### 1. Falla el Import (`status="error"`) y dice `MISSING_IDENTITY`
**Por qué pasa:** Estás intentando importar un Contacto que no tiene Email, LinkedIn ni Teléfono. El CRM no puede identificarlo ni buscar duplicados.
**Solución:** Rellena al menos uno de esos 3 campos en tu Excel.

### 2. Un import masivo de 10.000 filas se quedó "colgado" o fue muy lento
**Por qué pasa:** Procesar 10.000 filas haciendo *upserts* y guardados relacionales es pesado.
**Solución:** Parte el CSV en bloques de 2.000 - 3.000 filas. El proceso de importación usa *savepoints* por fila, por lo que puedes detenerlo sin miedo a que la BD quede corrupta.

### 3. "Importación parcial" (Success > 0, Failed > 0)
**Por qué pasa:** Algunas filas violaban reglas de negocio estrictas (ej: nombre de empresa demasiado corto o tipo de dato inválido), pero el resto estaban bien.
**Solución:** No subas el archivo entero otra vez (aunque si lo haces no pasa nada por la idempotencia). Abre el log de la UI, mira en qué línea de Excel falló, corrígelo y sube solo esas líneas.

## Problemas de Lógica de Negocio

### 1. Tengo un contacto "duplicado" en la base de datos, ¿por qué?
**Por qué pasa:** 
- El Contacto A se creó con `email: juan@empresa.com`.
- El Contacto B se creó con `linkedin: linkedin.com/in/juan` (sin email).
Como el sistema prioriza primero el Email y luego LinkedIn para hacer *matching*, al importar a la persona B no encontró el email y creó una entidad nueva.
**Solución:** Los sistemas automáticos no pueden cruzar identidades a ciegas. Tienes que fusionarlos manualmente o actualizar la ficha de uno de ellos y borrar el otro.

### 2. Creé una Categoría de Cargo y los contactos no aparecen en ella
**Por qué pasa:** La asignación no es mágica. La Categoría de Cargo se nutre de los `Cargos` hijos.
**Solución:** Ve a *Configuración > Categorías de Cargo* y asegúrate de haber mapeado los cargos reales (ej: "CTO", "Director") dentro de esa categoría.

### 3. n8n está reescribiendo los emails o teléfonos con datos vacíos
**Por qué pasa:** No debería pasar. Nuestro CRM usa *Upserts No Destructivos*. Si ocurre, es porque n8n está enviando explícitamente un string que no está vacío (ej: `" "`, `"null"` en formato string en lugar del tipo null lógico).
**Solución:** Ajusta el nodo de n8n para que mande el objeto JSON limpio o estrictamente `null` en lugar de strings basura.

## Problemas de Entorno (Desarrolladores)

### 1. La migración de Alembic dice "Target database is not up to date"
**Por qué pasa:** Alguien modificó el esquema de la BD directamente, o tu rama local no tiene la última migración aplicada.
**Solución:**
```bash
# Sincroniza tu BD local a la última versión
alembic upgrade head
```

### 2. Error 401 (Unauthorized) al probar endpoints en local
**Por qué pasa:** Te falta el JWT o ha caducado.
**Solución:** Ejecuta el login vía Swagger (`/docs` -> botón Authorize) o genera una API Key temporal y úsala pasándola en los headers de Postman/curl.

### 3. Incompatibilidad de Passlib con Bcrypt
**Por qué pasa:** En 2024 `bcrypt` lanzó la versión >4.1 que rompió la compatibilidad con `passlib` (la librería que usamos para hashear passwords).
**Solución:** Asegúrate de que tu `requirements.txt` tiene fijado `bcrypt==4.0.1`. No lo actualices a la ligera.
