// The single source of truth globally governing Modals, Tables, and Data-entry.
export const CONTACT_COLUMNS = [
    { key: "company", label: "Empresa", type: "string", required: true },
    { key: "first_name", label: "Nombre", type: "string" },
    { key: "last_name", label: "Apellido", type: "string" },
    { key: "cargos", label: "Cargos", type: "m2m", id_key: "cargo_ids" },
    //{ key: "job_title", label: "Título de Trabajo", type: "string" },
    { key: "cif", label: "CIF", type: "string" },
    { key: "dominio", label: "Dominio", type: "link" },
    { key: "linkedin", label: "LinkedIn", type: "link" },
    { key: "email_generic", label: "Email (Genérico)", type: "string" },
    { key: "email_contact", label: "Email (Contacto)", type: "string", modalOnly: true },
    { key: "phone", label: "Teléfono", type: "string" },
    { key: "sectors", label: "Sectores", type: "m2m", id_key: "sector_ids" },
    { key: "verticals", label: "Verticales", type: "m2m", id_key: "vertical_ids" },
    { key: "products_rel", label: "Productos", type: "m2m", id_key: "product_ids" },
    { key: "campaigns", label: "Campañas", type: "m2m", id_key: "campaign_ids" }
]
