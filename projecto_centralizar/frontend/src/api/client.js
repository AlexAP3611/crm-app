const BASE_URL = '/api'

async function request(path, { headers, ...options } = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        credentials: 'include',
        ...options,
        headers: { 'Content-Type': 'application/json', ...headers },
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

// Contacts
export const api = {
    // Auth
    login: (email, password) => request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request('/logout', { method: 'POST' }),
    me: () => request('/me'),

    // Contacts
    listContacts: (params = {}) => {
        const qs = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ).toString()
        return request(`/contacts${qs ? `?${qs}` : ''}`)
    },
    getContact: (id) => request(`/contacts/${id}`),
    upsertContact: (data) => request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
    updateContact: (id, data) => request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),
    deleteBulkContacts: (data) => request('/contacts/bulk-delete', { method: 'POST', body: JSON.stringify(data) }),
    updateBulkContacts: (data) => request('/contacts/bulk-update', { method: 'POST', body: JSON.stringify(data) }),

    // CSV
    exportCsvUrl: (params = {}) => {
        const qs = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ).toString()
        return `${BASE_URL}/csv/export${qs ? `?${qs}` : ''}`
    },
    importCsv: (file) => {
        const form = new FormData()
        form.append('file', file)
        return fetch(`${BASE_URL}/csv/import`, { method: 'POST', body: form, credentials: 'include' }).then((r) => r.json())
    },

    // Lookup tables
    listSectors: () => request('/master-data/sectors'),
    createSector: (data) => request('/master-data/sectors', { method: 'POST', body: JSON.stringify(data) }),
    listVerticals: () => request('/master-data/verticals'),
    createVertical: (data) => request('/master-data/verticals', { method: 'POST', body: JSON.stringify(data) }),
    listProducts: () => request('/master-data/products'),
    listCargos: () => request('/master-data/cargos'),
    // Campaigns
    listCampaigns: () => request('/campaigns'),
    getCampaign: (id) => request(`/campaigns/${id}`),
    createCampaign: (data) => request('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    updateCampaign: (id, data) => request(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCampaign: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),

    // Enrichment
    enrichContact: (id, source, data) =>
        request(`/enrichment/${id}`, { method: 'POST', body: JSON.stringify({ source, data }) }),
}
