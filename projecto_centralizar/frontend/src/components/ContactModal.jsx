import { useState } from 'react'
import { api } from '../api/client'
import CompanyAutocomplete from './CompanyAutocomplete'
import MultiSelect from './MultiSelect'
import CustomSelect from './CustomSelect'

const EMPTY = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    linkedin: '',
    cargo_id: null,
    empresa_id: null,
    sector_ids: [],
    vertical_ids: [],
    product_ids: [],
    campaign_ids: [],
    notes: ''
}

export default function ContactModal({ contact, sectors, verticals, campaigns, products, cargos, onClose, onSaved }) {
    const isEdit = !!contact
    const initialNotes = contact?.notes && Object.keys(contact.notes).length > 0
        ? JSON.stringify(contact.notes, null, 2)
        : ''

    const [form, setForm] = useState(isEdit ? {
        ...EMPTY,
        ...contact,
        empresa_id: contact.empresa_rel?.id || null,
        sector_ids: contact.sectors?.map((x) => x.id) ?? [],
        vertical_ids: contact.verticals?.map((x) => x.id) ?? [],
        product_ids: contact.products_rel?.map((x) => x.id) ?? [],
        cargo_id: contact.cargo?.id || null,
        campaign_ids: contact.campaigns?.map((c) => c.id) ?? [],
        notes: initialNotes,
    } : { ...EMPTY, empresa_id: null, sector_ids: [], vertical_ids: [], product_ids: [], cargo_id: null, campaign_ids: [] })

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

            // Strip readonly fields (delegated to Empresa, not editable in Contact)
            delete payload.sector_ids
            delete payload.vertical_ids
            delete payload.product_ids

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md animate-in fade-in duration-300"></div>

            <div className="relative w-full max-w-4xl bg-surface-container-lowest rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-8 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low/50">
                    <div>
                        <h2 className="font-headline text-2xl font-bold text-on-surface">
                            {isEdit ? 'Editar Perfil de Contacto' : 'Registrar Nuevo Contacto'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                        <span className="material-symbols-outlined text-on-surface">close</span>
                    </button>
                </div>

                {/* Modal Content - Scrollable */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-12">
                    {error && <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm font-bold border border-error/20">{error}</div>}

                    {/* Section: Personal Information */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary">person</span>
                            <h3 className="font-headline font-bold text-lg">Información Personal</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Nombre *</label>
                                <input required value={form.first_name || ''} onChange={(e) => set('first_name', e.target.value)} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Nombre" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Apellido</label>
                                <input value={form.last_name || ''} onChange={(e) => set('last_name', e.target.value)} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Apellido" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Cargo</label>
                                <CustomSelect 
                                    options={cargos}
                                    value={form.cargo_id}
                                    onChange={(val) => set('cargo_id', val)}
                                    placeholder="Seleccionar cargo..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Teléfono</label>
                                <input type="tel" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="+34 000 000 000" />
                            </div>
                        </div>
                    </section>

                    <hr className="border-outline-variant/30" />

                    {/* Section: Digital Identity */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary">alternate_email</span>
                            <h3 className="font-headline font-bold text-lg">Identidad Digital</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Correo Electrónico *</label>
                                <input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="ej. contacto@empresa.com" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">LinkedIn URL *</label>
                                <input value={form.linkedin || ''} onChange={(e) => set('linkedin', e.target.value)} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://linkedin.com/in/..." />
                            </div>
                        </div>
                        <p className="text-[11px] text-on-surface-variant/70 italic">* Se requiere Email o LinkedIn para identificar al contacto de forma única.</p>
                    </section>

                    <hr className="border-outline-variant/30" />

                    {/* Section: Company & Taxonomy */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary">business_center</span>
                            <h3 className="font-headline font-bold text-lg">Vínculo con Empresa</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Empresa</label>
                                <CompanyAutocomplete
                                    value={form.empresa_rel?.nombre || ''}
                                    onChange={(id, emp) => {
                                        setForm(prev => ({
                                            ...prev,
                                            empresa_rel: emp ? { nombre: emp.nombre } : null,
                                            empresa_id: id
                                        }));
                                    }}
                                />
                            </div>

                            {/* Inherited Taxonomy Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Sectores <span className="text-[9px] lowercase font-normal">(heredado)</span></label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {contact?.sectors?.length > 0 ? contact.sectors.map(s => (
                                            <span key={s.id} className="px-2 py-0.5 bg-surface-container-lowest text-stone-600 text-[10px] font-bold rounded uppercase border border-stone-200">{s.name || s.nombre}</span>
                                        )) : <span className="text-xs text-stone-400 italic">Sin asignar</span>}
                                    </div>
                                </div>
                                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Verticales <span className="text-[9px] lowercase font-normal">(heredado)</span></label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {contact?.verticals?.length > 0 ? contact.verticals.map(v => (
                                            <span key={v.id} className="px-2 py-0.5 bg-surface-container-lowest text-stone-600 text-[10px] font-bold rounded uppercase border border-stone-200">{v.name || v.nombre}</span>
                                        )) : <span className="text-xs text-stone-400 italic">Sin asignar</span>}
                                    </div>
                                </div>
                                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/20">
                                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">Productos <span className="text-[9px] lowercase font-normal">(heredado)</span></label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {contact?.products_rel?.length > 0 ? contact.products_rel.map(p => (
                                            <span key={p.id} className="px-2 py-0.5 bg-surface-container-lowest text-stone-600 text-[10px] font-bold rounded uppercase border border-stone-200">{p.name || p.nombre}</span>
                                        )) : <span className="text-xs text-stone-400 italic">Sin asignar</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-outline-variant/30" />

                    {/* Section: Campaigns & Notes */}
                    <section className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">campaign</span>
                                    <h3 className="font-headline font-bold text-lg">Campañas</h3>
                                </div>
                                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                    <MultiSelect
                                        options={campaigns}
                                        selectedIds={form.campaign_ids || []}
                                        onChange={(newIds) => set('campaign_ids', newIds)}
                                        placeholder="Asignar campañas..."
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">description</span>
                                    <h3 className="font-headline font-bold text-lg">Notas (IA)</h3>
                                </div>
                                <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20">
                                    <textarea
                                        rows={6}
                                        className="w-full bg-surface-container-lowest border-none text-xs p-4 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                                        value={form.notes || ''}
                                        onChange={(e) => set('notes', e.target.value)}
                                        placeholder={`{\n  "intereses": "IA Generativa",\n  "presupuesto": "Alto"\n}`}
                                    />
                                    <p className="text-[10px] text-on-surface-variant/60 mt-2 italic">Formato JSON recomendado para el sistema de enriquecimiento.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </form>

                {/* Modal Footer */}
                <div className="p-8 bg-surface-container-low border-t border-outline-variant/30 flex justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={saving} className="px-6 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-8 py-3 btn-primary-gradient text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        {saving ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Crear Contacto')}
                    </button>
                </div>
            </div>
        </div>
    )
}
