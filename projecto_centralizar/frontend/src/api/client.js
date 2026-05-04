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
// INTERCEPTOR 401 — Handler global de sesión expirada
// ══════════════════════════════════════════════════════════════════════

/**
 * Función de callback que se ejecutará cuando el backend devuelva 401.
 * Se registra desde App.jsx para ejecutar el logout global.
 * El flag _loggingOut previene múltiples ejecuciones si varios
 * requests fallan simultáneamente con 401.
 */
let _unauthorizedHandler = null
let _loggingOut = false

/**
 * Registra el handler global para respuestas 401.
 * Debe llamarse una sola vez al montar AuthenticatedApp.
 *
 * @param {Function} handler - Función a ejecutar cuando se recibe 401
 */
export function setUnauthorizedHandler(handler) {
    _unauthorizedHandler = handler
    _loggingOut = false
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
async function request(path, { headers, signal, ...options } = {}) {
    // Construir headers con autenticación JWT automática
    // Si hay un token almacenado, se incluye en Authorization
    const authHeaders = {}
    const token = getToken()
    if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        credentials: 'include',   // Enviar cookies (compatibilidad con sesiones)
        signal,                   // Soporte para AbortController
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
        // ── Interceptor 401: sesión expirada o token inválido ──
        // Si el backend rechaza la petición con 401 y hay un handler registrado,
        // ejecutar el logout global (una sola vez, aunque varios requests fallen).
        if (res.status === 401 && _unauthorizedHandler && !_loggingOut) {
            _loggingOut = true
            // Ejecutar en el siguiente tick para no bloquear este flujo de error
            setTimeout(() => _unauthorizedHandler(), 0)
        }

        const err = await res.json().catch(() => ({ detail: res.statusText }))
        const detail = err.detail
        const msg = typeof detail === 'string'
            ? detail
            : Array.isArray(detail)
                ? detail.map((d) => d.msg ?? JSON.stringify(d)).join('; ')
                : JSON.stringify(detail) || 'Request failed'

        const error = new Error(msg)
        error.data = err // Attach structured error data for specialized handlers (e.g. enrichment validation)
        throw error
    }

    // 204 No Content — no hay body que parsear
    if (res.status === 204) return null
    return res.json()
}

/**
 * Build scope payload from current UI state.
 * ZERO resolution logic. ZERO data fetching. Pure data transform.
 *
 * - selectedIds exist → { ids: [...] }
 * - active filters exist → { filters: {...} } (stripped of page/page_size)
 * - neither → {} (backend will decide if this is allowed per endpoint)
 */
const NUMERIC_FIELDS = new Set([
    'sector_id',
    'vertical_id',
    'product_id',
    'numero_empleados_min',
    'numero_empleados_max',
    'facturacion_min',
    'facturacion_max',
    'cargo_id',
    'empresa_id',
    'campaign_id'
]);

const normalizeValue = (k, v) => {
    if (v === '' || v === null || v === undefined) return undefined;
    if (typeof v === 'string' && v.trim() !== '' && NUMERIC_FIELDS.has(k) && !isNaN(v)) {
        return Number(v);
    }
    return v;
}

