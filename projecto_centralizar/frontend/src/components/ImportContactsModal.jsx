import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const STEPS = {
    UPLOAD: 'upload',
    PREVIEW: 'preview',
    EXECUTING: 'executing',
    SUCCESS: 'success',
    ERROR: 'error'
}

export default function ImportContactsModal({ onClose, onImported }) {
    const [step, setStep] = useState(STEPS.UPLOAD)
    const [file, setFile] = useState(null)
    const [previewData, setPreviewData] = useState(null)
    const [error, setError] = useState(null)
    const [dragging, setDragging] = useState(false)
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
            const summary = await api.previewImportContacts(selectedFile)
            setPreviewData(summary)
            setStep(STEPS.PREVIEW)
        } catch (err) {
            setError(err.message)
            setStep(STEPS.ERROR)
        }
    }

    const confirmImport = async () => {
        if (step === STEPS.EXECUTING) return // Double-click protection
        setStep(STEPS.EXECUTING)
        setError(null)
        try {
            await api.importCsv(file)
            setStep(STEPS.SUCCESS)
            onImported?.()
        } catch (err) {
            setError(err.message)
            setStep(STEPS.ERROR)
        }
    }

    const reset = () => {
        setFile(null)
        setPreviewData(null)
        setError(null)
        setStep(STEPS.UPLOAD)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
            
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-stone-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-stone-900 text-xl">Importar Contactos</h2>
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
                                    <span className="material-symbols-outlined text-3xl">upload_file</span>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-stone-700">Selecciona o arrastra un archivo</p>
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
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                                <span className="material-symbols-outlined text-amber-500 text-lg">info</span>
                                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                    El sistema realizará una validación previa antes de importar. No se realizarán cambios en la base de datos hasta que confirmes los resultados.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === STEPS.PREVIEW && previewData && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-green-50 border border-green-100 p-4 rounded-2xl text-center">
                                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Nuevos</p>
                                    <p className="text-2xl font-black text-green-700">{previewData.to_create}</p>
                                </div>
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl text-center">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Actualizar</p>
                                    <p className="text-2xl font-black text-blue-700">{previewData.to_update}</p>
                                </div>
                                <div className="bg-stone-50 border border-stone-100 p-4 rounded-2xl text-center">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Omitidos</p>
                                    <p className="text-2xl font-black text-stone-500">{previewData.skipped}</p>
                                </div>
                            </div>

                            {previewData.empresa_preview?.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Empresas que se crearán:</p>
                                    <div className="max-h-24 overflow-y-auto space-y-1 pr-2">
                                        {previewData.empresa_preview.map((emp, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs font-medium text-stone-600 bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">
                                                <span className="material-symbols-outlined text-[14px]">domain</span>
                                                {emp.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {previewData.skip_details?.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Problemas detectados:</p>
                                    <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                                        {previewData.skip_details.slice(0, 50).map((skip, i) => (
                                            <div key={i} className="flex items-start gap-2 text-[11px] font-medium text-stone-500 bg-red-50/50 px-3 py-2 rounded-lg border border-red-100/50">
                                                <span className="text-red-400 font-bold w-10 shrink-0">Fila {skip.row + 1}:</span>
                                                <span>{skip.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                <p className="text-sm text-stone-500 mt-1">Los contactos han sido integrados correctamente.</p>
                            </div>
                        </div>
                    )}

                    {step === STEPS.ERROR && (
                        <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                                <span className="material-symbols-outlined text-4xl">error</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-stone-900 text-lg">Error de Importación</h3>
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
                            Cerrar
                        </button>
                    ) : (
                        <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-stone-400 hover:bg-stone-100 transition-colors">
                            {step === STEPS.EXECUTING ? 'Espere...' : 'Cancelar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
