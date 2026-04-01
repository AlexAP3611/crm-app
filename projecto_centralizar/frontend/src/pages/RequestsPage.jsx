import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

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
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionLoading, setActionLoading] = useState(null) // id of request being actioned

    const fetchRequests = useCallback(async () => {
        setError(null)
        try {
            const data = await api.listRequests()
            setRequests(data.requests || [])
        } catch (err) {
            setError(err.message || 'Error al cargar solicitudes')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRequests()
    }, [fetchRequests])

    const handleApprove = async (id) => {
        setActionLoading(id)
        setError(null)
        try {
            await api.approveRequest(id)
            // Refresh the list to get updated status
            await fetchRequests()
        } catch (err) {
            setError(err.message || 'Error al aprobar solicitud')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (id) => {
        setActionLoading(id)
        setError(null)
        try {
            await api.rejectRequest(id)
            await fetchRequests()
        } catch (err) {
            setError(err.message || 'Error al rechazar solicitud')
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <>
            {/* Page Title */}
            <div className="page-title-wrap">
                <h1 className="page-title">Solicitudes de acceso</h1>
                <p className="page-subtitle">Gestiona las solicitudes de nuevos usuarios</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Requests Table */}
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
                            {loading ? (
                                <tr>
                                    <td colSpan={4}>
                                        <div className="empty-state" style={{ padding: '60px 24px' }}>
                                            <div className="spinner"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={4}>
                                        <div className="empty-state" style={{ padding: '60px 24px' }}>
                                            <div className="empty-state-icon">📋</div>
                                            <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>
                                                No hay solicitudes pendientes
                                            </p>
                                            <p className="text-muted text-xs">
                                                Las solicitudes de nuevos usuarios aparecerán aquí
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req.id}>
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{req.email}</span>
                                        </td>
                                        <td className="td-muted">
                                            {formatDate(req.requested_at)}
                                        </td>
                                        <td>
                                            <StatusBadge status={req.status} />
                                        </td>
                                        <td>
                                            <div className="request-actions">
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
        </>
    )
}
