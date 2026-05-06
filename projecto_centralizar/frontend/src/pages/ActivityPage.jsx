import React, { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

export default function ActivityPage() {
    const [activeTab, setActiveTab] = useState("integrations"); // "integrations" | "audit"
    const [integrationLogs, setIntegrationLogs] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 15;

    const [expandedRow, setExpandedRow] = useState(null);

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
        </div>
    );
}
