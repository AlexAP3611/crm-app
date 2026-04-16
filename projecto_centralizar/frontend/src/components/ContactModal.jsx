import { useState } from 'react'
import { api } from '../api/client'
import CompanyAutocomplete from './CompanyAutocomplete'
import MultiSelect from './MultiSelect'

import { CONTACT_COLUMNS } from '../config/fields'

const EMPTY = { notes: '' }
CONTACT_COLUMNS.forEach(col => {
    if (col.type === 'm2m') {
        EMPTY[col.id_key] = []
    } else if (col.type === 'fk') {
        EMPTY[col.id_key] = null
    } else {
        EMPTY[col.key] = ''
    }
})

export default function ContactModal({ contact, sectors, verticals, campaigns, products, cargos, onClose, onSaved }) {
    const isEdit = !!contact
    const initialNotes = contact?.notes && Object.keys(contact.notes).length > 0
        ? JSON.stringify(contact.notes, null, 2)
        : ''

    const [form, setForm] = useState(isEdit ? {
        ...EMPTY,
        ...contact,
        sector_ids: contact.sectors?.map((x) => x.id) ?? [],
        vertical_ids: contact.verticals?.map((x) => x.id) ?? [],
        product_ids: contact.products_rel?.map((x) => x.id) ?? [],
        cargo_id: contact.cargo?.id || null,
        campaign_ids: contact.campaigns?.map((c) => c.id) ?? [],
        notes: initialNotes,
    } : { ...EMPTY, sector_ids: [], vertical_ids: [], product_ids: [], cargo_id: null, campaign_ids: [] })

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)



    function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

    function toggleArray(field, id) {
        setForm((f) => ({
            ...f,
            [field]: f[field].includes(id)
                ? f[field].filter((x) => x !== id)
                : [...f[field], id],
        }))
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.empresa_id && !form.empresa_nombre) { 
            setError('La empresa es obligatoria')
            return 
        }
        setSaving(true)
        setError(null)
        try {
            const payload = { ...form }
            
            // Saneamiento controlado: solo para campos FK
            const FK_FIELDS = ["empresa_id", "cargo_id"]
            FK_FIELDS.forEach((field) => {
                if (payload[field] === "") {
                    payload[field] = null
                }
            })

            // Strip readonly fields (delegated to Empresa, not editable)
            CONTACT_COLUMNS.forEach((col) => {
                if (col.readonly) {
                    delete payload[col.key]
                    if (col.id_key) delete payload[col.id_key]
                }
            })

            // Parse notes JSON string → object
            if (payload.notes && typeof payload.notes === 'string') {
                try { payload.notes = JSON.parse(payload.notes) }
                catch { payload.notes = null }
            } else {
                payload.notes = null
            }

            // Remove legacy and UI-only fields that don't belong in the API payload
            delete payload.company
            delete payload.products
            delete payload.empresa
            delete payload.empresa_rel
            delete payload.id
            delete payload.enriched
            delete payload.enriched_at
            delete payload.created_at
            delete payload.updated_at

            // Remove M2M relationship objects — backend uses *_ids fields only
            delete payload.sectors
            delete payload.verticals
            delete payload.products_rel
            delete payload.cargo
            delete payload.campaigns

            if (isEdit) {
                payload.merge_lists = false
                await api.updateContact(contact.id, payload)
            } else {
                await api.upsertContact(payload)
            }
            onSaved()
        } catch (e) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <form className="modal" onSubmit={handleSubmit} noValidate>
                <div className="modal-header">
                    <h2 className="modal-title">{isEdit ? 'Editar contacto' : 'Nuevo contacto'}</h2>
                    <button type="button" className="modal-close" onClick={onClose}>✕</button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="modal-grid">
                    {CONTACT_COLUMNS.map((col) => {
                        if (col.type === 'string' || col.type === 'link') {
                            if (col.key === 'empresa') {
                                return (
                                    <div key={col.key} className="form-group full">
                                        <label className="form-label">{col.label} {col.required ? '*' : ''}</label>
                                        <CompanyAutocomplete
                                            value={form.empresa_rel?.nombre || form.empresa_nombre || ''}
                                            onChange={(name, id, emp) => {
                                                setForm(prev => {
                                                    const next = { 
                                                        ...prev, 
                                                        empresa_rel: { nombre: name }, 
                                                        empresa_id: id,
                                                        empresa_nombre: name 
                                                    };
                                                    return next;
                                                });
                                            }}
                                        />
                                    </div>
                                )
                            }
                            if (col.readonly) {
                                return (
                                    <div key={col.key} className="form-group">
                                        <label className="form-label">{col.label}</label>
                                        <input
                                            id={`field-${col.key}`}
                                            className="form-control"
                                            type="text"
                                            value={form[col.key] || ''}
                                            readOnly
                                            style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                        />
                                    </div>
                                )
                            }
                            return (
                                <div key={col.key} className={`form-group ${col.key === 'linkedin' ? 'full' : ''}`}>
                                    <label className="form-label">{col.label} {col.required ? '*' : ''}</label>
                                    <input
                                        id={`field-${col.key}`}
                                        className="form-control"
                                        type={col.key.includes('email') ? 'email' : 'text'}
                                        value={form[col.key] || ''}
                                        onChange={(e) => set(col.key, e.target.value)}
                                        required={col.required}
                                    />
                                </div>
                            )
                        } else if (col.type === 'fk') {
                            const listData = col.key === 'cargo' ? cargos : []
                            if (!listData || listData.length === 0) return null;
                            
                            return (
                                <div key={col.key} className="form-group full">
                                    <label className="form-label">{col.label}</label>
                                    <select 
                                        className="form-control"
                                        value={form[col.id_key] || ''}
                                        onChange={(e) => set(col.id_key, e.target.value === '' ? null : Number(e.target.value))}
                                    >
                                        <option value="">Selecciona un {col.label.toLowerCase()}...</option>
                                        {listData.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.name || opt.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            )
                        } else if (col.type === 'm2m') {
                            const listData = col.key === 'sectors' ? sectors
                                : col.key === 'verticals' ? verticals
                                    : col.key === 'products_rel' ? products
                                        : col.key === 'cargos' ? cargos
                                            : col.key === 'campaigns' ? campaigns : []

                            if (!listData || listData.length === 0) return null;

                            if (col.readonly) {
                                // Read-only M2M: show badges (inherited from Empresa)
                                const selectedItems = (form[col.id_key] || []).map(id => listData.find(x => x.id === id)).filter(Boolean);
                                return (
                                    <div key={col.key} className="form-group full">
                                        <label className="form-label">{col.label} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(desde Empresa)</span></label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 0', opacity: 0.7, minHeight: 32 }}>
                                            {selectedItems.length > 0
                                                ? selectedItems.map(item => (
                                                    <span key={item.id} className="badge badge-muted">{item.name || item.nombre}</span>
                                                ))
                                                : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>—</span>
                                            }
                                        </div>
                                    </div>
                                )
                            }

                            return (
                                <div key={col.key} className="form-group full">
                                    <label className="form-label">{col.label}</label>
                                    <MultiSelect
                                        options={listData}
                                        selectedIds={form[col.id_key] || []}
                                        onChange={(newIds) => set(col.id_key, newIds)}
                                        placeholder={`Selecciona opciones...`}
                                    />
                                </div>
                            )
                        }
                        return null;
                    })}
                    <div className="form-group full">
                        <label className="form-label">Notas</label>
                        <div className="form-helper-text">Información en formato JSON que será enviada al sistema de IA para enriquecer el contacto.</div>
                        <textarea
                            id="field-notes"
                            className="form-control textarea-ai"
                            rows={8}
                            style={{ fontFamily: 'monospace' }}
                            value={form.notes || ''}
                            onChange={(e) => set('notes', e.target.value)}
                            placeholder={`{\n  "direccion": "Pza. Gremio de Mareantes; 2 Bajo - 36001",\n  "municipio": "Pontevedra"\n}`}
                        />
                    </div>


                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button id="submit-contact" type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear contacto'}
                    </button>
                </div>
            </form>
        </div>
    )
}
