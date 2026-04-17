// The single source of truth globally governing Modals, Tables, and Data-entry.
export const CONTACT_COLUMNS = [
    { key: "empresa", label: "Empresa", type: "string", required: false },
    { key: "first_name", label: "Nombre", type: "string" },
    { key: "last_name", label: "Apellido", type: "string" },
    { key: "cargo", label: "Cargo", type: "fk", id_key: "cargo_id" },
    //{ key: "job_title", label: "Título de Trabajo", type: "string" },
    { key: "linkedin", label: "LinkedIn", type: "link" },
    { key: "email", label: "Email", type: "string", modalOnly: true },
    { key: "phone", label: "Teléfono", type: "string", modalOnly: true },
    { key: "sectors", label: "Sectores", type: "m2m", id_key: "sector_ids", readonly: true },
    { key: "verticals", label: "Verticales", type: "m2m", id_key: "vertical_ids", readonly: true },
    { key: "products_rel", label: "Productos", type: "m2m", id_key: "product_ids", readonly: true },
    { key: "campaigns", label: "Campañas", type: "m2m", id_key: "campaign_ids" }
]
