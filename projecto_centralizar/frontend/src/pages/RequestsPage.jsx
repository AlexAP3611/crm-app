/**
 * RequestsPage — Página de gestión de solicitudes de acceso al CRM.
 *
 * Muestra una tabla con las solicitudes de acceso enviadas por usuarios
 * externos, permitiendo al administrador aprobar o rechazar cada una.
 *
 * ══ TOGGLE DE FILTRADO (pending/all) ══
 * La página incluye un toggle visual con dos opciones:
 *   - "Pendientes" (predeterminado): solo muestra solicitudes con status = 'pending'
 *   - "Todas": muestra todas las solicitudes (pending, approved, rejected)
 *
 * ¿Cómo funciona el filtrado?
 *   1. Se obtiene la lista COMPLETA de solicitudes desde GET /api/requests
 *   2. Se almacena en el estado `allRequests` (sin filtrar)
 *   3. Se calcula `filteredRequests` derivando de `allRequests` según el toggle
 *   4. La tabla renderiza `filteredRequests`
 *
 * ¿Por qué filtrar en frontend y no en backend?
 *   - La cantidad de solicitudes es típicamente baja (decenas, no miles)
 *   - Filtrar en frontend evita llamadas adicionales al cambiar el toggle
 *   - El toggle cambia instantáneamente sin latencia de red
 *   - El backend ya soporta el param `status_filter` para eficiencia futura
 *
 * Integración con backend:
 * - GET  /api/requests              → Carga la lista completa de solicitudes
 * - POST /api/requests/{id}/approve → Aprueba una solicitud pendiente
 * - POST /api/requests/{id}/reject  → Rechaza una solicitud pendiente
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api/client'

/**
 * Formatea una fecha ISO 8601 a formato legible en español.
 * Ejemplo: "06/04/2026, 13:30"
 *
 * @param {string} isoString - Fecha en formato ISO 8601
 * @returns {string} Fecha formateada en dd/mm/yyyy, hh:mm
 */
