import { useState, useRef } from 'react'
import { api } from '../api/client'
import { CONTACT_COLUMNS } from '../config/fields'

export function CSVImport({ onImported }) {
    const [dragging, setDragging] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const inputRef = useRef()

    async function handleFile(file) {
        if (!file) return

        // Robust validation by extension (avoiding unreliable MIME types)
        const allowedExtensions = [".csv", ".xlsx", ".xls"];
        const fileName = file.name.toLowerCase();
        const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            setError("Formato de archivo no válido. Use CSV o Excel (.xlsx, .xls)");
            return;
        }

        setLoading(true)
        setResult(null)
        setError(null)
        try {
            const res = await api.importCsv(file)
            setResult(res)
            onImported?.()
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    function onDrop(e) {
        e.preventDefault()
        setDragging(false)
        handleFile(e.dataTransfer.files[0])
    }

    return (
        <div>
            <div
                id="csv-drop-zone"
                className={`drop-zone${dragging ? ' dragging' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                <div className="drop-zone-icon">📂</div>
                <p style={{ fontWeight: 500 }}>{loading ? 'Importando…' : 'Arrastra un archivo CSV o Excel aquí o haz clic'}</p>
                <p className="text-xs text-muted mt-1">Formatos admitidos: CSV, Excel (.xlsx, .xls)</p>
                <p className="text-xs text-muted mt-1">Columnas mapeadas: {CONTACT_COLUMNS.map(c => c.key).join(", ")}</p>
            </div>
            <input id="csv-file-input" ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
            {result && (
                <div className="alert alert-success mt-2">
                    ✓ Importado: <strong>{result.created}</strong> creados, <strong>{result.updated}</strong> actualizados
                </div>
            )}
            {error && <div className="alert alert-error mt-2">✗ Error: {error}</div>}
        </div>
    )
}

export function CSVExport({ filters, label, children, icon, className = "", ...props }) {
    function download() {
        const { page, page_size, ...cleanFilters } = filters
        const url = api.exportCsvUrl(cleanFilters)
        const a = document.createElement('a')
        a.href = url
        a.download = 'contacts.csv'
        a.click()
    }

    return (
        <button
            id="csv-export-btn"
            className={`flex items-center gap-2 ${className}`}
            onClick={download}
            {...props}
        >
            {icon && <span className="material-symbols-outlined text-lg">{icon}</span>}
            {children || label || 'Exportar CSV'}
        </button>
    )
}

// ── Company CSV Components ──

export function EmpresaCSVImport({ onImported }) {
    const [dragging, setDragging] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const inputRef = useRef()

    async function handleFile(file) {
        if (!file) return

        // Robust validation by extension (avoiding unreliable MIME types)
        const allowedExtensions = [".csv", ".xlsx", ".xls"];
        const fileName = file.name.toLowerCase();
        const isValid = allowedExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            setError("Formato de archivo no válido. Use CSV o Excel (.xlsx, .xls)");
            return;
        }

        setLoading(true)
        setResult(null)
        setError(null)
        try {
            const res = await api.importEmpresasCsv(file)
            setResult(res)
            onImported?.()
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    function onDrop(e) {
        e.preventDefault()
        setDragging(false)
        handleFile(e.dataTransfer.files[0])
    }

    return (
        <div>
            <div
                id="empresa-csv-drop-zone"
                className={`drop-zone${dragging ? ' dragging' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
            >
                <div className="drop-zone-icon">🏢</div>
                <p style={{ fontWeight: 500 }}>{loading ? 'Importando empresas…' : 'Arrastra un archivo CSV o Excel de empresas aquí o haz clic'}</p>
                <p className="text-xs text-muted mt-1">Formatos admitidos: CSV, Excel (.xlsx, .xls)</p>
                <p className="text-xs text-muted mt-1 italic">Columnas sugeridas: nombre, web, email, phone, cif, numero_empleados, facturacion, cnae</p>
            </div>
            <input id="empresa-csv-file-input" ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
            {result && (
                <div className="alert alert-success mt-2">
                    ✓ Importado: <strong>{result.created}</strong> creadas, <strong>{result.updated}</strong> actualizadas
                </div>
            )}
            {error && <div className="alert alert-error mt-2">✗ Error: {error}</div>}
        </div>
    )
}

export function EmpresaCSVExport({ filters, label, children, icon, className = "", ...props }) {
    function download() {
        const { page, page_size, ...cleanFilters } = filters
        const url = api.exportEmpresasCsvUrl(cleanFilters)
        const a = document.createElement('a')
        a.href = url
        a.download = 'empresas.csv'
        a.click()
    }

    return (
        <button
            id="empresa-csv-export-btn"
            className={`flex items-center gap-2 ${className}`}
            onClick={download}
            {...props}
        >
            {icon && <span className="material-symbols-outlined text-lg">{icon}</span>}
            {children || label || 'Exportar empresas'}
        </button>
    )
}
