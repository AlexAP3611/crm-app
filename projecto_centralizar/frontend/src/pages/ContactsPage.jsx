import React, { useState, useMemo } from 'react'
import { useContacts, useLookups } from '../hooks/useContacts'
import ContactModal from '../components/ContactModal'
import { CSVImport, CSVExport } from '../components/CSV'
import { api } from '../api/client'
import RowMenu from '../components/RowMenu'
import Checkbox from '../components/Checkbox'

// Modals are locally defined or can be imported if extracted later. We'll duplicate them here to keep it simple, or write simple versions using standard HTML dialog.
function ConfirmDeleteModal({ count, onConfirm, onCancel, loading }) {
    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4" onClick={onCancel}>
            <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-stone-100">
                    <h2 className="font-display text-lg font-bold text-stone-900">Confirmar eliminación</h2>
                </div>
                <div className="p-6">
                    <p className="text-stone-600 text-sm">
                        Vas a eliminar <strong className="text-stone-900">{count} {count === 1 ? 'contacto' : 'contactos'}</strong>. Esta acción no se puede deshacer.
                    </p>
                </div>
                <div className="px-6 py-4 bg-surface-container-low flex justify-end gap-3">
                    <button className="px-4 py-2 font-medium text-stone-600 hover:bg-stone-200 rounded-lg text-sm transition-colors" onClick={onCancel} disabled={loading}>Cancelar</button>
                    <button className="px-4 py-2 font-bold text-white bg-error rounded-lg text-sm hover:opacity-90 transition-opacity" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Eliminando...' : 'Eliminar contactos'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function BulkAssignmentModal({ type, mode = 'assign', targetCount, options = [], onClose, onSave }) {
    const [selected, setSelected] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const titles = {
        campaña: mode === 'assign' ? 'Asignar a campaña' : 'Desasignar de campaña',
        cargo: mode === 'assign' ? 'Asignar a cargo' : 'Desasignar de cargo'
    }

    const handleToggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            const data = mode === 'unassign' ? { merge_lists: false, remove_lists: true } : { merge_lists: true }
            if (type === 'campaña') data.campaign_ids = selected
            else if (type === 'cargo') data.cargo_ids = selected
            await onSave(data)
        } catch (e) {
            setError(e.message)
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                    <h2 className="font-display text-lg font-bold text-stone-900">{titles[type] || (mode === 'assign' ? 'Asignar' : 'Desasignar')}</h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="p-6">
                    <p className="text-stone-600 text-sm mb-4">Vas a {mode === 'assign' ? 'asignar' : 'desasignar'} <strong className="text-stone-900">{targetCount} {targetCount === 1 ? 'contacto' : 'contactos'}</strong> a:</p>
                    {error && <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">{error}</div>}
                    <div className="max-h-60 overflow-y-auto border border-stone-200 rounded-lg shadow-inner bg-stone-50/50">
                        {options.map(opt => {
                            const isSelected = selected.includes(opt.id)
                            return (
                                <div key={opt.id} onClick={() => handleToggle(opt.id)} className={`p-3 flex justify-between items-center cursor-pointer border-b border-stone-200 last:border-0 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-stone-100'}`}>
                                    <span className={`text-sm ${isSelected ? 'text-primary font-semibold' : 'text-stone-700'}`}>{opt.nombre || opt.name}</span>
                                    <Checkbox checked={isSelected} readOnly />
                                </div>
                            )
                        })}
                        {options.length === 0 && <div className="p-6 text-center text-stone-500 text-sm italic">No hay opciones disponibles.</div>}
                    </div>
                </div>
                <div className="px-6 py-4 bg-surface-container-low flex justify-end gap-3">
                    <button className="px-4 py-2 font-medium text-stone-600 hover:bg-stone-200 rounded-lg text-sm transition-colors" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button className="px-4 py-2 font-bold text-white bg-gradient-to-r from-primary to-primary-container rounded-lg text-sm shadow hover:opacity-90 disabled:opacity-50 transition-opacity" disabled={saving || selected.length === 0} onClick={handleSave}>
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function ContactsPage() {
    const { contacts, total, loading, error, filters, updateFilter, removeFilter, setPage, setPageSize, refresh } = useContacts()
    const { sectors, verticals, campaigns, products, cargos } = useLookups()

    const [modal, setModal] = useState(null)
    const [showImportModal, setShowImportModal] = useState(false)
    const [deleting, setDeleting] = useState(null)
    const [deleteError, setDeleteError] = useState(null)
    const [selectedIds, setSelectedIds] = useState([])
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [assignmentModal, setAssignmentModal] = useState(null)
    const [enrichError, setEnrichError] = useState(null)
    const [enrichMessage, setEnrichMessage] = useState(null)
    const [enriching, setEnriching] = useState(null)

    const resolveTargetData = async () => {
        if (selectedIds.length > 0) {
            const data = await api.listContacts({ ...filters, page: 1, page_size: 100000 })
            return data.items.filter(c => selectedIds.includes(c.id))
        } else {
            const data = await api.listContacts({ ...filters, page: 1, page_size: 100000 })
            return data.items
        }
    }

    const actionCount = selectedIds.length > 0 ? selectedIds.length : total
    const totalPages = Math.ceil(total / filters.page_size)

    async function handleDelete(contact) {
        setConfirmDelete({ ids: [contact.id], single: true, label: contact.company })
    }

    const handleSelect = (id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
    const handleSelectAll = (checked) => setSelectedIds(checked ? contacts.map(c => c.id) : [])

    const handleDeleteBulk = async () => {
        const targets = await resolveTargetData()
        setConfirmDelete({ ids: targets.map(c => c.id), single: false })
    }

    const handleConfirmDelete = async () => {
        if (!confirmDelete) return
        setBulkDeleting(true)
        setDeleteError(null)
        try {
            if (confirmDelete.single) {
                setDeleting(confirmDelete.ids[0])
                await api.deleteContact(confirmDelete.ids[0])
            } else {
                const ids = confirmDelete.ids.map((id) => Number(id))
                await api.deleteBulkContacts({ ids })
                setSelectedIds([])
            }
            setConfirmDelete(null)
            refresh()
        } catch (e) {
            setDeleteError(e.message)
        } finally {
            setBulkDeleting(false)
            setDeleting(null)
        }
    }

    const handleEnrich = async (service) => {
        setEnrichError(null)
        setEnrichMessage(null)
        const stored = localStorage.getItem('webhooks_integrations')
        let integrations = []
        try { if (stored) integrations = JSON.parse(stored) } catch (e) { }
        const integration = integrations.find(i => i.nombre_aplicacion === service)
        if (!integration || !integration.webhook || !integration.webhook.trim()) {
            setEnrichError('Falta la URL del webhook')
            return
        }
        setEnriching(service)
        try {
            const resolvedContacts = await resolveTargetData()
            const sinDominio = resolvedContacts.some(c => !c.web || !c.web.trim())
            if (sinDominio) {
                setEnrichError('La web (dominio) es obligatoria para enriquecer contactos')
                setEnriching(null)
                return
            }
            const payload = {
                contacts: resolvedContacts.map(c => ({
                    id_contacto: c.id,
                    nombre_empresa: c.company,
                    web: c.web,
                    dominio: c.web,
                    vertical: c.verticals && c.verticals.length > 0 ? c.verticals[0].name : null
                }))
            }
            const headers = { 'Content-Type': 'application/json' }
            const type = integration.auth_type || 'Ninguno'
            const key = integration.api_key ? integration.api_key.trim() : ''
            if (type === 'HeaderAuth' && key) headers['Authentication'] = key
            else if (type === 'BasicAuth' && key) headers['Authorization'] = `Basic ${btoa(key)}`
            else if (!integration.auth_type && key) headers['Authorization'] = `Bearer ${key}`

            const res = await fetch(integration.webhook, { method: 'POST', headers, body: JSON.stringify(payload) })
            if (res.status === 401 || res.status === 403) { setEnrichError('API key inválida'); return }
            if (!res.ok) throw new Error('Request failed')
            setEnrichMessage(`Enriquecimiento enviado correctamente a ${service}`)
        } catch (err) {
            setEnrichError(`Error al enviar datos a ${service}`)
        } finally {
            setEnriching(null)
        }
    }

    const clearAllFilters = () => {
        ['search', 'contacto_nombre', 'email', 'cnae', 'sector_id', 'vertical_id', 'campaign_id', 'product_id', 'cargo_id', 'empresa_id', 'empresa_nombre'].forEach((k) => updateFilter(k, ''))
    }

    return (
        <div className="p-8 space-y-8">
            {/* Header & KPIs Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Contactos</h2>
                    <p className="text-on-surface-variant font-medium">Gestionando {total?.toLocaleString() || 0} contactos en el CRM.</p>
                </div>
            </div>

            {error && <div className="mb-4 bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium">{error}</div>}
            {deleteError && <div className="mb-4 bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium">{deleteError}</div>}
            {enrichError && <div className="mb-4 bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium">{enrichError}</div>}
            {enrichMessage && <div className="mb-4 bg-primary-fixed/30 text-primary p-4 rounded-xl text-sm font-medium">{enrichMessage}</div>}

            {/* Advanced Filter Strip */}
            <div className="bg-surface-container-low p-6 rounded-2xl space-y-6 border border-stone-200/50 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">tune</span> Filtros Avanzados
                    </h3>
                    <button onClick={clearAllFilters} className="text-[10px] font-bold text-primary uppercase tracking-tighter hover:opacity-70 bg-transparent border-none p-0 outline-none cursor-pointer">Limpiar filtros</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Nombre del Contacto</label>
                        <input value={filters.contacto_nombre || ''} onChange={e => updateFilter('contacto_nombre', e.target.value)} className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-stone-300" placeholder="ej. Adrian" type="text" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Email</label>
                        <input value={filters.email || ''} onChange={e => updateFilter('email', e.target.value)} className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-stone-300" placeholder="ej. alex@sterling.com" type="text" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Sector</label>
                        <select value={filters.sector_id || ''} onChange={e => updateFilter('sector_id', e.target.value)} className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer">
                            <option value="">Todos los Sectores</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name || s.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Vertical</label>
                        <select value={filters.vertical_id || ''} onChange={e => updateFilter('vertical_id', e.target.value)} className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer">
                            <option value="">Todas las Verticales</option>
                            {verticals.map(h => <option key={h.id} value={h.id}>{h.name || h.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Cargo / Rol</label>
                        <input value={filters.cargo_id || ''} onChange={e => updateFilter('cargo_id', e.target.value)} className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-stone-300" placeholder="ej. CTO" type="text" />
                    </div>
                </div>
            </div>

            {/* Batch Actions Area */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setAssignmentModal({ type: 'campaña', mode: 'assign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">assignment_ind</span>
                        Asignar Campaña
                        <span className="bg-primary-fixed text-primary px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <button onClick={() => setAssignmentModal({ type: 'campaña', mode: 'unassign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">person_remove</span>
                        Desasignar Campaña
                        <span className="bg-error/10 text-error px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <button onClick={() => setAssignmentModal({ type: 'cargo', mode: 'assign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">category</span>
                        Asignar Rol
                        <span className="bg-primary-fixed text-primary px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <button onClick={() => setAssignmentModal({ type: 'cargo', mode: 'unassign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">remove_selection</span>
                        Desasignar Rol
                        <span className="bg-error/10 text-error px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <div className="flex-1"></div>
                    <CSVExport filters={filters} icon="ios_share" className="text-sm font-semibold text-stone-600 hover:text-stone-900 hover:font-bold" label="Exportar CSV" />
                    <button onClick={() => setShowImportModal(true)} className="text-sm font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-2 bg-transparent border-none cursor-pointer transition-all hover:font-bold">
                        <span className="material-symbols-outlined text-lg">input</span>
                        Importar CSV
                    </button>
                    <button onClick={() => setModal('create')} className="btn-primary-gradient text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm">
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Nuevo Contacto
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => handleEnrich('Apollo')} className="bg-primary/5 border border-primary/20 px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                        Enriquecer con Apollo {enriching === 'Apollo' && '...'}
                    </button>
                    <button onClick={() => handleEnrich('Clay')} className="bg-primary/5 border border-primary/20 px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">search_insights</span>
                        Enriquecer con Clay {enriching === 'Clay' && '...'}
                    </button>
                    <button onClick={() => handleEnrich('Adscore')} className="bg-primary/5 border border-primary/20 px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">contact_page</span>
                        Enriquecer con Adscore {enriching === 'Adscore' && '...'}
                    </button>
                    <button onClick={handleDeleteBulk} className="bg-error/10 border border-error/20 px-4 py-2 rounded-lg text-sm font-bold text-error hover:bg-error/20 transition-colors flex items-center gap-2 ml-auto">
                        <span className="material-symbols-outlined text-lg">delete</span>
                        Eliminar
                        <span className="bg-error/20 text-error px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                </div>
            </div>

            {/* Main Data Table (Editorial Style) */}
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-stone-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-container-low">
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            checked={contacts.length > 0 && selectedIds.length === contacts.length}
                                            onChange={e => handleSelectAll(e.target.checked)}
                                        />
                                        Contacto
                                    </div>
                                </th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Emails</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Sector</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Vertical</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Producto</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container-low">
                            {loading && contacts.length === 0 ? (
                                <tr><td colSpan="5" className="py-20 text-center text-stone-400">Cargando contactos...</td></tr>
                            ) : contacts.length === 0 ? (
                                <tr><td colSpan="5" className="py-20 text-center text-stone-400">No se encontraron contactos que coincidan con los criterios.</td></tr>
                            ) : contacts.map(c => (
                                <tr key={c.id} className="group hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => setModal(c)}>
                                    <td className="py-5 px-6">
                                        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                            <Checkbox 
                                                checked={selectedIds.includes(c.id)}
                                                onChange={e => handleSelect(c.id, e.target.checked)}
                                            />
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-primary text-xs uppercase">
                                                    {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-on-surface">{c.first_name} {c.last_name}</p>
                                                    <p className="text-[10px] text-stone-400">
                                                        {c.cargos?.[0]?.nombre || 'Cargo Genérico'} en <span className="font-semibold">{c.company}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-5 px-6">
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-stone-600 font-medium">{c.email_contact || 'Sin email personal'}</p>
                                            {c.email_generic && <p className="text-[10px] text-stone-400 italic">{c.email_generic}</p>}
                                        </div>
                                    </td>
                                    <td className="py-5 px-6">
                                        <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded uppercase tracking-wide inline-block w-fit">
                                            {c.sectors?.[0]?.name || c.sectors?.[0]?.nombre || 'Sin Sector'}
                                        </span>
                                    </td>
                                    <td className="py-5 px-6">
                                        <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold rounded uppercase tracking-wide inline-block w-fit">
                                            {c.verticals?.[0]?.name || c.verticals?.[0]?.nombre || 'Sin Vertical'}
                                        </span>
                                    </td>
                                    <td className="py-5 px-6">
                                        {c.products_rel && c.products_rel.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {c.products_rel.map(p => (
                                                    <span key={p.id} className="px-2 py-1 bg-primary-fixed/20 text-primary text-[10px] font-bold rounded uppercase tracking-wide">
                                                        {p.name || p.nombre}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span className="text-[10px] text-stone-300">Sin Producto</span>}
                                    </td>
                                    <td className="py-5 px-6 text-right" onClick={e => e.stopPropagation()}>
                                        <RowMenu onEdit={() => setModal(c)} onDelete={() => handleDelete(c)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                {totalPages > 0 && (
                    <div className="flex items-center justify-between p-6 border-t border-stone-100">
                        <p className="text-xs text-stone-500">Página <span className="font-bold text-stone-900">{filters.page}</span> de {totalPages}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(filters.page - 1)} disabled={filters.page <= 1} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <button onClick={() => setPage(filters.page + 1)} disabled={filters.page >= totalPages} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </div>
    )
}
