// The single source of truth globally governing Modals, Tables, and Data-entry.
export const CONTACT_COLUMNS = [
    { key: "cif", label: "CIF", type: "string", readonly: true },
    { key: "empresa", label: "Empresa", type: "string", required: true },
    { key: "first_name", label: "Nombre", type: "string" },
    { key: "last_name", label: "Apellido", type: "string" },
    { key: "cargo", label: "Cargo", type: "fk", id_key: "cargo_id" },
    //{ key: "job_title", label: "Título de Trabajo", type: "string" },
    { key: "web", label: "Web", type: "link", readonly: true },
    { key: "linkedin", label: "LinkedIn", type: "link" },
    { key: "email_generic", label: "Email (Genérico)", type: "string", readonly: true },
    { key: "email_contact", label: "Email (Contacto)", type: "string", modalOnly: true },
    { key: "phone_generic", label: "Teléfono (Genérico)", type: "string", readonly: true },
    { key: "phone_contact", label: "Teléfono (Contacto)", type: "string", modalOnly: true },
    { key: "sectors", label: "Sectores", type: "m2m", id_key: "sector_ids", readonly: true },
    { key: "verticals", label: "Verticales", type: "m2m", id_key: "vertical_ids", readonly: true },
    { key: "products_rel", label: "Productos", type: "m2m", id_key: "product_ids", readonly: true },
    { key: "campaigns", label: "Campañas", type: "m2m", id_key: "campaign_ids" }
]
