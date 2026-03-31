import { useState } from 'react'
import { api } from '../api/client'

import { CONTACT_COLUMNS } from '../config/fields'

const EMPTY = { notes: '' }
CONTACT_COLUMNS.forEach(col => {
    if (col.type === 'm2m') {
        EMPTY[col.id_key] = []
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
        cargo_ids: contact.cargos?.map((x) => x.id) ?? [],
        campaign_ids: contact.campaigns?.map((c) => c.id) ?? [],
        notes: initialNotes,
    } : { ...EMPTY, sector_ids: [], vertical_ids: [], product_ids: [], cargo_ids: [], campaign_ids: [] })

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
        if (!form.company.trim()) { setError('La empresa es obligatoria'); return }
        setSaving(true)
        setError(null)
        try {
            const payload = { ...form }
            // Convert empty strings to null for optional string fields
            CONTACT_COLUMNS.forEach((col) => {
                if ((col.type === 'string' || col.type === 'link') && payload[col.key] === '') {
                    payload[col.key] = null
                }
            })

            // legacy properties have been removed, DB only expects array properties

            // Parse notes JSON string → object
            if (payload.notes && typeof payload.notes === 'string') {
                try { payload.notes = JSON.parse(payload.notes) }
                catch { payload.notes = null }
            } else {
                payload.notes = null
            }

            // Remove legacy products field (no longer used in form)
            delete payload.products

            // Remove M2M relationship objects — backend uses *_ids fields only
            delete payload.sectors
            delete payload.verticals
            delete payload.products_rel
            delete payload.cargos
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
                            return (
                                <div key={col.key} className={`form-group ${col.key === 'company' || col.key === 'linkedin' ? 'full' : ''}`}>
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
                        } else if (col.type === 'm2m') {
                            const listData = col.key === 'sectors' ? sectors
                                : col.key === 'verticals' ? verticals
                                    : col.key === 'products_rel' ? products
                                        : col.key === 'cargos' ? cargos
                                            : col.key === 'campaigns' ? campaigns : []

                            if (!listData || listData.length === 0) return null;

                            return (
                                <div key={col.key} className="form-group full">
                                    <label className="form-label">{col.label}</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {listData.map((item) => (
                                            <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={form[col.id_key]?.includes(item.id)}
                                                    onChange={() => toggleArray(col.id_key, item.id)}
                                                />
                                                {item.name || item.nombre}
                                            </label>
                                        ))}
                                    </div>
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
