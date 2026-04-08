import React, { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../api/client'
import RowMenu from '../components/RowMenu'
import { useLookups } from '../hooks/useContacts'
import { useDebounce } from '../hooks/useDebounce'
import { useQueryParams } from '../hooks/useQueryParams'
import { ActiveFilters } from '../components/ActiveFilters'
import MultiSelect from '../components/MultiSelect'
import ContactModal from '../components/ContactModal'

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
                                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? 'var(--color-accent)' : 'transparent', transition: 'all 0.15s ease' }}>
                                        {isSelected && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>✓</span>}
                                    </div>
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
const BLANK_FILTERS = { q: '', sector_id: '', vertical_id: '', product_id: '', numero_empleados_min: '', numero_empleados_max: '', facturacion_min: '', facturacion_max: '', cnae: '', c_search: '', c_cargo_id: '', c_campaign_id: '' }

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

    const handleFilterChange = (key, val) => {
        setFilters(prev => ({ ...prev, [key]: val }))
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
        <div className="page-wrap">
            <div className="top-action-bar">
                <div className="top-search-wrap">
                    <input type="text" className="search-input" placeholder="Buscar empresas por nombre..." value={filters.q} onChange={e => handleFilterChange('q', e.target.value)} />
                </div>
                <div className="top-actions">
                    <button className="btn btn-primary" onClick={handleOpenCreate}>
                        Crear Empresa
                    </button>
                </div>
            </div>

            <div className="page-title-wrap">
                <h1 className="page-title">Directorio de Empresas</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginTop: 8 }}>
                    Organiza y filtra las empresas usando múltiples parámetros y listados basados en atributos de contactos.
                </p>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            <ActiveFilters filters={filters} onRemove={handleRemoveFilter} optionsMap={lookupMaps} />

            {/* Filter Bar */}
            <div className="filter-card" style={{ marginTop: 16 }}>
                <div>
                    <div className="filter-section-wrapper">
                        
                        {/* Company Filters */}
                        <div className="filter-section">
                            <div className="filter-section-title">
                                <svg className="title-icon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                Filtros de Empresa
                            </div>
                            <div className="filter-grid dense">
                                <div className="form-group">
                                    <select className="form-control" value={filters.sector_id} onChange={e => handleFilterChange('sector_id', e.target.value)}>
                                        <option value="">Todos los Sectores</option>
                                        {sectors.map(s => <option key={s.id} value={s.id}>{s.name || s.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <select className="form-control" value={filters.vertical_id} onChange={e => handleFilterChange('vertical_id', e.target.value)}>
                                        <option value="">Todas las Verticales</option>
                                        {verticals.map(v => <option key={v.id} value={v.id}>{v.name || v.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <select className="form-control" value={filters.product_id} onChange={e => handleFilterChange('product_id', e.target.value)}>
                                        <option value="">Todos los Productos</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name || p.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <input className="form-control" placeholder="CNAE..." value={filters.cnae} onChange={e => handleFilterChange('cnae', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input type="number" className="form-control" placeholder="Mín empleados" value={filters.numero_empleados_min} onChange={e => handleFilterChange('numero_empleados_min', e.target.value)} />
                                        <input type="number" className="form-control" placeholder="Máx empleados" value={filters.numero_empleados_max} onChange={e => handleFilterChange('numero_empleados_max', e.target.value)} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input type="number" className="form-control" placeholder="Mín facturación" value={filters.facturacion_min} onChange={e => handleFilterChange('facturacion_min', e.target.value)} />
                                        <input type="number" className="form-control" placeholder="Máx" value={filters.facturacion_max} onChange={e => handleFilterChange('facturacion_max', e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Filters */}
                        <div className="filter-section">
                            <div className="filter-section-title">
                                <svg className="title-icon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Contactos Asociados (Join)
                            </div>
                            <div className="filter-grid dense">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <input className="form-control" placeholder="Buscar nombre/email del contacto..." value={filters.c_search} onChange={e => handleFilterChange('c_search', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <select className="form-control" value={filters.c_campaign_id} onChange={e => handleFilterChange('c_campaign_id', e.target.value)}>
                                        <option value="">Todas las Campañas</option>
                                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name || c.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <select className="form-control" value={filters.c_cargo_id} onChange={e => handleFilterChange('c_cargo_id', e.target.value)}>
                                        <option value="">Todos los cargos</option>
                                        {cargos.map(c => <option key={c.id} value={c.id}>{c.name || c.nombre}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                    </div>
                    
                    <div className="filter-actions">
                        <button type="button" className="btn btn-secondary" onClick={resetFilters}>Limpiar Filtros</button>
                    </div>
                </div>
            </div>

            {/* 4. Bulk Actions Bar */}
            <div className="bulk-actions-bar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 16 }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-bulk" onClick={() => setAssignmentModal({ type: 'sector_ids', mode: 'assign' })}>Asignar a sector ({actionCount})</button>
                    <button className="btn-bulk" onClick={() => setAssignmentModal({ type: 'vertical_ids', mode: 'assign' })}>Asignar a vertical ({actionCount})</button>
                    <button className="btn-bulk" onClick={() => setAssignmentModal({ type: 'product_ids', mode: 'assign' })}>Asignar a productos ({actionCount})</button>
                    <button className="btn-bulk btn-bulk-danger" style={{ marginLeft: 'auto' }} onClick={handleDeleteBulk}>Borrar ({actionCount}) empresas</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-bulk btn-bulk-unassign" onClick={() => setAssignmentModal({ type: 'sector_ids', mode: 'unassign' })}>Desasignar sector ({actionCount})</button>
                    <button className="btn-bulk btn-bulk-unassign" onClick={() => setAssignmentModal({ type: 'vertical_ids', mode: 'unassign' })}>Desasignar vertical ({actionCount})</button>
                    <button className="btn-bulk btn-bulk-unassign" onClick={() => setAssignmentModal({ type: 'product_ids', mode: 'unassign' })}>Desasignar productos ({actionCount})</button>
                </div>
                {deleteError && <div className="alert alert-error">{deleteError}</div>}
            </div>

            <div className="card" style={{ marginTop: 16 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 40, textAlign: 'center' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.length > 0 && selectedIds.length === empresas.length} 
                                        onChange={e => handleSelectAll(e.target.checked)} 
                                    />
                                </th>
                                <th style={{ width: 40 }}>+</th>
                                <th>Nombre</th>
                                <th>CIF</th>
                                <th>Email</th>
                                <th>Web</th>
                                <th>Sector</th>
                                <th>Vertical</th>
                                <th>Producto</th>
                                <th>Empleados</th>
                                <th>Facturación</th>
                                <th>CNAE</th>
                                <th style={{ width: 60 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="12" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                                        Cargando vista combinada...
                                    </td>
                                </tr>
                            ) : empresas.length === 0 ? (
                                <tr>
                                    <td colSpan="12" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                                        No hay coincidencias.
                                    </td>
                                </tr>
                            ) : (
                                empresas.map(emp => (
                                    <React.Fragment key={emp.id}>
                                <tr style={{ background: expandedRows.has(emp.id) ? 'var(--color-bg-subtle)' : 'transparent', transition: 'background 0.2s' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.includes(emp.id)} 
                                                    onChange={e => handleSelect(emp.id, e.target.checked)} 
                                                />
                                            </td>
                                            <td onClick={() => toggleRow(emp.id)} style={{ cursor: 'pointer', textAlign: 'center', userSelect: 'none', fontWeight: 'bold' }}>
                                                {expandedRows.has(emp.id) ? '▾' : '▸'}
                                            </td>
                                            <td style={{ fontWeight: 500 }}>
                                                {emp.nombre}
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                    {emp.contactos ? `${emp.contactos.length} contactos resultantes` : '0 contactos'}
                                                </div>
                                            </td>
                                            <td>{emp.cif || <span style={{ color: 'var(--color-text-muted)' }}>-</span>}</td>
                                            <td>{emp.email || <span style={{ color: 'var(--color-text-muted)' }}>-</span>}</td>
                                            <td>{emp.web || <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>}</td>
                                            <td>{Array.isArray(emp.sectors) && emp.sectors.length > 0 ? emp.sectors.map(x => <span key={x.id} className="badge badge-muted" style={{marginRight:4, display:'inline-block', marginBottom:4}}>{x.name||x.nombre}</span>) : <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>}</td>
                                            <td>{Array.isArray(emp.verticals) && emp.verticals.length > 0 ? emp.verticals.map(x => <span key={x.id} className="badge badge-muted" style={{marginRight:4, display:'inline-block', marginBottom:4}}>{x.name||x.nombre}</span>) : <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>}</td>
                                            <td>{Array.isArray(emp.products_rel) && emp.products_rel.length > 0 ? emp.products_rel.map(x => <span key={x.id} className="badge badge-muted" style={{marginRight:4, display:'inline-block', marginBottom:4}}>{x.name||x.nombre}</span>) : <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>}</td>
                                            <td>{emp.numero_empleados?.toLocaleString() || <span style={{ color: 'var(--color-text-muted)' }}>-</span>}</td>
                                            <td>{emp.facturacion ? `$${emp.facturacion.toLocaleString()}` : <span style={{ color: 'var(--color-text-muted)' }}>-</span>}</td>
                                            <td>{emp.cnae || <span style={{ color: 'var(--color-text-muted)' }}>-</span>}</td>
                                            <td>
                                                <RowMenu 
                                                    onEdit={() => handleEdit(emp)} 
                                                    onDelete={() => handleDelete(emp)} 
                                                />
                                            </td>
                                        </tr>
                                        {expandedRows.has(emp.id) && (
                                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                                <td colSpan="12" style={{ padding: '16px 40px', borderTop: 0 }}>
                                                    {emp.contactos && emp.contactos.length > 0 ? (
                                                        <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                                                            <table className="table" style={{ width: '100%', margin: 0 }}>
                                                                <thead style={{ background: 'var(--color-bg-subtle)' }}>
                                                                    <tr>
                                                                        <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Contacto</th>
                                                                        <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Cargo</th>
                                                                        <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Email</th>
                                                                        <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>LinkedIn</th>
                                                                        <th style={{ padding: '8px 12px', fontSize: '0.8rem', width: 60 }}></th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {emp.contactos.map(c => (
                                                                        <tr key={c.id}>
                                                                            <td style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                                                                                <strong>{c.first_name} {c.last_name}</strong>
                                                                            </td>
                                                                            <td style={{ padding: '8px 12px', fontSize: '0.9rem' }}>{c.job_title || <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>}</td>
                                                                            <td style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                                                                                {c.email_contact || c.email_generic || <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>}
                                                                            </td>
                                                                            <td style={{ padding: '8px 12px', fontSize: '0.9rem' }}>
                                                                                {c.linkedin ? <div><a href={c.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>LinkedIn</a></div> : <span style={{ color: 'var(--color-text-muted)' }}>N/A</span>}
                                                                            </td>
                                                                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                                <RowMenu 
                                                                                    onEdit={() => handleEditContact(c)} 
                                                                                    onDelete={() => handleDeleteContact(c)} 
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No se encontraron contactos para los filtros aplicados.</div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {modalConfig.data && (
                <div className="modal-backdrop" onClick={handleCloseModal}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {modalConfig.mode === 'create' ? 'Crear nueva empresa' : 'Editar empresa'}
                            </h2>
                            <button type="button" className="modal-close" onClick={handleCloseModal}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body" style={{ padding: '0 0 16px 0' }}>
                                {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}
                                
                                <div className="form-group">
                                    <label>Nombre *</label>
                                    <input required className="form-control" name="nombre" value={modalConfig.data.nombre} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>CIF</label>
                                    <input className="form-control" name="cif" value={modalConfig.data.cif} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Email General</label>
                                    <input type="email" className="form-control" name="email" value={modalConfig.data.email} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Web</label>
                                    <input className="form-control" name="web" value={modalConfig.data.web} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Sectores</label>
                                    {modalConfig.mode === 'create' ? (
                                        <MultiSelect
                                            options={sectors}
                                            selectedIds={modalConfig.data.sector_ids || []}
                                            onChange={(ids) => handleChange({ target: { name: 'sector_ids', value: ids } })}
                                            placeholder="Seleccionar sectores..."
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
                                <div className="form-group">
                                    <label>Verticales</label>
                                    {modalConfig.mode === 'create' ? (
                                        <MultiSelect
                                            options={verticals}
                                            selectedIds={modalConfig.data.vertical_ids || []}
                                            onChange={(ids) => handleChange({ target: { name: 'vertical_ids', value: ids } })}
                                            placeholder="Seleccionar verticales..."
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
                                <div className="form-group">
                                    <label>Productos</label>
                                    {modalConfig.mode === 'create' ? (
                                        <MultiSelect
                                            options={products}
                                            selectedIds={modalConfig.data.product_ids || []}
                                            onChange={(ids) => handleChange({ target: { name: 'product_ids', value: ids } })}
                                            placeholder="Seleccionar productos..."
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
                                <div className="form-group">
                                    <label>Número de empleados</label>
                                    <input type="number" className="form-control" name="numero_empleados" value={modalConfig.data.numero_empleados} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>Facturación</label>
                                    <input type="number" step="0.01" className="form-control" name="facturacion" value={modalConfig.data.facturacion} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label>CNAE</label>
                                    <input className="form-control" name="cnae" value={modalConfig.data.cnae} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={saving}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Guardando...' : (modalConfig.mode === 'create' ? 'Crear empresa' : 'Guardar cambios')}
                                </button>
                            </div>
                        </form>
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
