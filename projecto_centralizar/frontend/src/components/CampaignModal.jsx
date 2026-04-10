import { useState } from 'react'
import Checkbox from './Checkbox'

const dateToYMD = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return d.toISOString().split('T')[0]
}

const TIPO_OPTIONS = ["Promoción", "Captación de leads", "Retención", "Branding", "Fidelización"]
const CANAL_OPTIONS = ["Email", "SMS", "Redes sociales", "Publicidad offline", "Telemarketing"]

const fromStringToList = (str) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : []
const fromListToString = (list) => list && list.length > 0 ? list.join(', ') : null

export default function CampaignModal({ payload, onClose, onSave }) {
    const isEdit = !!payload
    const [form, setForm] = useState(isEdit ? {
        ...payload,
        fecha_inicio: dateToYMD(payload.fecha_inicio),
        fecha_fin: dateToYMD(payload.fecha_fin),
        tipo: fromStringToList(payload.tipo),
        canal: fromStringToList(payload.canal),
    } : {
        nombre: '',
        estado: 'Planeada',
        tipo: [],
        fecha_inicio: dateToYMD(new Date()),
        fecha_fin: '',
        presupuesto: '',
        objetivo: '',
        responsable: '',
        canal: [],
        notas: ''
    })
    
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const toggleArrayItem = (key, val) => {
        setForm(f => {
            const arr = f[key] || []
            if (arr.includes(val)) {
                return { ...f, [key]: arr.filter(x => x !== val) }
            } else {
                return { ...f, [key]: [...arr, val] }
            }
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
        if (!form.fecha_inicio) { setError('La fecha de inicio es obligatoria'); return }
        
        setError(null)
        setSaving(true)
        
        try {
            const data = { ...form }
            // Convert arrays back to comma-separated strings
            data.tipo = fromListToString(data.tipo)
            data.canal = fromListToString(data.canal)
            
            // Convert empty strings to null
            Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null })
            
            // Convert budget to number if present
            if (data.presupuesto !== null) {
                const b = parseFloat(data.presupuesto)
                if (isNaN(b)) {
                    throw new Error('El presupuesto debe ser un número')
                }
                data.presupuesto = b
            } else {
                data.presupuesto = null
            }
            
            // Convert dates to ISO
            data.fecha_inicio = new Date(data.fecha_inicio).toISOString()
            if (data.fecha_fin) data.fecha_fin = new Date(data.fecha_fin).toISOString()

            await onSave(data)
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }

    return (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <form className="modal" onSubmit={handleSubmit} noValidate>
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'Editar Campaña' : 'Nueva Campaña'}</h2>
                    <button type="button" className="modal-close" onClick={onClose}>✕</button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="modal-grid">
                    <div className="form-group full">
                        <label className="form-label">Nombre *</label>
                        <input className="form-control" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">Estado *</label>
                        <select className="form-control" value={form.estado} onChange={(e) => set('estado', e.target.value)} required>
                            <option value="Planeada">Planeada</option>
                            <option value="Activa">Activa</option>
                            <option value="Finalizada">Finalizada</option>
                            <option value="Cancelada">Cancelada</option>
                        </select>
                    </div>
                    
                    <div className="form-group full">
                        <label className="form-label">Tipo</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                            {TIPO_OPTIONS.map(opt => (
                                <Checkbox 
                                    label={opt}
                                    checked={(form.tipo || []).includes(opt)}
                                    onChange={() => toggleArrayItem('tipo', opt)}
                                />
                            ))}
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">Fecha de Inicio *</label>
                        <input type="date" className="form-control" value={form.fecha_inicio} onChange={(e) => set('fecha_inicio', e.target.value)} required />
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">Fecha de Fin</label>
                        <input type="date" className="form-control" value={form.fecha_fin || ''} onChange={(e) => set('fecha_fin', e.target.value)} />
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">Presupuesto (€)</label>
                        <input type="number" step="0.01" className="form-control" value={form.presupuesto || ''} onChange={(e) => set('presupuesto', e.target.value)} />
                    </div>
                    
                    <div className="form-group full">
                        <label className="form-label">Canal</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                            {CANAL_OPTIONS.map(opt => (
                                <Checkbox 
                                    label={opt}
                                    checked={(form.canal || []).includes(opt)}
                                    onChange={() => toggleArrayItem('canal', opt)}
                                />
                            ))}
                        </div>
                    </div>
                    
                    <div className="form-group full">
                        <label className="form-label">Responsable</label>
                        <input className="form-control" value={form.responsable || ''} onChange={(e) => set('responsable', e.target.value)} />
                    </div>

                    <div className="form-group full">
                        <label className="form-label">Objetivo</label>
                        <textarea className="form-control" rows={2} value={form.objetivo || ''} onChange={(e) => set('objetivo', e.target.value)} />
                    </div>
                    
                    <div className="form-group full">
                        <label className="form-label">Notas Adicionales</label>
                        <textarea className="form-control" rows={3} value={form.notas || ''} onChange={(e) => set('notas', e.target.value)} />
                    </div>
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>
    )
}