function formatDate(isoString) {
    const date = new Date(isoString)
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

/**
 * Badge visual para mostrar el estado de una solicitud.
 * Usa colores diferentes para cada estado:
 *   - pending  → amarillo (badge-warning)
 *   - approved → verde (badge-accent)
 *   - rejected → rojo (badge-danger)
 *
 * @param {Object} props
 * @param {string} props.status - Estado de la solicitud
 */
function StatusBadge({ status }) {
    const map = {
        pending: { label: 'Pendiente', className: 'badge badge-warning' },
        approved: { label: 'Aprobado', className: 'badge badge-accent' },
        rejected: { label: 'Rechazado', className: 'badge badge-danger' },
    }
    const info = map[status] || map.pending
    return <span className={info.className}>{info.label}</span>
}

export default function RequestsPage() {
    // ── Estado del componente ──

    // Lista COMPLETA de solicitudes obtenida del backend (sin filtrar).
    // Se usa como fuente de datos para el filtrado en frontend.
    const [allRequests, setAllRequests] = useState([])

    // Controla el spinner de carga inicial
    const [loading, setLoading] = useState(true)

    // Mensaje de error (carga, aprobación o rechazo)
    const [error, setError] = useState(null)

    // ID de la solicitud que se está procesando (aprobar/rechazar)
    // Se usa para mostrar spinner en el botón correspondiente
    const [actionLoading, setActionLoading] = useState(null)

    // ══ TOGGLE DE FILTRADO ══
    // `showAll` controla qué solicitudes se muestran en la tabla:
    //   - false (predeterminado): solo muestra solicitudes con status = 'pending'
    //   - true: muestra TODAS las solicitudes sin importar su estado
    //
    // Al cambiar este valor, la tabla se actualiza instantáneamente
    // porque el filtrado se hace en frontend (no hay llamada al API).
    const [showAll, setShowAll] = useState(false)

    /**
     * Carga la lista COMPLETA de solicitudes desde el backend.
     * No aplica filtro de status — trae pending, approved y rejected.
     * El filtrado lo hace el frontend según el estado del toggle.
     */
    const fetchRequests = useCallback(async () => {
        setError(null)
        try {
            // Traemos TODAS las solicitudes del backend sin filtro
            // para poder filtrar en frontend según el toggle
            const data = await api.listRequests()
            setAllRequests(data.requests || [])
        } catch (err) {
            setError(err.message || 'Error al cargar solicitudes')
        } finally {
            setLoading(false)
        }
    }, [])

    // Cargar solicitudes al montar el componente
    useEffect(() => {
        fetchRequests()
    }, [fetchRequests])

    // ══ FILTRADO EN FRONTEND ══
    // `filteredRequests` es la lista derivada que se muestra en la tabla.
    // Se recalcula automáticamente cuando cambian `allRequests` o `showAll`.
    //
    // useMemo evita recalcular en cada render si las dependencias no cambiaron.
    // Para la cantidad típica de solicitudes (<100) esto es casi instantáneo.
    const filteredRequests = useMemo(() => {
        if (showAll) {
            // Mostrar TODAS las solicitudes sin filtrar
            return allRequests
        }
        // Mostrar solo las solicitudes pendientes (predeterminado)
        return allRequests.filter(req => req.status === 'pending')
    }, [allRequests, showAll])

    /**
     * Aprueba una solicitud de acceso.
     * Llama a POST /api/requests/{id}/approve y refresca la tabla.
     */
    const handleApprove = async (id) => {
        setActionLoading(id)
        setError(null)
        try {
            await api.approveRequest(id)
            // Refrescar la lista completa para obtener el nuevo estado
            await fetchRequests()
        } catch (err) {
            setError(err.message || 'Error al aprobar solicitud')
        } finally {
            setActionLoading(null)
        }
    }

    /**
     * Rechaza una solicitud de acceso.
     * Llama a POST /api/requests/{id}/reject y refresca la tabla.
     */
    const handleReject = async (id) => {
        setActionLoading(id)
        setError(null)
        try {
            await api.rejectRequest(id)
            // Refrescar la lista completa para obtener el nuevo estado
            await fetchRequests()
        } catch (err) {
            setError(err.message || 'Error al rechazar solicitud')
        } finally {
            setActionLoading(null)
        }
    }

    // Contadores para mostrar en el toggle
    // Permite al usuario saber cuántas solicitudes hay en cada categoría
    const pendingCount = allRequests.filter(r => r.status === 'pending').length
    const totalCount = allRequests.length

    return (
        <>
            {/* ── Título de la página ── */}
            <div className="page-title-wrap">
                <h1 className="page-title">Solicitudes de acceso</h1>
                <p className="page-subtitle">Gestiona las solicitudes de nuevos usuarios</p>
            </div>

            {/* ══ TOGGLE DE FILTRADO ══
                Dos botones estilo "pill" que permiten alternar entre:
                - "Pendientes": muestra solo solicitudes con status = 'pending'
                - "Todas": muestra todas las solicitudes

                El botón activo tiene clase 'active' para resaltarlo visualmente.
                Al hacer clic, se actualiza el estado `showAll` y la tabla
                se filtra instantáneamente sin llamar al backend. */}
            <div className="filter-toggle-group" id="requests-filter-toggle">
                <button
                    id="filter-pending"
                    className={`filter-toggle-btn${!showAll ? ' active' : ''}`}
                    onClick={() => setShowAll(false)}
                >
                    Pendientes ({pendingCount})
                </button>
                <button
                    id="filter-all"
                    className={`filter-toggle-btn${showAll ? ' active' : ''}`}
                    onClick={() => setShowAll(true)}
                >
                    Todas ({totalCount})
                </button>
            </div>

            {/* Mensajes de error */}
            {error && <div className="alert alert-error">{error}</div>}

            {/* ── Tabla de solicitudes ── */}
            <div className="card">
                <div className="table-wrap" style={{ border: 'none' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Fecha de solicitud</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Estado: Cargando — spinner centrado */}
                            {loading ? (
                                <tr>
                                    <td colSpan={4}>
                                        <div className="empty-state" style={{ padding: '60px 24px' }}>
                                            <div className="spinner"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                /* Estado: Sin resultados — mensaje adaptado al filtro activo */
                                <tr>
                                    <td colSpan={4}>
                                        <div className="empty-state" style={{ padding: '60px 24px' }}>
                                            <div className="empty-state-icon">📋</div>
                                            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>
                                                {showAll
                                                    ? 'No hay solicitudes registradas'
                                                    : 'No hay solicitudes pendientes'
                                                }
                                            </p>
                                            <p className="text-muted text-xs">
                                                {showAll
                                                    ? 'Aún no se ha recibido ninguna solicitud de acceso'
                                                    : 'Todas las solicitudes han sido procesadas'
                                                }
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                /* Estado: Con resultados — renderizar filas filtradas */
                                filteredRequests.map((req) => (
                                    <tr key={req.id}>
                                        {/* Celda Email */}
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{req.email}</span>
                                        </td>
                                        {/* Celda Fecha */}
                                        <td className="td-muted">
                                            {formatDate(req.requested_at)}
                                        </td>
                                        {/* Celda Estado — badge visual con color según status */}
                                        <td>
                                            <StatusBadge status={req.status} />
                                        </td>
                                        {/* Celda Acciones — botones solo para solicitudes pendientes */}
                                        <td>
                                            <div className="request-actions">
                                                {/* Los botones de Aprobar/Rechazar SOLO se muestran
                                                    para solicitudes en estado 'pending'.
                                                    Para solicitudes ya procesadas (approved/rejected),
                                                    se muestra un texto indicando que la acción fue completada. */}
                                                {req.status === 'pending' ? (
                                                    <>
                                                        <button
                                                            id={`approve-${req.id}`}
                                                            className="btn btn-sm btn-approve"
                                                            onClick={() => handleApprove(req.id)}
                                                            disabled={actionLoading === req.id}
                                                        >
                                                            {actionLoading === req.id ? '...' : '✓ Aprobar'}
                                                        </button>
                                                        <button
                                                            id={`reject-${req.id}`}
                                                            className="btn btn-sm btn-reject"
                                                            onClick={() => handleReject(req.id)}
                                                            disabled={actionLoading === req.id}
                                                        >
                                                            {actionLoading === req.id ? '...' : '✕ Rechazar'}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-muted text-xs" style={{ fontStyle: 'italic' }}>
                                                        Acción completada
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Contador de solicitudes mostradas ── */}
            {!loading && filteredRequests.length > 0 && (
                <div
                    style={{
                        marginTop: 8,
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                    }}
                >
                    Mostrando {filteredRequests.length} de {totalCount} solicitud{totalCount !== 1 ? 'es' : ''}
                </div>
            )}
        </>
    )
}
