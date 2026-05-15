import React, { useState, useRef, useMemo, useEffect } from 'react'
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
 * Truncated list component for previews
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

export default function ImportContactsModal({ onClose, onImported }) {
    const [step, setStep] = useState(STEPS.UPLOAD)
    const [file, setFile] = useState(null)
    const [report, setReport] = useState(null)
    const [error, setError] = useState(null)
    const [dragging, setDragging] = useState(false)
    const [showResultModal, setShowResultModal] = useState(false)
    const [showHelp, setShowHelp] = useState(false)
    const [issuePage, setIssuePage] = useState(1)
    const [issueFilter, setIssueFilter] = useState('all')
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
            const data = await api.previewImportContacts(selectedFile)
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
            const finalReport = await api.importCsv(file)
            setReport(finalReport)
            setStep(STEPS.SUCCESS)
            
            // 🔥 AUTO-OPEN: Si hay avisos o errores, mostramos el detalle automáticamente
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
        setIssuePage(1)
        setIssueFilter('all')
    }

    // Helper to count creations/updates for preview cards
    const summaryStats = report ? {
        to_create: report.results.filter(r => r.action === 'created').length,
        to_update: report.results.filter(r => r.action === 'updated').length,
        to_merge: report.results.filter(r => r.action === 'merged').length,
        failed: report.summary.failed + report.summary.skipped
    } : { to_create: 0, to_update: 0, to_merge: 0, failed: 0 };

    // Entity previews extracted from backend warning.value (structured, no regex)
    const entityPreviews = useMemo(() => {
        if (!report) return { empresas: [], cargos: [], campaigns: [] }
        const allWarnings = report.results.flatMap(r => r.warnings || [])
        return {
            empresas: [...new Set(allWarnings.filter(w => w.code === 'AUTO_EMPRESA').map(w => w.value || w.message))].map(name => ({ name, action: 'would_create' })),
            cargos: [...new Set(allWarnings.filter(w => w.code === 'AUTO_CARGO').map(w => w.value || w.message))].map(name => ({ name, action: 'would_create' })),
            campaigns: [...new Set(allWarnings.filter(w => w.code === 'AUTO_CAMPAIGN').map(w => w.value || w.message))].map(name => ({ name, action: 'would_create' })),
        }
    }, [report])

    const ISSUES_PAGE_SIZE = 10;

    const allIssues = useMemo(() => {
        if (!report) return []
        return report.results.filter(r => r.status === 'error' || (r.warnings && r.warnings.length > 0))
    }, [report])

    const filteredIssues = useMemo(() => {
        if (issueFilter === 'all') return allIssues
        if (issueFilter === 'error') return allIssues.filter(r => r.status === 'error')
        if (issueFilter === 'warning') return allIssues.filter(r => r.status !== 'error' && r.action !== 'merged' && r.warnings && r.warnings.length > 0)
        if (issueFilter === 'merged') return allIssues.filter(r => r.action === 'merged')
        return allIssues
    }, [allIssues, issueFilter])

    useEffect(() => { setIssuePage(1) }, [issueFilter])

    const totalIssuePages = Math.ceil(filteredIssues.length / ISSUES_PAGE_SIZE)
    const currentIssues = filteredIssues.slice((issuePage - 1) * ISSUES_PAGE_SIZE, issuePage * ISSUES_PAGE_SIZE)

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
                
                <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-stone-200">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between shrink-0">
                        <div>
                            <h2 className="font-bold text-stone-900 text-xl">Importar Contactos</h2>
                            <p className="text-xs text-stone-400 font-medium uppercase tracking-widest mt-0.5">Flujo de Importación • Pipeline v3</p>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-stone-100 text-stone-400 transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
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
                                        <span className="material-symbols-outlined text-3xl">person_add</span>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-stone-700">Selecciona el archivo de contactos</p>
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

                                {/* Help Section */}
                                <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                                    <button
                                        onClick={() => setShowHelp(!showHelp)}
                                        className="w-full px-6 py-4 flex items-center justify-between bg-stone-50 hover:bg-stone-100/80 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center shadow-sm">
                                                <span className="material-symbols-outlined text-stone-500 text-lg">info</span>
                                            </div>
                                            <span className="font-bold text-stone-700 text-sm">¿Cómo funciona la importación?</span>
                                        </div>
                                        <span className={`material-symbols-outlined text-stone-400 transition-transform duration-300 ${showHelp ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>

                                    {showHelp && (
                                        <div className="p-6 space-y-8 animate-in slide-in-from-top-4 duration-300">
                                            {/* 1. Formatos */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">1. Formatos aceptados</h3>
                                                </div>
                                                <ul className="space-y-2 ml-3">
                                                    <li className="flex items-center gap-2 text-xs text-stone-600">
                                                        <span className="material-symbols-outlined text-[14px] text-stone-400">check_circle</span>
                                                        Archivos <strong>CSV</strong> y <strong>Excel (.xlsx)</strong>
                                                    </li>
                                                    <li className="flex items-center gap-2 text-xs text-stone-600">
                                                        <span className="material-symbols-outlined text-[14px] text-stone-400">check_circle</span>
                                                        La primera fila debe contener los nombres de las columnas
                                                    </li>
                                                </ul>
                                            </div>

                                            {/* 2. Campos */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">2. Campos y nombres aceptados</h3>
                                                </div>
                                                <div className="overflow-hidden border border-stone-100 rounded-xl">
                                                    <table className="w-full text-left text-[11px] border-collapse">
                                                        <thead className="bg-stone-50/50">
                                                            <tr>
                                                                <th className="px-4 py-2 font-bold text-stone-500 border-b border-stone-100">Campo</th>
                                                                <th className="px-4 py-2 font-bold text-stone-500 border-b border-stone-100">Nombres aceptados</th>
                                                                <th className="px-4 py-2 font-bold text-stone-500 border-b border-stone-100 text-center">Obligatorio</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-50">
                                                            {[
                                                                { label: 'Nombre', aliases: 'Nombre, first_name, full_name, contacto', req: 'NO' },
                                                                { label: 'Apellido', aliases: 'Apellidos, last_name, surname', req: 'NO' },
                                                                { label: 'Email', aliases: 'Email, correo, mail', req: 'SÍ*' },
                                                                { label: 'Teléfono', aliases: 'Telefono, telefono, tel, mobile', req: 'SÍ*' },
                                                                { label: 'LinkedIn', aliases: 'LinkedIn, linkedin_url, perfil linkedin', req: 'SÍ*' },
                                                                { label: 'Cargo', aliases: 'Cargo, job_title, puesto, position, rol', req: 'NO' },
                                                                { label: 'Empresa', aliases: 'Nombre empresa, company, empresa', req: 'NO' },
                                                                { label: 'Campaña', aliases: 'Campaña, campaign, campana, origen', req: 'NO' },
                                                            ].map((row, i) => (
                                                                <tr key={i} className="hover:bg-stone-50/30 transition-colors">
                                                                    <td className="px-4 py-2 font-bold text-stone-700">{row.label}</td>
                                                                    <td className="px-4 py-2 text-stone-500 italic">{row.aliases}</td>
                                                                    <td className="px-4 py-2 text-center">
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${row.req.startsWith('SÍ') ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-400'}`}>
                                                                            {row.req}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <p className="text-[10px] text-stone-400 italic ml-1">* Al menos uno de los tres es obligatorio por fila.</p>
                                            </div>

                                            {/* 3. Duplicados */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">3. Detección de duplicados</h3>
                                                </div>
                                                <p className="text-xs text-stone-600 ml-3 leading-relaxed">
                                                    El sistema verifica si el contacto ya existe comparando el <span className="font-bold text-stone-800">Email</span>. Si se encuentra coincidencia, los datos se <strong>actualizarán</strong> en lugar de crear un duplicado.
                                                </p>
                                            </div>

                                            {/* 4. Previsualizador */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">4. Previsualizador</h3>
                                                </div>
                                                <p className="text-xs text-stone-600 ml-3 leading-relaxed">
                                                    Antes de confirmar, verás un resumen con contactos nuevos vs actualizados, empresas y cargos que se crearían automáticamente, y cualquier aviso o error detectado.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                                    <span className="material-symbols-outlined text-blue-500 text-lg">verified_user</span>
                                    <p className="text-xs text-blue-800 leading-relaxed font-medium">
                                        Se detectarán automáticamente Empresas, Cargos y Campañas. El sistema evita duplicados usando el email.
                                    </p>
                                </div>

                                {/* Required fields info */}
                                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-stone-500 text-lg">checklist</span>
                                        <p className="text-xs font-bold text-stone-700 uppercase tracking-wider">Campos necesarios para la importación</p>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md uppercase tracking-tight shrink-0 mt-0.5">Obligatorio</span>
                                            <p className="text-[11px] text-stone-600 leading-relaxed">
                                                Al menos uno de: <span className="font-bold text-stone-800">Email</span>, <span className="font-bold text-stone-800">Teléfono</span> o <span className="font-bold text-stone-800">LinkedIn</span>
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md uppercase tracking-tight shrink-0 mt-0.5">Recomendado</span>
                                            <p className="text-[11px] text-stone-500 leading-relaxed">
                                                <span className="font-semibold text-stone-600">Nombre</span>, <span className="font-semibold text-stone-600">Apellido</span>, <span className="font-semibold text-stone-600">Empresa</span>, <span className="font-semibold text-stone-600">Cargo</span>, <span className="font-semibold text-stone-600">Campaña</span>
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-stone-400 italic leading-relaxed">
                                        Las filas sin email, teléfono ni LinkedIn serán omitidas automáticamente.
                                    </p>
                                </div>
                            </div>
                        )}

                        {step === STEPS.PREVIEW && report && (
                            <div className="space-y-6">
                                {/* Summary Cards — 4 separate cards */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-green-50 border border-green-100 p-4 rounded-2xl text-center">
                                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Nuevos</p>
                                        <p className="text-2xl font-black text-green-700">{summaryStats.to_create}</p>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Actualizar</p>
                                        <p className="text-2xl font-black text-blue-700">{summaryStats.to_update}</p>
                                    </div>
                                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-center">
                                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Fusiones</p>
                                        <p className="text-2xl font-black text-indigo-700">{summaryStats.to_merge}</p>
                                    </div>
                                    <div className="bg-stone-50 border border-stone-100 p-4 rounded-2xl text-center">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Omitidos</p>
                                        <p className="text-2xl font-black text-stone-500">{summaryStats.failed}</p>
                                    </div>
                                </div>

                                {/* Entity Previews — uses warning.value (structured), not regex on message */}
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    <PreviewList items={entityPreviews.empresas} label="Empresas que se crearían" icon="domain" />
                                    <PreviewList items={entityPreviews.cargos} label="Cargos nuevos detectados" icon="work" />
                                    <PreviewList items={entityPreviews.campaigns} label="Campañas que se crearían" icon="campaign" />

                                    {/* Issues — filterable + paginated */}
                                    {allIssues.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Problemas / Avisos ({allIssues.length}):</p>
                                                <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                                                    {[
                                                        { id: 'all', label: 'Todos', icon: 'list' },
                                                        { id: 'error', label: 'Errores', icon: 'error' },
                                                        { id: 'warning', label: 'Avisos', icon: 'warning' },
                                                        { id: 'merged', label: 'Fusiones', icon: 'call_merge' }
                                                    ].map(f => (
                                                        <button
                                                            key={f.id}
                                                            onClick={() => setIssueFilter(f.id)}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all ${issueFilter === f.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">{f.icon}</span>
                                                            {f.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                {currentIssues.length > 0 ? currentIssues.map((res, i) => (
                                                    <div
                                                        key={i}
                                                        className={`flex items-start gap-2 text-[11px] font-medium text-stone-600 px-3 py-2 rounded-lg border animate-in fade-in slide-in-from-right-2 duration-300 ${res.status === 'error' ? 'bg-red-50/60 border-red-100' : 'bg-amber-50/60 border-amber-200/70'}`}
                                                    >
                                                        <span className={`${res.status === 'error' ? 'text-red-500' : res.action === 'merged' ? 'text-indigo-500' : 'text-amber-500'} material-symbols-outlined text-[14px] mt-0.5 shrink-0`}>
                                                            {res.status === 'error' ? 'error' : res.action === 'merged' ? 'call_merge' : 'warning'}
                                                        </span>
                                                        <span className={`font-bold shrink-0 ${res.status === 'error' ? 'text-red-500' : res.action === 'merged' ? 'text-indigo-600' : 'text-amber-600'}`}>
                                                            Línea {res.row_idx + 2}
                                                            {res.action === 'merged' && <span className="ml-1 text-[9px] bg-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">Fusión</span>}:
                                                        </span>
                                                        <span>{res.errors?.[0]?.message || res.warnings?.[0]?.message}</span>
                                                    </div>
                                                )) : (
                                                    <div className="py-4 text-center text-[11px] text-stone-400 italic">No hay incidencias con este filtro.</div>
                                                )}

                                                {totalIssuePages > 1 && (
                                                    <div className="flex items-center justify-between pt-2">
                                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Página {issuePage} de {totalIssuePages}</p>
                                                        <div className="flex gap-1">
                                                            <button disabled={issuePage === 1} onClick={() => setIssuePage(p => p - 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-30 hover:bg-stone-50 transition-colors">
                                                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                                                            </button>
                                                            <button disabled={issuePage === totalIssuePages} onClick={() => setIssuePage(p => p + 1)} className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-30 hover:bg-stone-50 transition-colors">
                                                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                                                            </button>
                                                        </div>
                                                    </div>
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
                                <p className="text-sm font-bold text-stone-600">Procesando contactos...</p>
                            </div>
                        )}

                        {step === STEPS.SUCCESS && (
                            <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-500 animate-in zoom-in-50 duration-500">
                                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-900 text-lg">Importación Completada</h3>
                                    <p className="text-sm text-stone-500 mt-1">El proceso ha terminado satisfactoriamente.</p>
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
                    <div className="px-8 py-6 bg-stone-50 border-t border-stone-100 flex justify-end gap-3 shrink-0">
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
                entityName="Contactos"
                title="Resumen de Importación de Contactos"
                onClose={() => setShowResultModal(false)} 
            />
        </>
    )
}
