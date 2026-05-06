import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api/client'

function formatDate(isoString) {
    const date = new Date(isoString)
    return {
        dateStr: date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
        timeStr: date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    }
}

function StatusBadge({ status }) {
    if (status === 'pending') {
        return (
            <span className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Pendiente
            </span>
        )
    }
    if (status === 'approved') {
        return (
            <span className="px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Aprobada
            </span>
        )
    }
    return (
        <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            Rechazada
        </span>
    )
}

export default function RequestsPage() {
    const [allRequests, setAllRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionLoading, setActionLoading] = useState(null)
    const [showAll, setShowAll] = useState(false)

    const fetchRequests = useCallback(async () => {
        setError(null)
        try {
            const data = await api.listRequests()
            setAllRequests(data.items || [])
        } catch (err) {
            setError(err.message || 'Error al cargar solicitudes')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchRequests() }, [fetchRequests])

    const filteredRequests = useMemo(() => {
        if (showAll) return allRequests;
        return allRequests.filter(req => req.status === 'pending')
    }, [allRequests, showAll])

    const handleApprove = async (id) => {
        setActionLoading(id)
        setError(null)
        try {
            await api.approveRequest(id)
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

    const pendingCount = allRequests.filter(r => r.status === 'pending').length
    const processedCount = allRequests.filter(r => r.status !== 'pending').length
    const totalCount = allRequests.length

    return (
        <div className="p-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Solicitudes</h2>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => fetchRequests()} className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95">
                        <span className="material-symbols-outlined text-lg">sync</span>
                        Actualizar
                    </button>
                </div>
            </div>

            {error && <div className="bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium">{error}</div>}

            {/* Main Requests Table */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-stone-200/50">
                <div className="px-6 py-4 flex items-center justify-between bg-surface-container-low/50">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowAll(false)}
                            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm border-0 active:scale-95 outline-none focus:outline-none focus:ring-2 focus:ring-primary/40 ${!showAll ? 'bg-primary text-white shadow-primary/20' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
                        >
                            <span className="material-symbols-outlined text-lg">pending_actions</span>
                            Pendientes
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${!showAll ? 'bg-white/20 text-white' : 'bg-stone-200/50 text-stone-500'}`}>{pendingCount}</span>
                        </button>
                        <button
                            onClick={() => setShowAll(true)}
                            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm border-0 active:scale-95 outline-none focus:outline-none focus:ring-2 focus:ring-primary/40 ${showAll ? 'bg-primary text-white shadow-primary/20' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
                        >
                            <span className="material-symbols-outlined text-lg">history</span>
                            Historial
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${showAll ? 'bg-white/20 text-white' : 'bg-stone-200/50 text-stone-500'}`}>{totalCount}</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-container-low">
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Solicitante</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Estado</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Fecha</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right whitespace-nowrap">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container-low">
                            {loading ? (
                                <tr><td colSpan="4" className="py-20 text-center text-stone-400">Cargando solicitudes...</td></tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan="4">
                                        <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
                                            <span className="material-symbols-outlined text-4xl">inbox</span>
                                            <span className="font-medium text-sm text-stone-500">
                                                {showAll ? 'No se encontraron solicitudes.' : '¡Todo al día! No hay solicitudes pendientes.'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRequests.map(req => {
                                const { dateStr, timeStr } = formatDate(req.requested_at);
                                const isPending = req.status === 'pending';
                                return (
                                    <tr key={req.id} className="hover:bg-surface-container-low/30 transition-colors group">
                                        <td className="py-5 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-primary text-xs uppercase">
                                                    {req.email.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-on-surface text-sm">{req.email.split('@')[0]}</div>
                                                    <div className="text-[10px] text-stone-400 font-medium">{req.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5 px-6">
                                            <StatusBadge status={req.status} />
                                        </td>
                                        <td className="py-5 px-6">
                                            <div className="text-sm text-on-surface font-medium">{dateStr}</div>
                                            <div className="text-[10px] text-stone-400">{timeStr}</div>
                                        </td>
                                        <td className="py-5 px-6 text-right">
                                            {isPending ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApprove(req.id)}
                                                        disabled={actionLoading === req.id}
                                                        className="px-4 py-2 bg-primary/5 border border-primary/20 text-primary font-bold text-xs rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                                        {actionLoading === req.id ? '...' : 'Aprobar'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(req.id)}
                                                        disabled={actionLoading === req.id}
                                                        className="px-4 py-2 bg-error/5 border border-error/20 text-error font-bold text-xs rounded-lg hover:bg-error/10 transition-colors flex items-center gap-1.5"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">cancel</span>
                                                        {actionLoading === req.id ? '...' : 'Rechazar'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] font-bold text-stone-400 italic flex items-center justify-end gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                    Procesada
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 bg-surface-container-low/50 flex items-center justify-between border-t border-stone-100">
                    <p className="text-xs font-medium text-stone-500">Mostrando {filteredRequests.length} solicitudes</p>
                </div>
            </div>
        </div>
    )
}
