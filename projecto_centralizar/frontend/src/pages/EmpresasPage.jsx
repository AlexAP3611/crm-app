import React, { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../api/client'
import RowMenu from '../components/RowMenu'
import { useLookups } from '../hooks/useContacts'
import { useDebounce } from '../hooks/useDebounce'
import { useQueryParams } from '../hooks/useQueryParams'
import { ActiveFilters } from '../components/ActiveFilters'
import MultiSelect from '../components/MultiSelect'
import ContactModal from '../components/ContactModal'
import Checkbox from '../components/Checkbox'

function EmpresaConfirmDeleteModal({ count, onConfirm, onCancel, loading }) {
    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, gap: 0 }}>
                <div className="modal-header">
                    <h2 className="modal-title">Confirmar eliminación</h2>
                    <button className="modal-close" onClick={onCancel}>✕</button>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem', lineHeight: 1.6, padding: '16px 0' }}>
                    Vas a eliminar <strong style={{ color: 'var(--color-text)' }}>{count} {count === 1 ? 'empresa' : 'empresas'}</strong>. Esta acción no se puede deshacer.
                </p>
                <div className="modal-footer" style={{ marginTop: 0 }}>
                    <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
                    <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Eliminando…' : 'Eliminar empresas'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function EmpresaBulkAssignmentModal({ type, mode = 'assign', targetCount, options = [], onClose, onSave }) {
    const [selected, setSelected] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const typeNames = {
        sector_ids: 'sector',
        vertical_ids: 'vertical',
        product_ids: 'productos'
    }
    const typeName = typeNames[type] || 'elemento'
    const titleText = mode === 'assign' ? `Asignar a ${typeName}` : `Desasignar de ${typeName}`

    const handleToggle = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            const data = mode === 'unassign'
                ? { merge_lists: false, remove_lists: true }
                : { merge_lists: true }
            data[type] = selected
            await onSave(data)
        } catch (e) {
            setError(e.message)
            setSaving(false)
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <h2 className="modal-title">{titleText}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div style={{ padding: '16px 0' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
                        Vas a {mode === 'assign' ? 'asignar' : 'desasignar'} <strong style={{ color: 'var(--color-text)' }}>{targetCount} {targetCount === 1 ? 'empresa' : 'empresas'}</strong> a:
                    </p>

                    {error && <div className="alert alert-error" style={{ marginBottom: 16, fontSize: '0.85rem' }}>{error}</div>}

                    <div className="selection-list" style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.45)', display: 'flex', flexDirection: 'column' }}>
                        {options.map(opt => {
                            const isSelected = selected.includes(opt.id)
                            const label = opt.nombre || opt.name
                            return (
                                <div key={opt.id} onClick={() => handleToggle(opt.id)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', backgroundColor: isSelected ? 'rgba(79, 114, 239, 0.1)' : 'transparent', transition: 'all 0.15s ease' }}>
                                    <span style={{ color: isSelected ? 'var(--color-accent)' : 'inherit', fontWeight: isSelected ? 600 : 400, fontSize: '0.9375rem' }}>{label}</span>
                                    <Checkbox checked={isSelected} readOnly />
                                </div>
                            )
                        })}
                        {options.length === 0 && <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No hay opciones disponibles.</div>}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button className="btn btn-primary" disabled={saving || selected.length === 0} onClick={handleSave}>
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    )
}

const EMPTY_FORM = { nombre: '', cif: '', email: '', web: '', sector_ids: [], vertical_ids: [], product_ids: [], cargo_ids: [], campaign_ids: [], numero_empleados: '', facturacion: '', cnae: '' }
const BLANK_FILTERS = { q: '', sector_id: '', vertical_id: '', product_id: '', numero_empleados_min: '', numero_empleados_max: '', facturacion_min: '', facturacion_max: '', cnae: '', c_search: '', c_cargo_id: '', c_campaign_id: '', page: 1, page_size: 50 }

function DynamicM2MEditor({ empresaId, type, items, availableOptions, onSuccess }) {
    const [selectedToAssign, setSelectedToAssign] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAssign = async () => {
        if (!selectedToAssign) return;
        setLoading(true);
        try {
            const updated = await api.assignEmpresaRelation(empresaId, type, selectedToAssign);
            onSuccess(updated);
            setSelectedToAssign("");
        } catch (e) {
            alert("Error al asignar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUnassign = async (itemId) => {
        if (!window.confirm("¿Seguro que deseas desasignar este elemento?")) return;
        setLoading(true);
        try {
            const updated = await api.unassignEmpresaRelation(empresaId, type, itemId);
            onSuccess(updated);
        } catch (e) {
            alert("Error al desasignar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const unassignedOptions = availableOptions.filter(o => !items.includes(o.id));

    return (
        <div style={{ background: 'var(--color-bg)', padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: items.length > 0 ? 12 : 6 }}>
                {items.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Ninguno asignado.</span>}
                {items.map(itemId => {
                    const opt = availableOptions.find(o => o.id === itemId);
                    return (
                        <span key={itemId} className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', padding: '4px 8px' }}>
                            {opt ? (opt.name || opt.nombre) : itemId}
                            <button type="button" onClick={() => handleUnassign(itemId)} disabled={loading} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', margin: '0', lineHeight: 1, fontSize: '1.1rem', color: 'currentcolor' }} title="Desasignar">&times;</button>
                        </span>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-control" style={{ flex: 1 }} value={selectedToAssign} onChange={e => setSelectedToAssign(e.target.value)} disabled={loading || unassignedOptions.length === 0}>
                    <option value="">{unassignedOptions.length === 0 ? "Todos los elementos ya están asignados" : "-- Seleccionar listado para asignar --"}</option>
                    {unassignedOptions.map(o => (
                        <option key={o.id} value={o.id}>{o.name || o.nombre}</option>
                    ))}
                </select>
                <button type="button" className="btn btn-secondary" onClick={handleAssign} disabled={!selectedToAssign || loading}>
                    {loading ? '...' : 'Asignar'}
                </button>
            </div>
        </div>
    );
}

export default function EmpresasPage() {
    const [empresas, setEmpresas] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const { sectors, verticals, products, campaigns, cargos } = useLookups()

    const { params, setQueryParams, removeQueryParam, clearQueryParams } = useQueryParams()

    const [filters, setFilters] = useState(() => ({ ...BLANK_FILTERS, ...params }))
    const debouncedFilters = useDebounce(filters, 400)
    const abortControllerRef = useRef(null)

    const [expandedRows, setExpandedRows] = useState(new Set())
    const [totalEmpresas, setTotalEmpresas] = useState(0)

    // Modal state: { mode: 'create' | 'edit', data: { ...fields } o null si está cerrado }
    const [modalConfig, setModalConfig] = useState({ mode: 'create', data: null })
    const [contactModalConfig, setContactModalConfig] = useState({ isOpen: false, data: null })
    
    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState([])
    const [assignmentModal, setAssignmentModal] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState(null)

    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState(null)

    // Option maps for chips formatting
    const lookupMaps = useMemo(() => {
        const createMap = (arr) => arr.reduce((acc, curr) => { acc[curr.id] = (curr.name || curr.nombre); return acc; }, {});
        return {
            sector_id: createMap(sectors),
            vertical_id: createMap(verticals),
            product_id: createMap(products),
            c_campaign_id: createMap(campaigns),
            c_cargo_id: createMap(cargos),
        }
    }, [sectors, verticals, products, campaigns, cargos]);

    useEffect(() => {
        setQueryParams(debouncedFilters)
        loadEmpresas(debouncedFilters)
        
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [debouncedFilters])

    const loadEmpresas = async (currentFilters) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        setLoading(true)
        setError(null)
        try {
            const data = await api.listEmpresas(currentFilters, abortControllerRef.current.signal)
            setEmpresas(data.items || [])
            setTotalEmpresas(data.total || 0)
            setExpandedRows(new Set()) // Collapse all on refresh
        } catch (err) {
            if (err.name === 'AbortError' || err.message === 'AbortError') return;
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const currentPage = Number(filters.page) || 1
    const pageSize = Number(filters.page_size) || 50
    const totalPages = Math.ceil(totalEmpresas / pageSize)

    const setPage = (page) => {
        setFilters(prev => ({ ...prev, page }))
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleFilterChange = (key, val) => {
        setFilters(prev => ({ ...prev, [key]: val, page: 1 }))
    }

    const resetFilters = () => {
        setFilters({ ...BLANK_FILTERS })
        clearQueryParams()
    }

    const handleRemoveFilter = (key, clearAll = false) => {
        if (clearAll) {
            resetFilters()
        } else {
            handleFilterChange(key, '')
            removeQueryParam(key)
        }
    }

    const toggleRow = (id) => {
        const newSet = new Set(expandedRows)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setExpandedRows(newSet)
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setModalConfig(prev => ({
            ...prev,
            data: { ...prev.data, [name]: value }
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setFormError(null)

        const formData = modalConfig.data
        try {
            const payload = {
                nombre: formData.nombre,
                cif: formData.cif || null,
                email: formData.email || null,
                web: formData.web || null,
                sector_ids: formData.sector_ids || [],
                vertical_ids: formData.vertical_ids || [],
                product_ids: formData.product_ids || [],
                numero_empleados: formData.numero_empleados ? parseInt(formData.numero_empleados, 10) : null,
                facturacion: formData.facturacion ? parseFloat(formData.facturacion) : null,
                cnae: formData.cnae || null,
            }

            if (modalConfig.mode === 'create') {
                await api.createEmpresa(payload)
            } else {
                await api.updateEmpresa(formData.id, payload)
            }

            setModalConfig({ mode: 'create', data: null })
            loadEmpresas()
        } catch (err) {
            setFormError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDynamicM2MSuccess = (updatedEmpresa) => {
        // Automatically updates the open edit modal and reloads the table behind it
        setModalConfig(prev => ({
            ...prev,
            data: {
                ...prev.data,
                sector_ids: updatedEmpresa.sectors?.map(s => s.id) || [],
                vertical_ids: updatedEmpresa.verticals?.map(v => v.id) || [],
                product_ids: updatedEmpresa.products_rel?.map(p => p.id) || [],
            }
        }));
        loadEmpresas(debouncedFilters);
    };

    const handleEdit = (empresa) => {
        setModalConfig({
            mode: 'edit',
            data: {
                id: empresa.id,
                nombre: empresa.nombre || '',
                cif: empresa.cif || '',
                email: empresa.email || '',
                web: empresa.web || '',
                numero_empleados: empresa.numero_empleados || '',
                facturacion: empresa.facturacion || '',
                cnae: empresa.cnae || '',
                sector_ids: empresa.sectors?.map(s => s.id) || [],
                vertical_ids: empresa.verticals?.map(v => v.id) || [],
                product_ids: empresa.products_rel?.map(p => p.id) || [],
            }
        })
    }

    const handleDelete = async (empresa) => {
        setConfirmDelete({ ids: [empresa.id], single: true, label: empresa.nombre })
    }

    const resolveTargetData = async () => {
        if (selectedIds.length > 0) {
            const data = await api.listEmpresas({ ...debouncedFilters, offset: 0, limit: 100000 })
            return data.items.filter(e => selectedIds.includes(e.id))
        } else {
            const data = await api.listEmpresas({ ...debouncedFilters, offset: 0, limit: 100000 })
            return data.items
        }
    }

    const actionCount = selectedIds.length > 0 ? selectedIds.length : totalEmpresas

    const handleSelect = (id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
    const handleSelectAll = (checked) => setSelectedIds(checked ? empresas.map(c => c.id) : [])

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
                await api.deleteEmpresa(confirmDelete.ids[0])
            } else {
                await api.deleteBulkEmpresas({ ids: confirmDelete.ids.map(Number) })
                setSelectedIds([])
            }
            setConfirmDelete(null)
            loadEmpresas(debouncedFilters)
        } catch (e) {
            setDeleteError(e.message)
        } finally {
            setBulkDeleting(false)
        }
    }

    const handleCancelDelete = () => setConfirmDelete(null)

    const handleEditContact = (contact) => {
        setContactModalConfig({ isOpen: true, data: contact })
    }

    const handleDeleteContact = async (contact) => {
        if (!window.confirm(`¿Seguro que deseas eliminar el contacto "${contact.first_name} ${contact.last_name}"?`)) return
        
        setError(null)
        try {
            await api.deleteContact(contact.id)
            loadEmpresas(debouncedFilters)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleOpenCreate = () => {
        setModalConfig({ mode: 'create', data: { ...EMPTY_FORM } })
    }

    const handleCloseModal = () => {
        setModalConfig({ mode: 'create', data: null })
    }

    return (
        <div className="p-8 space-y-8 animate-[authFadeIn_0.4s_ease-out]">
            {/* Header & KPIs Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Companies</h2>
                    <p className="text-on-surface-variant font-medium">Gestionando {totalEmpresas.toLocaleString()} entidades corporativas en Prisma CRM.</p>
                </div>
            </div>

            {error && <div className="p-4 bg-error-container text-on-error-container rounded-lg font-medium text-sm">{error}</div>}

            <ActiveFilters filters={filters} onRemove={handleRemoveFilter} optionsMap={lookupMaps} />

            {/* Advanced Filter Strip */}
            <div className="bg-surface-container-low p-6 rounded-2xl border border-stone-200/50 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">tune</span> Búsqueda y Filtros
                    </h3>
                    <button className="text-[10px] font-bold text-primary uppercase tracking-tighter hover:opacity-70 bg-transparent border-none p-0 outline-none cursor-pointer" onClick={resetFilters}>Limpiar filtros</button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Empresa / Contacto</label>
                        <input 
                            className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none placeholder:text-stone-400" 
                            placeholder="Buscar nombre..." 
                            type="text" 
                            value={filters.q} 
                            onChange={e => handleFilterChange('q', e.target.value)} 
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">CNAE (Inicia con)</label>
                        <input 
                            className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none placeholder:text-stone-400" 
                            placeholder="Ej. 6201" 
                            type="text" 
                            value={filters.cnae} 
                            onChange={e => handleFilterChange('cnae', e.target.value)} 
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Sector</label>
                        <select 
                            className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none appearance-none"
                            value={filters.sector_id}
                            onChange={e => handleFilterChange('sector_id', e.target.value)}
                        >
                            <option value="">Todos</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name || s.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Vertical</label>
                        <select 
                            className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none appearance-none"
                            value={filters.vertical_id}
                            onChange={e => handleFilterChange('vertical_id', e.target.value)}
                        >
                            <option value="">Todas</option>
                            {verticals.map(v => <option key={v.id} value={v.id}>{v.name || v.nombre}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Producto</label>
                        <select 
                            className="w-full bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none appearance-none"
                            value={filters.product_id}
                            onChange={e => handleFilterChange('product_id', e.target.value)}
                        >
                            <option value="">Todos</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name || p.nombre}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Batch Actions Area */}
            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setAssignmentModal({ type: 'sector_ids', mode: 'assign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">assignment_ind</span>
                        Asignar Sector
                        <span className="bg-primary-fixed text-primary px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <button onClick={() => setAssignmentModal({ type: 'sector_ids', mode: 'unassign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">person_remove</span>
                        Desasignar Sector
                        <span className="bg-error/10 text-error px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <button onClick={() => setAssignmentModal({ type: 'vertical_ids', mode: 'assign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">category</span>
                        Asignar Vertical
                        <span className="bg-primary-fixed text-primary px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <button onClick={() => setAssignmentModal({ type: 'vertical_ids', mode: 'unassign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">remove_selection</span>
                        Desasignar Vertical
                        <span className="bg-error/10 text-error px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <button onClick={() => setAssignmentModal({ type: 'product_ids', mode: 'assign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">inventory_2</span>
                        Asignar Producto
                        <span className="bg-primary-fixed text-primary px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <button onClick={() => setAssignmentModal({ type: 'product_ids', mode: 'unassign' })} className="bg-surface-container-highest px-4 py-2 rounded-lg text-sm font-semibold text-on-surface hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200/50 shadow-sm">
                        <span className="material-symbols-outlined text-lg">remove_selection</span>
                        Desasignar Producto
                        <span className="bg-error/10 text-error px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                    <div className="flex-1"></div>
                    <button 
                        onClick={handleDeleteBulk}
                        className="bg-error/10 text-error px-4 py-2 rounded-lg text-sm font-bold hover:bg-error/20 transition-colors flex items-center gap-2 border border-error/20 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                        Eliminar
                        <span className="bg-error/20 text-error px-1.5 py-0.5 rounded text-[10px]">{actionCount}</span>
                    </button>
                </div>
            </div>
            {deleteError && <div className="p-3 bg-error-container text-on-error-container rounded text-sm mt-2">{deleteError}</div>}

            {/* Main Data Table */}
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-stone-200/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-container-low border-b border-stone-200/40">
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">
                                    <div className="flex items-center gap-4">
                                        <Checkbox 
                                            checked={selectedIds.length > 0 && selectedIds.length === empresas.length}
                                            onChange={e => handleSelectAll(e.target.checked)}
                                        />
                                        Empresa
                                    </div>
                                </th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">CNAE</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Sector</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Vertical</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Producto</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Empleados</th>
                                <th className="py-4 px-6 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right whitespace-nowrap">Facturación</th>
                                <th className="py-4 px-6 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container-low">
                            {loading && empresas.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-12 text-on-surface-variant">Cargando empresas...</td>
                                </tr>
                            ) : empresas.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-12 text-on-surface-variant">No se encontraron empresas con esos filtros.</td>
                                </tr>
                            ) : (
                                empresas.map(emp => (
                                    <React.Fragment key={emp.id}>
                                        <tr className="group hover:bg-stone-50 transition-colors cursor-pointer" onClick={() => toggleRow(emp.id)}>
                                            <td className="py-5 px-6" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-4">
                                                    <Checkbox 
                                                        checked={selectedIds.includes(emp.id)}
                                                        onChange={e => handleSelect(emp.id, e.target.checked)}
                                                    />
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center font-bold text-stone-500 text-xs border border-stone-200">
                                                            {emp.nombre ? emp.nombre.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-on-surface leading-tight hover:text-cyan-700 transition-colors" onClick={() => handleEdit(emp)}>{emp.nombre}</p>
                                                            <div className="text-[10px] text-stone-400 font-medium flex items-center gap-1 mt-0.5">
                                                                <span className="material-symbols-outlined text-[12px]">group</span>
                                                                {emp.contactos ? `${emp.contactos.length} contactos` : '0 contactos'}
                                                                {expandedRows.has(emp.id) ? '▾' : '▸'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6"><span className="text-sm font-medium text-stone-600">{emp.cnae || '-'}</span></td>
                                            <td className="py-5 px-6">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.isArray(emp.sectors) && emp.sectors.length > 0 ? emp.sectors.map(x => (
                                                        <span key={x.id} className="px-2 py-1 bg-secondary-container/50 text-on-secondary-container text-[10px] font-bold rounded uppercase tracking-wide border border-secondary-container">
                                                            {x.name || x.nombre}
                                                        </span>
                                                    )) : <span className="text-stone-400 text-sm">-</span>}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.isArray(emp.verticals) && emp.verticals.length > 0 ? emp.verticals.map(x => (
                                                        <span key={x.id} className="text-sm text-stone-600">{x.name || x.nombre}</span>
                                                    )) : <span className="text-stone-400 text-sm">-</span>}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.isArray(emp.products_rel) && emp.products_rel.length > 0 ? emp.products_rel.map(x => (
                                                        <span key={x.id} className="text-sm text-stone-600">{x.name || x.nombre}</span>
                                                    )) : <span className="text-stone-400 text-sm">-</span>}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6"><span className="text-sm text-stone-600">{emp.numero_empleados?.toLocaleString() || '-'}</span></td>
                                            <td className="py-5 px-6 text-right"><span className="text-sm font-bold text-on-surface">{emp.facturacion ? `$${emp.facturacion.toLocaleString()}` : '-'}</span></td>
                                            <td className="py-5 px-6" onClick={e => e.stopPropagation()}>
                                                <RowMenu 
                                                    onEdit={() => handleEdit(emp)} 
                                                    onDelete={() => handleDelete(emp)} 
                                                />
                                            </td>
                                        </tr>
                                        {/* Expanded Child Rows */}
                                        {expandedRows.has(emp.id) && (
                                            <tr className="bg-stone-50 border-transparent">
                                                <td colSpan="8" className="p-0">
                                                    <div className="px-16 py-4">
                                                        <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                                            {emp.contactos && emp.contactos.length > 0 ? (
                                                                <table className="w-full text-left">
                                                                    <thead className="bg-stone-100/50">
                                                                        <tr>
                                                                            <th className="py-2.5 px-4 text-[10px] font-bold text-stone-500 uppercase tracking-wider">Contacto</th>
                                                                            <th className="py-2.5 px-4 text-[10px] font-bold text-stone-500 uppercase tracking-wider">Cargo</th>
                                                                            <th className="py-2.5 px-4 text-[10px] font-bold text-stone-500 uppercase tracking-wider">Email</th>
                                                                            <th className="py-2.5 px-4 text-[10px] font-bold text-stone-500 uppercase tracking-wider">LinkedIn</th>
                                                                            <th className="py-2.5 px-4 w-10"></th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-stone-100">
                                                                        {emp.contactos.map(c => (
                                                                            <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                                                                                <td className="py-2 px-4 text-sm font-semibold text-stone-800">{c.first_name} {c.last_name}</td>
                                                                                <td className="py-2 px-4 text-sm text-stone-600">{c.job_title || '-'}</td>
                                                                                <td className="py-2 px-4 text-sm text-stone-600">{c.email_contact || c.email_generic || '-'}</td>
                                                                                <td className="py-2 px-4 text-sm text-cyan-600">{c.linkedin ? <a href={c.linkedin} target="_blank" rel="noreferrer" className="hover:underline">Perfil</a> : '-'}</td>
                                                                                <td className="py-2 px-4 text-right">
                                                                                    <RowMenu onEdit={() => handleEditContact(c)} onDelete={() => handleDeleteContact(c)} />
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div className="p-4 text-center text-sm text-stone-500">No hay contactos vinculados.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                {totalPages > 0 && (
                    <div className="flex items-center justify-between p-6 border-t border-stone-100">
                        <p className="text-xs text-stone-500">Página <span className="font-bold text-stone-900">{currentPage}</span> de {totalPages}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <button onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>



            {/* F.A.B (Create Entry) -> Mapped from original Header button */}
            <button 
                onClick={handleOpenCreate}
                className="fixed bottom-8 right-8 w-14 h-14 btn-primary-gradient text-white rounded-full flex items-center justify-center shadow-xl shadow-cyan-900/30 z-50 hover:scale-110 transition-transform active:scale-95"
            >
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'wght' 600" }}>add</span>
            </button>

            {modalConfig.data && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={handleCloseModal}></div>
                    
                    <div className="relative w-full max-w-4xl bg-surface-container-lowest rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low/50">
                            <div>
                                <h2 className="font-headline text-2xl font-bold text-on-surface">
                                    {modalConfig.mode === 'create' ? 'Register New Company' : 'Edit Company Profile'}
                                </h2>
                                <p className="text-xs text-on-surface-variant font-medium mt-1 uppercase tracking-widest">Architectural Ledger • Enterprise Node</p>
                            </div>
                            <button onClick={handleCloseModal} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                                <span className="material-symbols-outlined text-on-surface">close</span>
                            </button>
                        </div>

                        {/* Modal Content - Scrollable */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-12">
                            {formError && <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm font-bold border border-error/20">{formError}</div>}
                            
                            {/* Section: Basic Information */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-primary">info</span>
                                    <h3 className="font-headline font-bold text-lg">Basic Information</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company Name *</label>
                                        <input required name="nombre" value={modalConfig.data.nombre} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="e.g. Acme Corp" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Tax ID / CIF</label>
                                        <input name="cif" value={modalConfig.data.cif} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="B12345678" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Email Address</label>
                                        <input type="email" name="email" value={modalConfig.data.email} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="office@company.com" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Website URL</label>
                                        <input name="web" value={modalConfig.data.web} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://..." />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Employee Count</label>
                                        <input type="number" name="numero_empleados" value={modalConfig.data.numero_empleados} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Annual Revenue (€)</label>
                                        <input type="number" step="0.01" name="facturacion" value={modalConfig.data.facturacion} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CNAE Code</label>
                                        <input name="cnae" value={modalConfig.data.cnae} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="e.g. 6201" />
                                    </div>
                                </div>
                            </section>

                            <hr className="border-outline-variant/30" />

                            {/* Section: Industry Taxonomy */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-primary">category</span>
                                        <h3 className="font-headline font-bold text-lg">Industry Sectors</h3>
                                    </div>
                                    <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                        {modalConfig.mode === 'create' ? (
                                            <MultiSelect
                                                options={sectors}
                                                selectedIds={modalConfig.data.sector_ids || []}
                                                onChange={(ids) => handleChange({ target: { name: 'sector_ids', value: ids } })}
                                                placeholder="Assign sectors..."
                                            />
                                        ) : (
                                            <DynamicM2MEditor
                                                empresaId={modalConfig.data.id}
                                                type="sectors"
                                                items={modalConfig.data.sector_ids || []}
                                                availableOptions={sectors}
                                                onSuccess={handleDynamicM2MSuccess}
                                            />
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-primary">account_tree</span>
                                        <h3 className="font-headline font-bold text-lg">Business Verticals</h3>
                                    </div>
                                    <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                        {modalConfig.mode === 'create' ? (
                                            <MultiSelect
                                                options={verticals}
                                                selectedIds={modalConfig.data.vertical_ids || []}
                                                onChange={(ids) => handleChange({ target: { name: 'vertical_ids', value: ids } })}
                                                placeholder="Assign verticals..."
                                            />
                                        ) : (
                                            <DynamicM2MEditor
                                                empresaId={modalConfig.data.id}
                                                type="verticals"
                                                items={modalConfig.data.vertical_ids || []}
                                                availableOptions={verticals}
                                                onSuccess={handleDynamicM2MSuccess}
                                            />
                                        )}
                                    </div>
                                </section>
                            </div>

                            <hr className="border-outline-variant/30" />

                            {/* Section: Product Ecosystem */}
                            <section className="space-y-4 pb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-tertiary">inventory_2</span>
                                    <h3 className="font-headline font-bold text-lg text-tertiary">Product Licenses</h3>
                                </div>
                                <div className="bg-tertiary/5 p-8 rounded-3xl border border-tertiary/10">
                                    {modalConfig.mode === 'create' ? (
                                        <MultiSelect
                                            options={products}
                                            selectedIds={modalConfig.data.product_ids || []}
                                            onChange={(ids) => handleChange({ target: { name: 'product_ids', value: ids } })}
                                            placeholder="Assign product keys..."
                                        />
                                    ) : (
                                        <DynamicM2MEditor
                                            empresaId={modalConfig.data.id}
                                            type="products"
                                            items={modalConfig.data.product_ids || []}
                                            availableOptions={products}
                                            onSuccess={handleDynamicM2MSuccess}
                                        />
                                    )}
                                </div>
                            </section>
                        </form>

                        {/* Modal Footer */}
                        <div className="p-8 bg-surface-container-low border-t border-outline-variant/30 flex justify-end gap-3">
                            <button type="button" onClick={handleCloseModal} disabled={saving} className="px-6 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">
                                Cancel
                            </button>
                            <button type="submit" onClick={handleSubmit} disabled={saving} className="px-8 py-3 btn-primary-gradient text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50">
                                {saving ? 'Syncing...' : (modalConfig.mode === 'create' ? 'Create Node' : 'Commit Changes')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {assignmentModal && (
                <EmpresaBulkAssignmentModal
                    type={assignmentModal.type}
                    mode={assignmentModal.mode}
                    targetCount={actionCount}
                    options={
                        assignmentModal.type === 'sector_ids' ? sectors :
                        assignmentModal.type === 'vertical_ids' ? verticals : products
                    }
                    onClose={() => setAssignmentModal(null)}
                    onSave={async (updateData) => {
                        try {
                            const targets = await resolveTargetData()
                            await api.updateBulkEmpresas({
                                ids: targets.map(e => e.id),
                                data: updateData
                            })
                            setAssignmentModal(null)
                            setSelectedIds([])
                            loadEmpresas(debouncedFilters)
                        } catch (err) {
                            throw err
                        }
                    }}
                />
            )}

            {confirmDelete && (
                <EmpresaConfirmDeleteModal
                    count={confirmDelete.ids.length}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                    loading={bulkDeleting}
                />
            )}

            {contactModalConfig.isOpen && (
                <ContactModal
                    contact={contactModalConfig.data}
                    sectors={sectors}
                    verticals={verticals}
                    campaigns={campaigns}
                    products={products}
                    cargos={cargos}
                    onClose={() => setContactModalConfig({ isOpen: false, data: null })}
                    onSaved={() => {
                        setContactModalConfig({ isOpen: false, data: null })
                        loadEmpresas(debouncedFilters)
                    }}
                />
            )}
        </div>
    )
}
