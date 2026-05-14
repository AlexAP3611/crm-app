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
    const [showHelp, setShowHelp] = useState(false)
    const [issuePage, setIssuePage] = useState(1)
    const [issueFilter, setIssueFilter] = useState('all') // 'all', 'error', 'warning'
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
        setIssuePage(1)
        setIssueFilter('all')
    }

    // Helper to count creations/updates for preview cards
    const summaryStats = report ? {
        to_create: report.results.filter(r => r.action === 'created').length,
        to_update: report.results.filter(r => r.action === 'updated').length,
        failed: report.summary.failed + report.summary.skipped
    } : { to_create: 0, to_update: 0, failed: 0 };

    // Contadores de warnings de ubicación: primero desde el summary (commit mode),
    // luego desde los warnings individuales (preview mode donde summary no tiene esos campos).
    const locationWarnings = report ? {
        pais: report.summary?.warnings_pais ||
              report.results.filter(r =>
                  r.warnings?.some(w => w.code === 'PAIS_NOT_FOUND')
              ).length,
        provincia: report.summary?.warnings_provincia ||
                   report.results.filter(r =>
                       r.warnings?.some(w =>
                           w.code === 'PROVINCIA_NOT_FOUND' || w.code === 'PROVINCIA_NO_PAIS'
                       )
                   ).length,
    } : { pais: 0, provincia: 0 };

    const ISSUES_PAGE_SIZE = 10;
    
    const allIssues = useMemo(() => {
        if (!report) return []
        return report.results.filter(r => r.status === 'error' || (r.warnings && r.warnings.length > 0))
    }, [report])

    const filteredIssues = useMemo(() => {
        if (issueFilter === 'all') return allIssues
        if (issueFilter === 'error') return allIssues.filter(r => r.status === 'error')
        if (issueFilter === 'warning') return allIssues.filter(r => r.status !== 'error' && r.warnings && r.warnings.length > 0)
        return allIssues
    }, [allIssues, issueFilter])

    useEffect(() => {
        setIssuePage(1)
    }, [issueFilter])

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
                            <h2 className="font-bold text-stone-900 text-xl">Importar Empresas</h2>
                            <p className="text-xs text-stone-400 font-medium uppercase tracking-widest mt-0.5">Flujo de Importación • CSV / XLSX</p>
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
                                        <span className={`material-symbols-outlined text-stone-400 transition-transform duration-300 ${showHelp ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>

                                    {showHelp && (
                                        <div className="p-6 space-y-8 animate-in slide-in-from-top-4 duration-300">
                                            {/* 1. FORMATOS */}
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

                                            {/* 2. CAMPOS */}
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
                                                                <th className="px-4 py-2 font-bold text-stone-500 border-b border-stone-100">Nombres aceptados (Alias)</th>
                                                                <th className="px-4 py-2 font-bold text-stone-500 border-b border-stone-100 text-center">Obligatorio</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-50">
                                                            {[
                                                                { label: 'Nombre', aliases: 'nombre, empresa, name, company', req: 'SÍ' },
                                                                { label: 'Web', aliases: 'web, website, url, site', req: 'NO' },
                                                                { label: 'Email', aliases: 'email, correo, mail', req: 'NO' },
                                                                { label: 'Teléfono', aliases: 'phone, telefono, tel, mobile', req: 'NO' },
                                                                { label: 'CIF', aliases: 'cif, vat, nif', req: 'NO' },
                                                                { label: 'Nº Emp.', aliases: 'numero_empleados, size, empleados', req: 'NO' },
                                                                { label: 'Facturación', aliases: 'facturacion, revenue, ventas', req: 'NO' },
                                                                { label: 'CNAE', aliases: 'cnae, industry_code, actividad', req: 'NO' },
                                                                { label: 'País', aliases: 'pais, país, country, nation', req: 'NO' },
                                                                { label: 'Provincia', aliases: 'provincia, province, state, región', req: 'NO' },
                                                                { label: 'Sector', aliases: 'sector, industria, industry', req: 'NO' },
                                                                { label: 'Vertical', aliases: 'vertical, subsector, vertical', req: 'NO' },
                                                                { label: 'Producto', aliases: 'producto, product, servicio', req: 'NO' },
                                                            ].map((row, i) => (
                                                                <tr key={i} className="hover:bg-stone-50/30 transition-colors">
                                                                    <td className="px-4 py-2 font-bold text-stone-700">{row.label}</td>
                                                                    <td className="px-4 py-2 text-stone-500 italic">{row.aliases}</td>
                                                                    <td className="px-4 py-2 text-center">
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${row.req === 'SÍ' ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-400'}`}>
                                                                            {row.req}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* 3. UBICACIÓN */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">3. Campos de ubicación</h3>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-3">
                                                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 space-y-1.5">
                                                        <p className="text-[11px] font-bold text-stone-800 flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-[14px]">public</span> País
                                                        </p>
                                                        <p className="text-[10px] text-stone-500 leading-relaxed">Debe coincidir con la base de datos (ej. "España"). Si no se reconoce, se importa sin país asignado con un aviso.</p>
                                                    </div>
                                                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 space-y-1.5">
                                                        <p className="text-[11px] font-bold text-stone-800 flex items-center gap-1.5">
                                                            <span className="material-symbols-outlined text-[14px]">map</span> Provincia
                                                        </p>
                                                        <p className="text-[10px] text-stone-500 leading-relaxed">Solo para España. Debe coincidir con las 52 provincias oficiales. Si no se reconoce, se importa sin provincia.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 4. DUPLICADOS */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">4. Detección de duplicados</h3>
                                                </div>
                                                <p className="text-xs text-stone-600 ml-3 leading-relaxed">
                                                    El sistema verifica si la empresa ya existe comparando el <span className="font-bold text-stone-800">CIF</span>, la <span className="font-bold text-stone-800">Web</span> o el <span className="font-bold text-stone-800">Nombre</span>. Si se encuentra una coincidencia, los datos se <strong>actualizarán</strong> en lugar de crear un duplicado.
                                                </p>
                                            </div>

                                            {/* 5. PREVISUALIZADOR */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                                    <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">5. Previsualizador</h3>
                                                </div>
                                                <p className="text-xs text-stone-600 ml-3 leading-relaxed">
                                                    Antes de confirmar, verás un resumen detallado con las empresas a crear, las que se actualizarán y cualquier aviso de campos no reconocidos (en amarillo).
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                                    <span className="material-symbols-outlined text-blue-500 text-lg">verified_user</span>
                                    <p className="text-xs text-blue-800 leading-relaxed font-medium">
                                        Se detectarán automáticamente Sectores, Verticales y Productos. Podrás revisar el impacto antes de confirmar.
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
                                                <span className="font-bold text-stone-800">Nombre</span> de la empresa (mínimo 2 caracteres)
                                            </p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md uppercase tracking-tight shrink-0 mt-0.5">Recomendado</span>
                                            <p className="text-[11px] text-stone-500 leading-relaxed">
                                                <span className="font-semibold text-stone-600">CIF</span>, <span className="font-semibold text-stone-600">Web</span>, <span className="font-semibold text-stone-600">Email</span>, <span className="font-semibold text-stone-600">Teléfono</span>, <span className="font-semibold text-stone-600">Provincia</span>, <span className="font-semibold text-stone-600">País</span>, <span className="font-semibold text-stone-600">Sector</span>, <span className="font-semibold text-stone-600">Vertical</span>, <span className="font-semibold text-stone-600">Producto</span>
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-stone-400 italic leading-relaxed">
                                        Las filas sin nombre válido o sin identificadores (CIF, Web o Nombre) serán omitidas automáticamente.
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

                                {/* Avisos de ubicación — banners ámbar con conteos */}
                                {(locationWarnings.pais > 0 || locationWarnings.provincia > 0) && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-amber-500 text-lg">location_off</span>
                                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Avisos de ubicación</p>
                                        </div>
                                        {locationWarnings.pais > 0 && (
                                            <p className="text-[11px] text-amber-800 font-medium flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[14px] text-amber-500">flag</span>
                                                <strong>{locationWarnings.pais}</strong>&nbsp;empresa(s) se importarán <strong>sin país</strong> asignado por no encontrar coincidencia
                                            </p>
                                        )}
                                        {locationWarnings.provincia > 0 && (
                                            <p className="text-[11px] text-amber-800 font-medium flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[14px] text-amber-500">map</span>
                                                <strong>{locationWarnings.provincia}</strong>&nbsp;empresa(s) se importarán <strong>sin provincia</strong> asignada por no encontrar coincidencia
                                            </p>
                                        )}
                                    </div>
                                )}

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

                                    {/* Problemas / Avisos — distinción visual rojo (error) vs ámbar (warning) */}
                                    {allIssues.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Problemas / Avisos detectados ({allIssues.length}):</p>
                                                
                                                {/* Filter Bar */}
                                                <div className="flex bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                                                    {[
                                                        { id: 'all', label: 'Todos', icon: 'list' },
                                                        { id: 'error', label: 'Errores', icon: 'error' },
                                                        { id: 'warning', label: 'Avisos', icon: 'warning' }
                                                    ].map(f => (
                                                        <button
                                                            key={f.id}
                                                            onClick={() => setIssueFilter(f.id)}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                                                                issueFilter === f.id 
                                                                    ? 'bg-white text-stone-900 shadow-sm' 
                                                                    : 'text-stone-400 hover:text-stone-600'
                                                            }`}
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">{f.icon}</span>
                                                            {f.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                {currentIssues.length > 0 ? (
                                                    currentIssues.map((res, i) => (
                                                        <div
                                                            key={i}
                                                            className={`flex items-start gap-2 text-[11px] font-medium text-stone-600 px-3 py-2 rounded-lg border animate-in fade-in slide-in-from-right-2 duration-300 ${
                                                                res.status === 'error'
                                                                    ? 'bg-red-50/60 border-red-100'
                                                                    : 'bg-amber-50/60 border-amber-200/70'
                                                            }`}
                                                        >
                                                            <span className={`${
                                                                res.status === 'error' ? 'text-red-500' : 'text-amber-500'
                                                            } material-symbols-outlined text-[14px] mt-0.5 shrink-0`}>
                                                                {res.status === 'error' ? 'error' : 'warning'}
                                                            </span>
                                                            <span className={`font-bold shrink-0 ${
                                                                res.status === 'error' ? 'text-red-500' : 'text-amber-600'
                                                            }`}>Línea {res.row_idx + 2}:</span>
                                                            <span>{res.errors?.[0]?.message || res.warnings?.[0]?.message}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-4 text-center text-[11px] text-stone-400 italic">No hay incidencias con este filtro.</div>
                                                )}
                                                
                                                {/* Pagination Controls */}
                                                {totalIssuePages > 1 && (
                                                    <div className="flex items-center justify-between pt-2">
                                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Página {issuePage} de {totalIssuePages}</p>
                                                        <div className="flex gap-1">
                                                            <button 
                                                                disabled={issuePage === 1}
                                                                onClick={() => setIssuePage(p => p - 1)}
                                                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-30 hover:bg-stone-50 transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                                                            </button>
                                                            <button 
                                                                disabled={issuePage === totalIssuePages}
                                                                onClick={() => setIssuePage(p => p + 1)}
                                                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-30 hover:bg-stone-50 transition-colors"
                                                            >
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
                onClose={() => setShowResultModal(false)}
            />
        </>
    )
}
