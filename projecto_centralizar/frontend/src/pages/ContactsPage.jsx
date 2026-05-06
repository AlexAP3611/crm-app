import React, { useState, useMemo } from 'react'
import { useContacts, useLookups } from '../hooks/useContacts'
import ContactModal from '../components/ContactModal'
import ImportContactsModal from '../components/ImportContactsModal'
import { CSVExport } from '../components/CSV'
import { api, buildScope } from '../api/client'
import RowMenu from '../components/RowMenu'
import Checkbox from '../components/Checkbox'
import { settingsService } from '../api/settingsService'


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
                    <button className="px-4 py-2 font-bold text-white btn-danger-gradient rounded-lg text-sm hover:opacity-90 transition-opacity" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Eliminando...' : 'Eliminar contactos'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function BulkAssignmentModal({ type, targetCount, options = [], onClose, onSave }) {
    const [selected, setSelected] = useState('__placeholder__')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const config = {
        'campaña': { title: 'Asignar Campaña', label: 'Campaña', icon: 'campaign', fieldKey: 'campaign_ids' },
        'cargo': { title: 'Asignar Cargo', label: 'Cargo', icon: 'work', fieldKey: 'cargo_id' },
    }
    const { title, label, icon, fieldKey } = config[type] || { title: 'Asignar', label: 'Opción', icon: 'assignment', fieldKey: 'ids' }

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            const ids = (selected === '' || selected === 'unassign' || selected === '__placeholder__') ? [] : [Number(selected)]

            let data;
            if (fieldKey === 'cargo_id') {
                data = { [fieldKey]: ids.length > 0 ? ids[0] : null }
            } else {
                data = { merge_lists: ids.length > 0, [fieldKey]: ids }
            }

            await onSave(data)
        } catch (e) {
            setError(e.message)
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-stone-200/70" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 flex items-center justify-between border-b border-stone-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center">
                            <span className="material-symbols-outlined text-stone-500 text-lg">{icon}</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-stone-900 text-base leading-tight">{title}</h2>
                            <p className="text-[11px] text-stone-400 font-medium">
                                {targetCount} {targetCount === 1 ? 'contacto seleccionado' : 'contactos seleccionados'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{label}</label>
                        <div className="relative">
                            <select
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                                className="w-full bg-stone-50 border border-stone-200 text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-stone-300 outline-none appearance-none text-stone-700 cursor-pointer transition-colors hover:border-stone-300"
                            >
                                <option value="__placeholder__" disabled>Selecciona un valor</option>
                                <option value="unassign">Sin asignar</option>
                                {options.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name || opt.nombre}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">expand_more</span>
                        </div>
                        {options.length === 0 && (
                            <p className="text-xs text-stone-400 italic">No hay opciones en datos maestros.</p>
                        )}
                    </div>
                </div>
                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                    <button className="px-4 py-2 font-medium text-stone-600 hover:bg-stone-200 rounded-lg text-sm transition-colors" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button
                        className="px-5 py-2 font-bold text-white btn-primary-gradient rounded-lg text-sm shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity active:scale-95"
                        onClick={handleSave}
                        disabled={saving || selected === '__placeholder__'}
                    >
                        {saving ? 'Guardando...' : 'Aplicar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EntityValidationBanner({ message, entities = [], onClose }) {
    if (!message && entities.length === 0) return null;

    const reasons = {
        missing_email: "Falta Email",
        missing_company: "Falta Empresa",
        "missing_email&missing_company": "Falta Email y Empresa"
    };

    return (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm border border-error/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">warning</span>
                    {message || "Requisitos no cumplidos"}
                </div>
                {onClose && (
                    <button onClick={onClose} className="hover:bg-error/10 p-1 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                )}
            </div>
            {entities.length > 0 && (
                <div className="bg-surface-container-lowest/50 rounded-lg p-3 space-y-1 mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-error-container/70 mb-2">Elementos con datos incompletos:</p>
                    <ul className="list-disc list-inside space-y-1">
                        {entities.map(ent => (
                            <li key={ent.id} className="font-medium text-xs">
                                {ent.nombre}
                                <span className="ml-2 px-1.5 py-0.5 bg-error/10 text-error text-[10px] rounded font-bold uppercase">
                                    {reasons[ent.reason] || ent.reason}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
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
    const [toolError, setToolError] = useState(null)
    const [toolMessage, setToolMessage] = useState(null)
    const [processingTool, setProcessingTool] = useState(null)
    const [invalidEntities, setInvalidEntities] = useState([])



    const actionCount = selectedIds.length > 0 ? selectedIds.length : total
    const totalPages = Math.ceil(total / filters.page_size)

    async function handleDelete(contact) {
        setConfirmDelete({ ids: [contact.id], single: true, label: contact.empresa_rel?.nombre })
    }

    const handleSelect = (id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
    const handleSelectAll = (checked) => setSelectedIds(checked ? contacts.map(c => c.id) : [])

    const handleDeleteBulk = () => {
        setConfirmDelete({
            scope: buildScope(selectedIds, filters),
            count: actionCount,
            single: false
        })
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
                await api.deleteBulkContacts(confirmDelete.scope)
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

    const handleToolExecution = async (toolKey) => {
        setToolError(null)
        setToolMessage(null)
        setInvalidEntities([])
        setProcessingTool(toolKey)

        try {
            const scope = buildScope(selectedIds, filters)
            const payload = {
                tool_key: toolKey,
                ...scope
            }

            // Use semantic alias for Affino, generic for others
            const res = (toolKey === 'Affino')
                ? await api.exportAffino(payload)
                : await api.executeContactTool(payload)

            setToolMessage(`Acción ${toolKey} iniciada con éxito. ID: ${res.run_id?.slice(0, 8)}`)
            if (selectedIds.length > 0) setSelectedIds([])
        } catch (err) {
            console.error('Tool execution failed:', err);
            if (err.data && err.data.invalid_entities) {
                setToolError(err.data.message);
                setInvalidEntities(err.data.invalid_entities);
            } else {
                setToolError(`Error al ejecutar ${toolKey}: ${err.message}`)
            }
        } finally {
            setProcessingTool(null)
        }
    }

    const clearAllFilters = () => {
        ['search', 'contacto_nombre', 'email', 'sector_id', 'vertical_id', 'campaign_id', 'product_id', 'cargo_id', 'empresa_id', 'is_enriched'].forEach((k) => updateFilter(k, ''))
    }

    const handleBulkSave = async (updateData) => {
        const scope = buildScope(selectedIds, filters)
        await api.updateBulkContacts(scope, updateData)
        setAssignmentModal(null)
        setSelectedIds([])
        refresh()
    }

    return (
        <div className="p-8 space-y-8">
            {/* Header & KPIs Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Contactos</h2>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => {
                        const link = document.createElement("a");
                        link.href = "/templates/contacts_import_template.xlsx";
                        link.download = "contacts_import_template.xlsx";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                        className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Plantilla
                    </button>
                    <CSVExport filters={filters} icon="ios_share" className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95 cursor-pointer" label="Exportar contactos" />
                    <button onClick={() => setShowImportModal(true)}
                        className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95 cursor-pointer">
                        <span className="material-symbols-outlined text-lg">input</span>
                        Importar contactos
                    </button>
                    <button
                        onClick={() => setModal('create')}
                        className="btn-primary-gradient text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Nuevo Contacto
                    </button>
                </div>
            </div>

            {error && <div className="mb-4 bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium">{error}</div>}
            {deleteError && <div className="mb-4 bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium">{deleteError}</div>}

            <EntityValidationBanner
                message={toolError}
                entities={invalidEntities}
                onClose={() => { setToolError(null); setInvalidEntities([]); }}
            />

            {toolMessage && (
                <div className="p-4 bg-teal-100 text-teal-800 rounded-xl text-sm border border-teal-200 font-medium flex items-center gap-2 animate-in fade-in duration-300">
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    {toolMessage}
                </div>
            )}

            {/* Advanced Filter Strip */}
            <div className="bg-surface-container-low p-6 rounded-2xl space-y-6 border border-stone-200/50 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">tune</span> Búsqueda y Filtros
                    </h3>
                    <button
                        onClick={clearAllFilters}
                        className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95 flex items-center gap-1.5 border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/40 whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                        Limpiar filtros
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-8 gap-4">
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
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Producto</label>
                        <select value={filters.product_id || ''} onChange={e => updateFilter('product_id', e.target.value)} className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer">
                            <option value="">Todos los Productos</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name || p.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Campaña</label>
                        <select value={filters.campaign_id || ''} onChange={e => updateFilter('campaign_id', e.target.value)} className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer">
                            <option value="">Todas</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name || c.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Cargo</label>
                        <select
                            value={filters.cargo_id || ''}
                            onChange={e => updateFilter('cargo_id', e.target.value)}
                            className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Todos los Cargos</option>
                            {cargos.map(c => <option key={c.id} value={c.id}>{c.name || c.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Estado (Enriquecido)</label>
                        <select
                            value={filters.is_enriched === true ? 'true' : filters.is_enriched === false ? 'false' : ''}
                            onChange={e => updateFilter('is_enriched', e.target.value === '' ? '' : e.target.value === 'true')}
                            className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Cualquier estado</option>
                            <option value="true">Enriquecido</option>
                            <option value="false">No Enriquecido</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Batch Actions Area */}
            <div className="space-y-3">
                {/* Fila 1: Asignar + Eliminar */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setAssignmentModal({ type: 'campaña', mode: 'assign' })}
                        className="btn-primary-gradient text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        <span className="material-symbols-outlined text-lg">assignment_ind</span>
                        Asignar a campaña
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                    <button
                        onClick={() => setAssignmentModal({ type: 'cargo', mode: 'assign' })}
                        className="btn-primary-gradient text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        <span className="material-symbols-outlined text-lg">category</span>
                        Asignar a cargo
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                    <div className="flex-1"></div>
                    <button 
                        onClick={handleDeleteBulk} 
                        className="btn-danger-gradient text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-error/50 hover:brightness-110"
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                        Eliminar
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                </div>

                {/* Fila 2: Integraciones (Affino, etc.) */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => handleToolExecution('Affino')}
                        disabled={!!processingTool}
                        className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95"
                    >
                        <span className="material-symbols-outlined text-lg">send</span>
                        Enviar a Affino {processingTool === 'Affino' && '...'}
                        <span className="bg-transparent px-1.5 rounded-md ml-1">{actionCount}</span>
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
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Empresa</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Email</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Sector</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Vertical</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Producto</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Enriquecido</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Fecha Enriquecimiento</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container-low">
                            {loading && contacts.length === 0 ? (
                                <tr><td colSpan="9" className="py-20 text-center text-stone-400">Cargando contactos...</td></tr>
                            ) : contacts.length === 0 ? (
                                <tr><td colSpan="9" className="py-20 text-center text-stone-400">No se encontraron contactos que coincidan con los criterios.</td></tr>
                            ) : contacts.map(c => (
                                <tr key={c.id} className="group hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => setModal(c)}>
                                    <td className="py-5 px-6">
                                        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.includes(c.id)}
                                                onChange={e => handleSelect(c.id, e.target.checked)}
                                            />
                                            <div className="flex items-center gap-3 text-sm font-bold text-on-surface whitespace-nowrap">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-primary text-xs uppercase flex-shrink-0">
                                                    {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                                                </div>
                                                {c.first_name} {c.last_name}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-5 px-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-on-surface">{c.empresa_rel?.nombre || '-'}</span>
                                            <span className="text-[10px] text-stone-400 font-medium">
                                                {c.cargo?.name || c.cargo?.nombre || '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-5 px-6">
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-stone-600 font-medium">{c.email || '-'}</p>
                                            {c.email_generic && <p className="text-[10px] text-stone-400 italic">{c.email_generic}</p>}
                                        </div>
                                    </td>
                                    <td className="py-5 px-6">
                                        {c.sectors?.[0]?.name || c.sectors?.[0]?.nombre ? (
                                            <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold rounded uppercase tracking-wide inline-block w-fit">
                                                {c.sectors[0].name || c.sectors[0].nombre}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">-</span>
                                        )}
                                    </td>
                                    <td className="py-5 px-6">
                                        {c.verticals?.[0]?.name || c.verticals?.[0]?.nombre ? (
                                            <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold rounded uppercase tracking-wide inline-block w-fit">
                                                {c.verticals[0].name || c.verticals[0].nombre}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">-</span>
                                        )}
                                    </td>
                                    <td className="py-5 px-6">
                                        {c.products_rel && c.products_rel.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {c.products_rel.map(p => (
                                                    <span key={p.id} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold rounded uppercase tracking-wide">
                                                        {p.name || p.nombre}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : <span className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">-</span>}
                                    </td>
                                    <td className="py-5 px-6">
                                        {c.enriched ? (
                                            <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold rounded-lg uppercase tracking-wide inline-flex items-center gap-1.5 whitespace-nowrap">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Sí
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 bg-stone-50 text-stone-600 border border-stone-200 text-[10px] font-bold rounded-lg uppercase tracking-wide inline-flex items-center gap-1.5 whitespace-nowrap">
                                                <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span> No
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-5 px-6">
                                        {c.enriched_at ? (
                                            <span className="text-[11px] text-stone-600 font-medium whitespace-nowrap">
                                                {new Date(c.enriched_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wide">-</span>
                                        )}
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
                            <button onClick={() => setPage(1)} disabled={filters.page <= 1} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">first_page</span>
                            </button>
                            <button onClick={() => setPage(Math.max(1, filters.page - 1))} disabled={filters.page <= 1} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <button onClick={() => setPage(Math.min(totalPages, filters.page + 1))} disabled={filters.page >= totalPages} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                            <button onClick={() => setPage(totalPages)} disabled={filters.page >= totalPages} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">last_page</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Assignment Modal */}
            {assignmentModal && (
                <BulkAssignmentModal
                    type={assignmentModal.type}
                    targetCount={actionCount}
                    options={assignmentModal.type === 'campaña' ? campaigns : cargos}
                    onClose={() => setAssignmentModal(null)}
                    onSave={handleBulkSave}
                />
            )}

            {/* Contact Edit / Create Modal */}
            {modal && (
                <ContactModal
                    contact={modal === 'create' ? null : modal}
                    sectors={sectors}
                    verticals={verticals}
                    campaigns={campaigns}
                    products={products}
                    cargos={cargos}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); refresh() }}
                />
            )}

            {/* Confirm Delete Modal */}
            {confirmDelete && (
                <ConfirmDeleteModal
                    count={confirmDelete.single ? 1 : confirmDelete.count}
                    loading={bulkDeleting}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}

            {/* CSV Import Modal */}
            {showImportModal && (
                <ImportContactsModal
                    onClose={() => setShowImportModal(false)}
                    onImported={() => { refresh() }}
                />
            )}

        </div>
    )
}
