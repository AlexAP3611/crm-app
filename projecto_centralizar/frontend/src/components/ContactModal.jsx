import { useState } from 'react'
import { api } from '../api/client'

const EMPTY = {
    company: '', first_name: '', last_name: '', job_title: '',
    cif: '', dominio: '', linkedin: '', email_generic: '', email_contact: '',
    phone: '', notes: '',
}

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
            const stringFields = ['first_name', 'last_name', 'job_title', 'cif', 'dominio',
                'linkedin', 'email_generic', 'email_contact', 'phone']
            stringFields.forEach((k) => { if (payload[k] === '') payload[k] = null })

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

            if (isEdit) {
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
                    <div className="form-group full">
                        <label className="form-label">Empresa *</label>
                        <input id="field-company" className="form-control" value={form.company} onChange={(e) => set('company', e.target.value)} required placeholder="Acme Corp" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nombre</label>
                        <input id="field-first-name" className="form-control" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Apellido</label>
                        <input id="field-last-name" className="form-control" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">CIF</label>
                        <input id="field-cif" className="form-control" value={form.cif} onChange={(e) => set('cif', e.target.value)} placeholder="B12345678" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Dominio</label>
                        <input id="field-dominio" className="form-control" value={form.dominio} onChange={(e) => set('dominio', e.target.value)} placeholder="https://acme.com" />
                    </div>
                    <div className="form-group full">
                        <label className="form-label">LinkedIn</label>
                        <input id="field-linkedin" className="form-control" value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/nombre" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email (genérico)</label>
                        <input id="field-email-generic" className="form-control" type="email" value={form.email_generic} onChange={(e) => set('email_generic', e.target.value)} placeholder="info@acme.com" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email (contacto)</label>
                        <input id="field-email-contact" className="form-control" type="email" value={form.email_contact} onChange={(e) => set('email_contact', e.target.value)} placeholder="jane@acme.com" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Teléfono</label>
                        <input id="field-phone" className="form-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                    </div>
                    {sectors.length > 0 && (
                        <div className="form-group full">
                            <label className="form-label">Sectores</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {sectors.map((s) => (
                                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                        <input type="checkbox" checked={form.sector_ids.includes(s.id)} onChange={() => toggleArray('sector_ids', s.id)} />
                                        {s.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {verticals.length > 0 && (
                        <div className="form-group full">
                            <label className="form-label">Verticales</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {verticals.map((v) => (
                                    <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                        <input type="checkbox" checked={form.vertical_ids.includes(v.id)} onChange={() => toggleArray('vertical_ids', v.id)} />
                                        {v.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {(products || []).length > 0 && (
                        <div className="form-group full">
                            <label className="form-label">Productos</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {products.map((p) => (
                                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                        <input type="checkbox" checked={form.product_ids.includes(p.id)} onChange={() => toggleArray('product_ids', p.id)} />
                                        {p.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {(cargos || []).length > 0 && (
                        <div className="form-group full">
                            <label className="form-label">Cargos</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {cargos.map((c) => (
                                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                        <input type="checkbox" checked={form.cargo_ids.includes(c.id)} onChange={() => toggleArray('cargo_ids', c.id)} />
                                        {c.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
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
                    {campaigns.length > 0 && (
                        <div className="form-group full">
                            <label className="form-label">Campañas</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {campaigns.map((c) => (
                                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                        <input type="checkbox" checked={form.campaign_ids.includes(c.id)} onChange={() => toggleArray('campaign_ids', c.id)} />
                                        {c.nombre}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
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
