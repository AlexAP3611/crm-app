import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal de resultados de importación (Pipeline v3.1)
 * Muestra estadísticas globales y desglose de errores/warnings por fila.
 * Usa React Portals para renderizarse fuera del árbol del DOM del padre.
 */
export default function ImportResultModal({ report, isOpen, onClose, entityName = "Empresas", title = "Resumen de Importación" }) {
    if (!isOpen || !report) return null;

    const { summary, results } = report;

    // Filtramos filas que tengan algún problema (Error, Warning o Fusión)
    const problematicRows = results.filter(r =>
        r.status === 'error' ||
        (r.warnings && r.warnings.length > 0) ||
        r.action === 'merged'
    );

    const hasIssues = problematicRows.length > 0;

    const modalContent = (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose}></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-stone-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                    <div>
                        <h2 className="font-bold text-stone-900 text-xl">{title}</h2>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Feedback Detallado • {entityName}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-stone-200 text-stone-500 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-3 p-8 bg-white">
                    <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex flex-col items-center justify-center transition-transform hover:scale-105">
                        <span className="material-symbols-outlined text-green-500 mb-2">check_circle</span>
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Éxitos</p>
                        <p className="text-2xl font-black text-green-700 leading-none">{summary.success}</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col items-center justify-center transition-transform hover:scale-105">
                        <span className="material-symbols-outlined text-blue-500 mb-2">call_merge</span>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Fusionados</p>
                        <p className="text-2xl font-black text-blue-700 leading-none">{summary.merged || 0}</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex flex-col items-center justify-center transition-transform hover:scale-105">
                        <span className="material-symbols-outlined text-amber-500 mb-2">warning</span>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Avisos</p>
                        <p className="text-2xl font-black text-amber-700 leading-none">
                            {results.reduce((acc, r) => acc + (r.warnings?.length || 0), 0)}
                        </p>
                    </div>

                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex flex-col items-center justify-center transition-transform hover:scale-105">
                        <span className="material-symbols-outlined text-red-500 mb-2">error</span>
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Errores</p>
                        <p className="text-2xl font-black text-red-700 leading-none">{summary.failed}</p>
                    </div>
                </div>

                {/* Details List */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                    {!hasIssues ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                                <span className="material-symbols-outlined text-3xl font-bold">celebration</span>
                            </div>
                            <h3 className="font-bold text-stone-800 text-lg">¡Éxito Total!</h3>
                            <p className="text-sm text-stone-500 max-w-xs mx-auto">
                                Todas las filas se han procesado correctamente sin errores ni advertencias.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Detalle por Fila:</h3>
                            {problematicRows.map((res, i) => (
                                <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2 transition-colors ${res.status === 'error' ? 'bg-red-50/30 border-red-100' :
                                        res.action === 'merged' ? 'bg-blue-50/30 border-blue-100' :
                                            'bg-amber-50/30 border-amber-100'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase ${res.status === 'error' ? 'bg-red-100 text-red-700' :
                                                res.action === 'merged' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-amber-100 text-amber-700'
                                            }`}>
                                            Línea Excel {res.row_idx + 2}
                                            {res.action === 'merged' && ' (Fusión)'}
                                        </span>
                                        <span className="text-[9px] font-bold text-stone-400 tracking-tighter">#{res.row_idx}</span>
                                    </div>

                                    {/* Mostrar Errores */}
                                    {res.errors?.map((err, ei) => (
                                        <div key={ei} className="flex items-start gap-2">
                                            <span className="material-symbols-outlined text-red-400 text-sm mt-0.5">error</span>
                                            <div>
                                                <p className="text-[11px] font-bold text-red-900 leading-tight">{err.message}</p>
                                                <p className="text-[9px] text-red-400 font-mono mt-0.5">[{err.code}]</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Mostrar Warnings */}
                                    {res.warnings?.map((warn, wi) => (
                                        <div key={wi} className="flex items-start gap-2">
                                            <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">report_problem</span>
                                            <div>
                                                <p className="text-[11px] font-bold text-amber-900 leading-tight">{warn.message}</p>
                                                <p className="text-[9px] text-amber-500 font-mono mt-0.5">[{warn.code}]</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-stone-50 border-t border-stone-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
