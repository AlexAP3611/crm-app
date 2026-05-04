import React, { useState, useRef } from 'react'
import { api } from '../api/client'
import ImportResultModal from './ImportResultModal'

const STEPS = {
    UPLOAD: 'upload',
    PREVIEW: 'preview',
    EXECUTING: 'executing',
    SUCCESS: 'success',
    ERROR: 'error'
}

/**
 * Truncated list component for M2M previews (Sectors, Verticals, Products)
 */
function PreviewList({ items = [], label, icon, limit = 5 }) {
    if (!items || items.length === 0) return null;

    const displayItems = items.slice(0, limit);
    const remainingCount = items.length - limit;

    return (
        <div className="space-y-2">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{label}:</p>
            <div className="flex flex-wrap gap-2">
                {displayItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-stone-600 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">
                        <span className="material-symbols-outlined text-[14px]">{icon}</span>
                        {item.name}
                        {item.action === 'would_create' && (
                            <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">Nuevo</span>
                        )}
                    </div>
                ))}
                {remainingCount > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-stone-400 bg-stone-50/50 px-3 py-1.5 rounded-lg border border-dashed border-stone-200">
                        + {remainingCount} más
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ImportEmpresasModal({ onClose, onImported }) {
    const [step, setStep] = useState(STEPS.UPLOAD)
    const [file, setFile] = useState(null)
    const [report, setReport] = useState(null)
    const [error, setError] = useState(null)
    const [dragging, setDragging] = useState(false)
    const [showResultModal, setShowResultModal] = useState(false)
    const fileInputRef = useRef()

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0]
        if (selectedFile) startPreview(selectedFile)
    }

    const onDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) startPreview(droppedFile)
    }

    const startPreview = async (selectedFile) => {
        setFile(selectedFile)
        setStep(STEPS.EXECUTING)
        setError(null)
        try {
            const data = await api.previewImportEmpresas(selectedFile)
            setReport(data)
            setStep(STEPS.PREVIEW)
        } catch (err) {
            setError(err.message)
            setStep(STEPS.ERROR)
        }
    }

    const confirmImport = async () => {
        if (step === STEPS.EXECUTING) return
        setStep(STEPS.EXECUTING)
        setError(null)
        try {
            const finalReport = await api.importEmpresasCsv(file)
            setReport(finalReport)
            setStep(STEPS.SUCCESS)

            // AUTO-OPEN: Si hay avisos o errores, mostramos el detalle automáticamente
            const hasIssues = finalReport.results.some(r => r.status === 'error' || (r.warnings && r.warnings.length > 0));
            if (hasIssues) {
                setShowResultModal(true);
            }

            onImported?.()
        } catch (err) {
            setError(err.message)
            setStep(STEPS.ERROR)
        }
    }

    const reset = () => {
        setFile(null)
        setReport(null)
        setError(null)
        setStep(STEPS.UPLOAD)
        setShowResultModal(false)
    }

    // Helper to count creations/updates for preview cards
    const summaryStats = report ? {
        to_create: report.results.filter(r => r.action === 'created').length,
        to_update: report.results.filter(r => r.action === 'updated').length,
        failed: report.summary.failed + report.summary.skipped
    } : { to_create: 0, to_update: 0, failed: 0 };

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>

                <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-stone-200">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-stone-900 text-xl">Importar Empresas</h2>
                            <p className="text-xs text-stone-400 font-medium uppercase tracking-widest mt-0.5">Flujo de Importación • CSV / XLSX</p>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-stone-100 text-stone-400 transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        {step === STEPS.UPLOAD && (
                            <div className="space-y-6">
                                <div
                                    className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all ${dragging ? 'border-primary bg-primary/5' : 'border-stone-200 hover:border-stone-300'}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={onDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-stone-50 flex items-center justify-center text-stone-400 group-hover:scale-110 transition-transform duration-300">
                                        <span className="material-symbols-outlined text-3xl">domain</span>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-stone-700">Selecciona el archivo de empresas</p>
                                        <p className="text-xs text-stone-400 mt-1">Formatos admitidos: CSV, Excel (.xlsx, .xls)</p>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileSelect}
                                    />
                                </div>
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                                    <span className="material-symbols-outlined text-blue-500 text-lg">verified_user</span>
                                    <p className="text-xs text-blue-800 leading-relaxed font-medium">
                                        Se detectarán automáticamente Sectores, Verticales y Productos. Podrás revisar el impacto antes de confirmar.
                                    </p>
                                </div>
                            </div>
                        )}

                        {step === STEPS.PREVIEW && report && (
                            <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-green-50 border border-green-100 p-4 rounded-2xl text-center">
                                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Nuevas</p>
                                        <p className="text-2xl font-black text-green-700">{summaryStats.to_create}</p>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Actualizar</p>
                                        <p className="text-2xl font-black text-blue-700">{summaryStats.to_update}</p>
                                    </div>
                                    <div className="bg-stone-50 border border-stone-100 p-4 rounded-2xl text-center">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Omitidos</p>
                                        <p className="text-2xl font-black text-stone-500">{summaryStats.failed}</p>
                                    </div>
                                </div>

                                {/* Entity Previews with Truncation */}
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    <PreviewList
                                        items={report.metadata?.empresa_preview}
                                        label="Empresas nuevas"
                                        icon="domain"
                                    />

                                    <PreviewList
                                        items={report.metadata?.sector_preview}
                                        label="Sectores detectados"
                                        icon="category"
                                    />

                                    <PreviewList
                                        items={report.metadata?.vertical_preview}
                                        label="Verticales detectadas"
                                        icon="account_tree"
                                    />

                                    <PreviewList
                                        items={report.metadata?.product_preview}
                                        label="Productos detectados"
                                        icon="inventory_2"
                                    />

                                    {/* Problems Detals */}
                                    {report.results.some(r => r.status === 'error' || r.warnings?.length > 0) && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Problemas / Avisos detectados:</p>
                                            <div className="space-y-1">
                                                {report.results.filter(r => r.status === 'error' || r.warnings?.length > 0).slice(0, 10).map((res, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-[11px] font-medium text-stone-500 bg-red-50/50 px-3 py-2 rounded-lg border border-red-100/50">
                                                        <span className={`${res.status === 'error' ? 'text-red-400' : 'text-amber-500'} font-bold w-10 shrink-0`}>Línea {res.row_idx + 2}:</span>
                                                        <span>{res.errors?.[0]?.message || res.warnings?.[0]?.message}</span>
                                                    </div>
                                                ))}
                                                {report.results.filter(r => r.status === 'error' || r.warnings?.length > 0).length > 10 && (
                                                    <p className="text-[10px] text-stone-400 italic text-center py-1">Y {report.results.filter(r => r.status === 'error' || r.warnings?.length > 0).length - 10} más... Pulsa importar para ver el detalle final.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === STEPS.EXECUTING && (
                            <div className="py-12 flex flex-col items-center justify-center gap-4">
                                <div className="w-12 h-12 border-4 border-stone-100 border-t-primary rounded-full animate-spin"></div>
                                <p className="text-sm font-bold text-stone-600">Procesando archivo...</p>
                            </div>
                        )}

                        {step === STEPS.SUCCESS && (
                            <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-500 animate-in zoom-in-50 duration-500">
                                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-900 text-lg">Importación Completada</h3>
                                    <p className="text-sm text-stone-500 mt-1">El proceso ha terminado. Revisa el detalle técnico.</p>
                                </div>
                                <button
                                    onClick={() => setShowResultModal(true)}
                                    className="px-6 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">visibility</span>
                                    Ver Reporte Detallado
                                </button>
                            </div>
                        )}

                        {step === STEPS.ERROR && (
                            <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                                    <span className="material-symbols-outlined text-4xl">error</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-900 text-lg">Fallo en Importación</h3>
                                    <p className="text-sm text-red-500 mt-1">{error}</p>
                                </div>
                                <button onClick={reset} className="mt-2 px-6 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-200 transition-colors">
                                    Volver a intentar
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-6 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                        {step === STEPS.PREVIEW ? (
                            <>
                                <button onClick={reset} className="px-6 py-3 rounded-xl text-sm font-bold text-stone-400 hover:bg-stone-100 transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmImport}
                                    className="px-8 py-3 btn-primary-gradient text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                                >
                                    Confirmar Importación
                                </button>
                            </>
                        ) : step === STEPS.SUCCESS ? (
                            <button onClick={onClose} className="px-8 py-3 btn-primary-gradient text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all">
                                Finalizar
                            </button>
                        ) : (
                            <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-stone-400 hover:bg-stone-100 transition-colors">
                                {step === STEPS.EXECUTING ? 'Espere...' : 'Cerrar'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <ImportResultModal
                isOpen={showResultModal}
                report={report}
                onClose={() => setShowResultModal(false)}
            />
        </>
    )
}
