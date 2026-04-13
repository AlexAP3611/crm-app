const BASE_URL = '/api'
const TOKEN_KEY = 'crm_access_token'

async function request(path, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY)
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {}

    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json', ...authHeaders, ...options.headers },
        credentials: 'include',
        ...options,
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        const detail = err.detail
        const msg = typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
                ? detail.map((d) => d.msg ?? JSON.stringify(d)).join('; ')
                : JSON.stringify(detail) || 'Request failed'
        throw new Error(msg)
    }
    if (res.status === 204) return null
    return res.json()
}

const PREFIX = '/master-data'

export const masterDataApi = {
    // Sectors
    getSectors: () => request(`${PREFIX}/sectors`),
    createSector: (payload) => request(`${PREFIX}/sectors`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteSector: (id) => request(`${PREFIX}/sectors/${id}`, { method: 'DELETE' }),

    // Verticals
    getVerticals: () => request(`${PREFIX}/verticals`),
    createVertical: (payload) => request(`${PREFIX}/verticals`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteVertical: (id) => request(`${PREFIX}/verticals/${id}`, { method: 'DELETE' }),

    // Products
    getProducts: () => request(`${PREFIX}/products`),
    createProduct: (payload) => request(`${PREFIX}/products`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteProduct: (id) => request(`${PREFIX}/products/${id}`, { method: 'DELETE' }),

    // Cargos
    getCargos: () => request(`${PREFIX}/cargos`),
    createCargo: (payload) => request(`${PREFIX}/cargos`, { method: 'POST', body: JSON.stringify(payload) }),
    deleteCargo: (id) => request(`${PREFIX}/cargos/${id}`, { method: 'DELETE' }),

    // Campañas (uses /api/campaigns, not /api/master-data)
    getCampaigns: () => request('/campaigns'),
    createCampaign: (payload) => request('/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
    deleteCampaign: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),
}
