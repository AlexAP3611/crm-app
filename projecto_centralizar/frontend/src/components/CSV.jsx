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
                <p style={{ fontWeight: 500 }}>{loading ? 'Importando…' : 'Arrastra un archivo CSV aquí o haz clic para seleccionarlo'}</p>
                <p className="text-xs text-muted mt-1">Mapeo dinámico import/export admitido: {CONTACT_COLUMNS.map(c => c.key).join(", ")}</p>
            </div>
            <input id="csv-file-input" ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
            {result && (
                <div className="alert alert-success mt-2">
                    ✓ Importado: <strong>{result.created}</strong> creados, <strong>{result.updated}</strong> actualizados
                </div>
            )}
            {error && <div className="alert alert-error mt-2">✗ Error: {error}</div>}
        </div>
    )
}

export function CSVExport({ filters, label = 'Exportar CSV' }) {
    function download() {
        const url = api.exportCsvUrl(filters)
        const a = document.createElement('a')
        a.href = url
        a.download = 'contacts.csv'
        a.click()
    }

    return (
        <button id="csv-export-btn" className="btn btn-secondary" onClick={download}>
            {label}
        </button>
    )
}
