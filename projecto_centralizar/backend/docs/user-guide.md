# Manual del Usuario del CRM

Bienvenido al manual funcional del CRM. Esta guía está diseñada para gestores, comerciales y cualquier usuario que necesite interactuar diariamente con la plataforma para gestionar empresas, contactos e importaciones.

---

## 1. Módulo de Empresas

Las empresas son el núcleo de nuestro CRM. Todos los contactos, sectores y campañas orbitan alrededor de las empresas.

### ¿Cómo crear una empresa?
1. Navega a la sección **Empresas** en el menú lateral.
2. Haz clic en el botón **"Nueva Empresa"**.
3. Rellena los campos mínimos:
   - **Nombre:** (Obligatorio) El nombre comercial de la empresa.
   - **CIF / Web:** Muy recomendables para evitar duplicados en el futuro.
4. Asigna **Sectores**, **Verticales** y **Productos** según corresponda. Puedes seleccionar varios en cada categoría.
5. Haz clic en **Crear Empresa**.

### ¿Qué significa cada campo M2M?
- **Sector:** La industria macro a la que pertenece la empresa (Ej: *Tecnología*, *Retail*).
- **Vertical:** El nicho de mercado específico (Ej: *SaaS B2B*, *E-commerce de moda*).
- **Producto:** Qué producto o servicio clave ofrece o consume la empresa.

### Editar y eliminar
- Para **editar**, haz clic sobre los puntos suspensivos en la fila de la empresa que quieres editar, selecciona la opción editar. 
- La eliminación de una empresa solo se puede hacer si una empresa no tiene contactos asociados. Si una empresa tiene contactos asociados, no se podrá eliminar.

---

## 2. Módulo de Contactos

Los contactos representan a las personas con las que hablamos.

### ¿Cómo crear un contacto?
1. Navega a **Contactos** y pulsa **"Nuevo Contacto"**.
2. Los campos clave para evitar crear duplicados son: **Email**, **URL de LinkedIn** y **Teléfono**. Intenta rellenar siempre al menos uno de ellos.
3. **Vincular a Empresa:** En el campo *Empresa*, busca el nombre de la empresa a la que pertenece. Si la empresa no existe, el sistema te permitirá crearla automáticamente al vuelo.
4. **Cargo:** Escribe el nombre del cargo. El sistema automáticamente lo normalizará (ej. si escribes `C.E.O.`, se guardará como `Chief Executive Officer`).

### Asignar Campañas
Desde la ficha del contacto, puedes ver la sección de **Campañas**. Esto indica en qué acciones de marketing o flujos automatizados está incluido actualmente el contacto.

---

## 3. Módulo de Importaciones (CSV / Excel)

Importar datos en masa es una de las tareas más comunes. El sistema tiene un mecanismo de seguridad de dos pasos para que nunca rompas la base de datos por error.

### Paso 1: Modo "Preview" (Vista Previa)
1. Ve a la sección **Importar**.
2. Selecciona si vas a importar *Empresas* o *Contactos*.
3. Sube tu archivo `.csv` o `.xlsx`.
4. El sistema leerá el archivo **sin guardar nada** y te devolverá un informe:
   - **Nuevos:** Cuántas entidades se crearán.
   - **Actualizados:** Cuántos ya existen y solo se enriquecerán con nuevos datos.
   - **Errores:** Filas que fallarían (ej. falta de email).

### Paso 2: Importar ("Commit")
Si estás de acuerdo con el informe del *Preview*, pulsa **Confirmar Importación**. 
> **Nota:** Nuestro sistema aplica una "Actualización No Destructiva". Si en tu Excel una columna está vacía, el CRM **no borrará** el dato que ya existía previamente en la base de datos para esa celda.

### Errores normales en la importación
- **`MISSING_IDENTITY` (Bloqueante):** Tu fila no tiene Email, LinkedIn ni Teléfono. El CRM no sabe quién es y se negará a importarlo.
- **`ROW_CONSOLIDATED` (Aviso):** Significa que tenías dos filas repetidas en tu Excel. El CRM las ha fusionado de manera inteligente antes de guardarlas.

---

## 4. Cargos y Categorías

La configuración de estos elementos se gestiona desde el modulo de **Segmentación**.

### ¿Cómo crear una categoría?
1. Ve a **Segmentación**.
2. En la seccion de categoria de cargo clica el boton de crear categoria.
3. Escribe el nombre de la categoria y pulsa enter.
4. El crm se encarga de normalizar el nombre introducido para evitar duplicados.

### ¿Cómo asociar cargos a categorías?
En la lista de cargos selecciona la categoría a la que quieres que pertenezca ese cargo

---

## 5. Verticales, Sectores y Productos
Las verticales, sectores y productos son elementos que se utilizan para clasificar las empresas. La configuración de estos elementos se gestiona desde el modulo de **Segmentación**.

### ¿Cómo crear estos elementos?
1. Ve a **Segmentacion**
2. En las secciones de verticales, sectores y productos cada seccion tiene un boton para crear estos elementos. 
3. Clica el boton para crear el elemento.
4. Introduce el nombre y pulsa enter para crearlo.  
5. El elemento está listo para ser utilizado con empresas.

---

## 6. Errores Frecuentes y Soluciones Rápidas

- **"Empresa duplicada" al crear a mano:** El CRM no permite crear dos empresas con el mismo nombre, CIF o Web. Busca la empresa en el listado; alguien ya la creó antes que tú.
- **"Cargo no encontrado":** Escribe el cargo y pulsa *Enter*. El sistema creará el cargo al instante si es la primera vez que alguien lo escribe.
- **"Importación Parcial":** Significa que tu CSV tenía 100 filas, 95 estaban perfectas y 5 tenían errores críticos. Las 95 se guardaron con éxito. Solo tienes que corregir las 5 malas en tu Excel y volver a subirlo (las otras 95 no se duplicarán gracias a la actualización no destructiva).