export function buildScope(selectedIds, filters) {
    if (selectedIds.length > 0) {
        return { ids: selectedIds }
    }
    const { page, page_size, ...f } = filters

    // 🔥 Purga estricta y Normalización asimétrica (solo muta a Number lo listado en NUMERIC_FIELDS)
    const cleanFilters = Object.fromEntries(
        Object.entries(f).flatMap(([k, v]) => {
            const normalized = normalizeValue(k, v);
            return normalized === undefined ? [] : [[k, normalized]];
        })
    )

    if (Object.keys(cleanFilters).length > 0) {
        return { filters: cleanFilters }
    }

    // 🔥 CLAVE
    return { all: true }
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
        try {
            return await request('/logout', { method: 'POST' })
        } catch (_) {
            // Si el logout falla (token ya expirado), ignorar el error
            // — el token ya fue eliminado de localStorage
        }
    },
    // GET /api/me → { id, email, role }
    me: () => request('/me'),

    // ── Session keepalive ──
    // Renueva el JWT emitiendo uno nuevo desde el backend.
    // Solo funciona si el token actual aún no ha expirado.
    // POST /api/refresh → { access_token, token_type }
    refreshToken: async () => {
        const data = await request('/refresh', { method: 'POST' })
        if (data?.access_token) {
            setToken(data.access_token)
        }
        return data
    },

    // ── Contacts ──
    listContacts: (params = {}, signal = undefined) => {
        const qs = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ).toString()
        return request(`/contacts${qs ? `?${qs}` : ''}`, { signal })
    },
    getContact: (id) => request(`/contacts/${id}`),
    upsertContact: (data) => request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
    updateContact: (id, data) => request(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteContact: (id) => request(`/contacts/${id}`, { method: 'DELETE' }),
    deleteBulkContacts: (scope) => request('/contacts/bulk-delete', { method: 'POST', body: JSON.stringify(scope) }),
    updateBulkContacts: (scope, data) => request('/contacts/bulk-update', { method: 'POST', body: JSON.stringify({ ...scope, data }) }),

    // ── CSV ──
    exportCsvUrl: (params = {}) => {
        const qs = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ).toString()
        return `${BASE_URL}/csv/contacts/export${qs ? `?${qs}` : ''}`
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
        return fetch(`${BASE_URL}/csv/contacts/import`, {
            method: 'POST',
            body: form,
            credentials: 'include',
            headers: importHeaders,
        }).then((r) => r.json())
    },
    previewImportContacts: (file) => {
        const form = new FormData()
        form.append('file', file)
        const importHeaders = {}
        const token = getToken()
        if (token) {
            importHeaders['Authorization'] = `Bearer ${token}`
        }
        return fetch(`${BASE_URL}/csv/contacts/import/preview`, {
            method: 'POST',
            body: form,
            credentials: 'include',
            headers: importHeaders,
        }).then((r) => r.json())
    },
    previewImportEmpresas: (file) => {
        const form = new FormData()
        form.append('file', file)
        const importHeaders = {}
        const token = getToken()
        if (token) {
            importHeaders['Authorization'] = `Bearer ${token}`
        }
        return fetch(`${BASE_URL}/csv/empresas/import/preview`, {
            method: 'POST',
            body: form,
            credentials: 'include',
            headers: importHeaders,
        }).then((r) => r.json())
    },
    exportEmpresasCsvUrl: (params = {}) => {
        const qs = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
        ).toString()
        return `${BASE_URL}/csv/empresas/export${qs ? `?${qs}` : ''}`
    },
    importEmpresasCsv: (file) => {
        const form = new FormData()
        form.append('file', file)
        const importHeaders = {}
        const token = getToken()
        if (token) {
            importHeaders['Authorization'] = `Bearer ${token}`
        }
        return fetch(`${BASE_URL}/csv/empresas/import`, {
            method: 'POST',
            body: form,
            credentials: 'include',
            headers: importHeaders,
        }).then((r) => r.json())
    },

    // ── Lookup tables (Master Data) ──
    listSectors: () => request('/master-data/sectors'),
    createSector: (data) => request('/master-data/sectors', { method: 'POST', body: JSON.stringify(data) }),
    deleteSector: (id) => request(`/master-data/sectors/${id}`, { method: 'DELETE' }),
    listVerticals: () => request('/master-data/verticals'),
    createVertical: (data) => request('/master-data/verticals', { method: 'POST', body: JSON.stringify(data) }),
    deleteVertical: (id) => request(`/master-data/verticals/${id}`, { method: 'DELETE' }),
    listProducts: () => request('/master-data/products'),
    createProduct: (data) => request('/master-data/products', { method: 'POST', body: JSON.stringify(data) }),
    deleteProduct: (id) => request(`/master-data/products/${id}`, { method: 'DELETE' }),
    listCargos: () => request('/master-data/cargos'),
    createCargo: (data) => request('/master-data/cargos', { method: 'POST', body: JSON.stringify(data) }),
    deleteCargo: (id) => request(`/master-data/cargos/${id}`, { method: 'DELETE' }),

    // ── Campaigns ──
    listCampaigns: () => request('/campaigns'),
    getCampaign: (id) => request(`/campaigns/${id}`),
    createCampaign: (data) => request('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    updateCampaign: (id, data) => request(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCampaign: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),

    // ── Empresas ──
    listEmpresas: (params = {}, signal = undefined) => {
        const queryParams = new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined && v !== '' && v !== null)).toString();
        return request('/empresas' + (queryParams ? '?' + queryParams : ''), { signal });
    },
    createEmpresa: (data) => request('/empresas', { method: 'POST', body: JSON.stringify(data) }),
    updateEmpresa: (id, data) => request(`/empresas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getEmpresaContactos: (id, page = 1, limit = 50) => {
        const queryParams = new URLSearchParams({ page, limit, offset: (page - 1) * limit });
        return request(`/empresas/${id}/contactos?${queryParams.toString()}`);
    },
    deleteEmpresa: (id) => request(`/empresas/${id}`, { method: 'DELETE' }),
    deleteBulkEmpresas: (scope) => request('/empresas/bulk-delete', { method: 'POST', body: JSON.stringify(scope) }),
    updateBulkEmpresas: (scope, data) => request('/empresas/bulk-update', { method: 'POST', body: JSON.stringify({ ...scope, data }) }),
    assignEmpresaRelation: (empresaId, relationType, relationId) => request(`/empresas/${empresaId}/${relationType}/${relationId}`, { method: 'POST' }),
    unassignEmpresaRelation: (empresaId, relationType, relationId) => request(`/empresas/${empresaId}/${relationType}/${relationId}`, { method: 'DELETE' }),

    // ── Enrichment ──
    enrichContact: (id, source, data) =>
        request(`/enrichment/${id}`, { method: 'POST', body: JSON.stringify({ source, data }) }),

    enrichEmpresas: (data) =>
        request('/empresas/enrich', { method: 'POST', body: JSON.stringify(data) }),

    enrichContacts: (data) =>
        request('/contacts/enrich', { method: 'POST', body: JSON.stringify(data) }),

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

    // ── System ──
    getSettingsByPrefix: (prefix) => request(`/system/settings?prefix=${prefix}`),
    updateSystemSetting: (key, value) => request(`/system/settings/${key}`, { method: 'POST', body: JSON.stringify({ value }) }),
}
