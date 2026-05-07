import React, { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

// ── Cleanup Confirmation Modal ──────────────────────────────────────────────
function ConfirmCleanupModal({ tab, retentionDays, setRetentionDays, loading, onConfirm, onCancel }) {
    const tabLabel = tab === "integrations" ? "integraciones" : "auditoría";
    return (
        <div
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4"
            onClick={onCancel}
        >
            <div
                className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-rose-600 text-lg">delete_sweep</span>
                        </div>
                        <h2 className="font-display text-lg font-bold text-stone-900">Limpiar registros antiguos</h2>
                    </div>
                    <button className="text-stone-400 hover:text-stone-600 transition-colors" onClick={onCancel}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <p className="text-stone-600 text-sm leading-relaxed">
                        Se eliminarán todos los registros de <strong className="text-stone-900">{tabLabel}</strong> con
                        más antigüedad que el período de retención seleccionado. Esta acción <strong className="text-rose-700">no se puede deshacer</strong>.
                    </p>

                    {/* Retention selector */}
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500">
                            Eliminar registros anteriores a
                        </label>
                        <div className="flex gap-2">
                            {[30, 60, 90].map(days => (
                                <button
                                    key={days}
                                    onClick={() => setRetentionDays(days)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                                        retentionDays === days
                                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                            : 'bg-white text-stone-600 border-stone-200 hover:border-rose-300 hover:text-rose-700'
                                    }`}
                                >
                                    {days} días
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-stone-400 leading-snug pt-1">
                            Se conservarán todos los registros de los últimos <strong>{retentionDays} días</strong>.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-surface-container-low border-t border-stone-100 flex justify-end gap-3">
                    <button
                        className="px-4 py-2 font-medium text-stone-600 hover:bg-stone-200 rounded-lg text-sm transition-colors"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {loading ? 'hourglass_empty' : 'delete_sweep'}
                        </span>
                        {loading ? 'Limpiando…' : 'Confirmar limpieza'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ActivityPage() {
    const [activeTab, setActiveTab] = useState("integrations"); // "integrations" | "audit"
    const [integrationLogs, setIntegrationLogs] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 15;

    const [expandedRow, setExpandedRow] = useState(null);

    // ── Cleanup state ──
    const [showCleanupModal, setShowCleanupModal] = useState(false);
    const [retentionDays, setRetentionDays] = useState(90);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const loadLogs = useCallback(async () => {
        try {
            setLoading(true);
            if (activeTab === "integrations") {
                const res = await api.listIntegrationLogs(page, pageSize);
                setIntegrationLogs(res.items);
                setTotal(res.total);
            } else {
                const res = await api.listAuditLogs(page, pageSize);
                setAuditLogs(res.items);
                setTotal(res.total);
            }
        } catch (err) {
            console.error("Error loading logs:", err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, page]);

    useEffect(() => {
        loadLogs();
        setExpandedRow(null);
    }, [loadLogs]);

    const handleCleanup = async () => {
        setCleanupLoading(true);
        setSuccessMsg('');
        setErrorMsg('');
        try {
            const res = activeTab === "integrations"
                ? await api.cleanupIntegrationLogs(retentionDays)
                : await api.cleanupAuditLogs(retentionDays);

            setShowCleanupModal(false);
            setSuccessMsg(res.message);
            setTimeout(() => setSuccessMsg(''), 5000);

            // Reset to page 1 — the useEffect will trigger loadLogs() automatically
            // when the new loadLogs (which depends on page) is created after re-render.
            setPage(1);
        } catch (err) {
            setShowCleanupModal(false);
            setErrorMsg(err.message || 'Error al limpiar los registros');
            setTimeout(() => setErrorMsg(''), 5000);
        } finally {
            setCleanupLoading(false);
        }
    };

    const formatTime = (dateStr) => {
        return new Date(dateStr).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status) => {
        const base = "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ";
        switch (status?.toLowerCase()) {
            case "success": return <span className={base + "bg-emerald-100 text-emerald-700"}>Éxito</span>;
            case "failed": return <span className={base + "bg-rose-100 text-rose-700"}>Fallido</span>;
            case "pending": return <span className={base + "bg-amber-100 text-amber-700"}>Pendiente</span>;
            default: return <span className={base + "bg-stone-100 text-stone-600"}>{status}</span>;
        }
    };

    return (
        <div className="main-content">
            <header className="page-title-wrap mb-8">
                <h1 className="page-title">Actividad del Sistema</h1>
                <p className="text-muted text-sm mt-1">Supervisión técnica y auditoría de acciones del CRM.</p>
            </header>

            {/* Feedback banners */}
            {successMsg && (
                <div className="mb-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium">
                    <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                    {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="mb-4 flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm font-medium">
                    <span className="material-symbols-outlined text-rose-500 text-lg">error</span>
                    {errorMsg}
                </div>
            )}

            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-stone-200/40">
                {/* Tab Header */}
                <div className="px-6 py-4 flex items-center justify-between bg-surface-container-low/50 border-b border-stone-200/20">
                    <div className="flex gap-4">
                        <button
                            onClick={() => { setActiveTab("integrations"); setPage(1); }}
                            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm border-0 active:scale-95 outline-none focus:outline-none focus:ring-2 focus:ring-primary/40 ${activeTab === "integrations" ? 'bg-primary text-white shadow-primary/20' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
                        >
                            <span className="material-symbols-outlined text-lg">sync_alt</span>
                            Integraciones
                        </button>
                        <button
                            onClick={() => { setActiveTab("audit"); setPage(1); }}
                            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm border-0 active:scale-95 outline-none focus:outline-none focus:ring-2 focus:ring-primary/40 ${activeTab === "audit" ? 'bg-primary text-white shadow-primary/20' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
                        >
                            <span className="material-symbols-outlined text-lg">history</span>
                            Auditoría
                        </button>
                    </div>

                    {/* Cleanup button */}
                    <button
                        onClick={() => { setRetentionDays(90); setShowCleanupModal(true); }}
                        className="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95 outline-none focus:outline-none focus:ring-2 focus:ring-rose-300 shadow-sm"
                        title="Eliminar registros antiguos"
                    >
                        <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                        Limpiar logs
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            {activeTab === "integrations" ? (
                                <tr className="bg-surface-container-low border-b border-stone-200/40">
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Fecha</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Usuario</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Herramienta</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Estado</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Métricas</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Acción</th>
                                </tr>
                            ) : (
                                <tr className="bg-surface-container-low border-b border-stone-200/40">
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Fecha</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Usuario</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Acción</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Detalles</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-surface-container-low">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-20 italic text-stone-400">Cargando registros...</td>
                                </tr>
                            ) : activeTab === "integrations" ? (
                                integrationLogs.length > 0 ? integrationLogs.map(log => (
                                    <React.Fragment key={log.run_id}>
                                        <tr className="hover:bg-stone-50 transition-colors group">
                                            <td className="py-5 px-6 text-sm text-stone-500">{formatTime(log.created_at)}</td>
                                            <td className="py-5 px-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-on-surface">{log.user?.email || 'Sistema'}</span>
                                                    <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">ID: {log.user_id || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                                                    <span className="font-headline font-bold text-cyan-800 tracking-tight">{log.tool}</span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6">{getStatusBadge(log.status)}</td>
                                            <td className="py-5 px-6 font-mono text-[11px] text-stone-600">
                                                {log.metrics ? (
                                                    <div className="flex gap-3">
                                                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">list_alt</span> {log.metrics.total || 0}</span>
                                                        <span className="flex items-center gap-1 text-emerald-600 font-bold"><span className="material-symbols-outlined text-[14px]">check</span> {log.metrics.sent || 0}</span>
                                                        {log.metrics.duration_ms && <span className="text-stone-400 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">timer</span> {log.metrics.duration_ms}ms</span>}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="py-5 px-6">
                                                {log.error_log && (
                                                    <button
                                                        onClick={() => setExpandedRow(expandedRow === log.run_id ? null : log.run_id)}
                                                        className="bg-transparent border-0 text-primary text-[10px] font-bold uppercase tracking-widest hover:underline cursor-pointer flex items-center gap-1"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {expandedRow === log.run_id ? 'keyboard_arrow_up' : 'warning'}
                                                        </span>
                                                        {expandedRow === log.run_id ? 'Cerrar' : 'Ver Error'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedRow === log.run_id && (
                                            <tr className="bg-rose-50/30">
                                                <td colSpan="6" className="py-6 px-12 border-l-4 border-rose-500">
                                                    <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-rose-100 shadow-sm">
                                                        <p className="text-[11px] font-mono text-rose-900 break-all whitespace-pre-wrap leading-relaxed">
                                                            {log.error_log}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )) : (
                                    <tr><td colSpan="6" className="text-center py-20 text-stone-400">No hay registros de integración.</td></tr>
                                )
                            ) : (
                                auditLogs.length > 0 ? auditLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                                        <td className="py-5 px-6 text-sm text-stone-500">{formatTime(log.created_at)}</td>
                                        <td className="py-5 px-6 font-bold text-sm text-on-surface">{log.user?.email || 'Anónimo'}</td>
                                        <td className="py-5 px-6">
                                            <span className="px-3 py-1 bg-stone-100 text-stone-700 text-[11px] font-bold rounded-lg uppercase tracking-wide border border-stone-200/50">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="py-5 px-6 font-mono text-[10px] text-stone-400 max-w-[400px] truncate">
                                            {JSON.stringify(log.metadata || {})}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="4" className="text-center py-20 text-stone-400">No hay registros de auditoría.</td></tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 bg-surface-container-low border-t border-stone-200/40 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Mostrando página {page} • {total} total</span>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1 || loading}
                            onClick={() => setPage(p => p - 1)}
                            className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-600 disabled:opacity-30 hover:bg-stone-50 hover:text-stone-900 transition-all active:scale-95 shadow-sm"
                        >
                            Anterior
                        </button>
                        <button
                            disabled={page * pageSize >= total || loading}
                            onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-600 disabled:opacity-30 hover:bg-stone-50 hover:text-stone-900 transition-all active:scale-95 shadow-sm"
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            </div>

            {/* Cleanup Modal */}
            {showCleanupModal && (
                <ConfirmCleanupModal
                    tab={activeTab}
                    retentionDays={retentionDays}
                    setRetentionDays={setRetentionDays}
                    loading={cleanupLoading}
                    onConfirm={handleCleanup}
                    onCancel={() => setShowCleanupModal(false)}
                />
            )}
        </div>
    );
}
