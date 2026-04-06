/**
 * API Client — Módulo centralizado para todas las llamadas al backend.
 *
 * Este archivo contiene:
 * 1. Gestión de tokens JWT (almacenamiento, envío automático, limpieza)
 * 2. Función request() que añade headers de autenticación a cada petición
 * 3. Todas las funciones de la API organizadas por dominio
 *
 * Flujo de autenticación JWT:
 * 1. El usuario hace login → POST /api/login devuelve { access_token }
 * 2. Se almacena el token en localStorage
 * 3. Cada petición posterior incluye: Authorization: Bearer <token>
 * 4. Si el token expira, el backend retorna 401 y el frontend redirige al login
 *
 * ¿Por qué localStorage?
 * - Persiste entre recargas de página y pestañas
 * - Es más simple que cookies para APIs REST
 * - NOTA: En producción, considerar httpOnly cookies para mayor seguridad
 *
 * TODO futuro:
 * - Implementar interceptor de refresh token automático
 * - Añadir retry automático en errores 5xx
 * - Cache de respuestas frecuentes
 */

const BASE_URL = '/api'

// ══════════════════════════════════════════════════════════════════════
// TOKEN JWT — Almacenamiento y gestión
// ══════════════════════════════════════════════════════════════════════

/**
 * Clave de localStorage donde se almacena el token JWT.
 * Se usa una clave descriptiva para evitar colisiones con otros datos.
 */
const TOKEN_KEY = 'crm_access_token'

/**
 * Guarda el token JWT en localStorage.
 * Se llama después de un login exitoso.
 *
 * @param {string} token - Token JWT recibido del backend
 */
export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Obtiene el token JWT almacenado en localStorage.
 *
 * @returns {string|null} Token JWT o null si no existe
 */
export function getToken() {
    return localStorage.getItem(TOKEN_KEY)
}

/**
 * Elimina el token JWT de localStorage.
 * Se llama al hacer logout para limpiar la autenticación.
 */
export function removeToken() {
    localStorage.removeItem(TOKEN_KEY)
}


// ══════════════════════════════════════════════════════════════════════
// FUNCIÓN REQUEST — Wrapper centralizado para fetch
// ══════════════════════════════════════════════════════════════════════

/**
 * Realiza una petición HTTP al backend con autenticación automática.
 *
 * Características:
 * - Añade automáticamente el header Authorization: Bearer <token> si hay token
 * - Añade Content-Type: application/json por defecto
 * - Incluye credentials (cookies) para compatibilidad con sesiones
 * - Maneja errores del backend y los convierte en mensajes legibles
 *
 * @param {string} path    - Ruta relativa al API (ej: '/users')
 * @param {Object} options - Opciones de fetch (method, body, headers, etc.)
 * @returns {Promise<Object|null>} Respuesta JSON o null (204)
 * @throws {Error} Si la respuesta no es 2xx
 */
async function request(path, { headers, ...options } = {}) {
    // Construir headers con autenticación JWT automática
    // Si hay un token almacenado, se incluye en Authorization
    const authHeaders = {}
    const token = getToken()
    if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        credentials: 'include',   // Enviar cookies (compatibilidad con sesiones)
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders,        // Token JWT si existe
            ...headers,            // Headers adicionales del llamador
        },
    })

    // Manejo de errores HTTP
    // Extrae el detalle del error del body JSON del backend
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

    // 204 No Content — no hay body que parsear
    if (res.status === 204) return null
    return res.json()
}


// ══════════════════════════════════════════════════════════════════════
// API — Funciones organizadas por dominio
// ══════════════════════════════════════════════════════════════════════

export const api = {
    // ── Auth ──
    // login() almacena automáticamente el token JWT recibido
    // logout() limpia el token de localStorage
    login: async (email, password) => {
        // POST /api/login → { access_token, token_type }
        const data = await request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        })
        // Almacenar el token JWT recibido para futuras peticiones
        if (data.access_token) {
            setToken(data.access_token)
        }
        return data
    },
    logout: async () => {
        // Limpiar el token JWT del almacenamiento local
        removeToken()
        // También limpiar la sesión del servidor (cookie)
        return request('/logout', { method: 'POST' })
    },
    // GET /api/me → { id, email, role }
    me: () => request('/me'),

    // ── Contacts ──
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

    // ── CSV ──
    exportCsvUrl: (params = {}) => {
        const qs = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ).toString()
        return `${BASE_URL}/csv/export${qs ? `?${qs}` : ''}`
    },
    importCsv: (file) => {
        const form = new FormData()
        form.append('file', file)
        // importCsv usa fetch directo porque envía FormData, no JSON
        // Se incluye el token JWT manualmente en el header
        const importHeaders = {}
        const token = getToken()
        if (token) {
            importHeaders['Authorization'] = `Bearer ${token}`
        }
        return fetch(`${BASE_URL}/csv/import`, {
            method: 'POST',
            body: form,
            credentials: 'include',
            headers: importHeaders,
        }).then((r) => r.json())
    },

    // ── Lookup tables ──
    listSectors: () => request('/master-data/sectors'),
    createSector: (data) => request('/master-data/sectors', { method: 'POST', body: JSON.stringify(data) }),
    listVerticals: () => request('/master-data/verticals'),
    createVertical: (data) => request('/master-data/verticals', { method: 'POST', body: JSON.stringify(data) }),
    listProducts: () => request('/master-data/products'),
    listCargos: () => request('/master-data/cargos'),

    // ── Campaigns ──
    listCampaigns: () => request('/campaigns'),
    getCampaign: (id) => request(`/campaigns/${id}`),
    createCampaign: (data) => request('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    updateCampaign: (id, data) => request(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCampaign: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),

    // ── Enrichment ──
    enrichContact: (id, source, data) =>
        request(`/enrichment/${id}`, { method: 'POST', body: JSON.stringify({ source, data }) }),

    // ── Access Requests ──
    requestAccess: (email, password) =>
        request('/request-access', { method: 'POST', body: JSON.stringify({ email, password }) }),
    listRequests: () => request('/requests'),
    approveRequest: (id) => request(`/requests/${id}/approve`, { method: 'POST' }),
    rejectRequest: (id) => request(`/requests/${id}/reject`, { method: 'POST' }),

    // ── Users — Gestión de usuarios y roles ──
    // Consumido por UsersPage.jsx para listar usuarios y cambiar roles
    listUsers: () => request('/users'),
    updateUserRole: (id, role) =>
        request(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

    // ── Users — Eliminación lógica (soft delete) ──
    // Llama a DELETE /api/users/{id} en el backend.
    // NO elimina físicamente al usuario — cambia is_active a False.
    // Solo admins pueden ejecutar esta acción.
    // El backend registra la eliminación en la tabla de logs para auditoría.
    // Errores esperados del backend:
    //   - 404: Usuario no encontrado
    //   - 400: Auto-eliminación, último admin, o ya eliminado
    //   - 403: No es administrador
    deleteUser: (id) =>
        request(`/users/${id}`, { method: 'DELETE' }),

    // ── Settings — Cambio de contraseña ──
    // Accesible para todos los usuarios (admin y gestor).
    // El backend verifica la contraseña actual contra el hash bcrypt en DB,
    // hashea la nueva contraseña, y registra la acción en logs.
    changePassword: (currentPassword, newPassword) =>
        request('/change-password', {
            method: 'POST',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
            }),
        }),
}
