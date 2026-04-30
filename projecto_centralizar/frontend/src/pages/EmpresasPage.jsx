import React, { useState, useEffect, useRef, useMemo } from 'react'
import { api, buildScope } from '../api/client'
import RowMenu from '../components/RowMenu'
import { useLookups } from '../hooks/useContacts'
import { useDebounce } from '../hooks/useDebounce'
import { useQueryParams } from '../hooks/useQueryParams'
import { ActiveFilters } from '../components/ActiveFilters'
import MultiSelect from '../components/MultiSelect'
import ContactModal from '../components/ContactModal'
import Checkbox from '../components/Checkbox'
import { settingsService } from '../api/settingsService'
import { EmpresaCSVExport } from '../components/CSV'
import ImportEmpresasModal from '../components/ImportEmpresasModal'


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

function EmpresaBulkAssignmentModal({ type, targetCount, options = [], onClose, onSave }) {
    const [selected, setSelected] = useState('__placeholder__')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const config = {
        sector_ids: { title: 'Asignar Sector', label: 'Sector', icon: 'category' },
        vertical_ids: { title: 'Asignar Vertical', label: 'Vertical', icon: 'stacked_bar_chart' },
        product_ids: { title: 'Asignar Producto', label: 'Producto', icon: 'inventory_2' },
    }
    const { title, label, icon } = config[type] || { title: 'Asignar', label: 'Opción', icon: 'assignment' }

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        try {
            const ids = (selected === '' || selected === 'unassign') ? [] : [Number(selected)]
            const data = { merge_lists: ids.length > 0, [type]: ids }
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
                                {targetCount} {targetCount === 1 ? 'empresa seleccionada' : 'empresas seleccionadas'}
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
                                <option value="__placeholder__" disabled>Elige una opción</option>
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
    )
}

const EMPTY_FORM = { 
    nombre: '', cif: '', email: '', phone: '', web: '', 
    sector_ids: [], vertical_ids: [], product_ids: [], 
    numero_empleados: '', facturacion: '', cnae: '',
    facebook: '', web_competidor_1: '', web_competidor_2: '', web_competidor_3: ''
}
const BLANK_FILTERS = { q: '', sector_id: '', vertical_id: '', product_id: '', numero_empleados_min: '', numero_empleados_max: '', facturacion_min: '', facturacion_max: '', cnae: '', page: 1, page_size: 50 }

function EmpresaContactosRow({ empresaId, onEditContact, onDeleteContact }) {
    const [contactos, setContactos] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const pageSize = 10;
    const totalPages = Math.ceil(total / pageSize);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        api.getEmpresaContactos(empresaId, page, pageSize)
            .then(data => {
                if (isMounted) {
                    setContactos(data.items || []);
                    setTotal(data.total || 0);
                    setError(null);
                }
            })
            .catch(e => {
                if (isMounted) setError(e.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [empresaId, page]);

    if (loading) return <div className="p-8 text-center text-sm text-stone-500 flex justify-center items-center gap-2"><span className="material-symbols-outlined animate-spin text-lg">sync</span> Cargando contactos...</div>;
    if (error) return <div className="p-8 text-center text-sm text-error bg-error/10 m-4 rounded-xl font-medium border border-error/20">{error}</div>;

    return (
        <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm my-4 mx-4 md:mx-16">
            {contactos.length > 0 ? (
                <>
                    <table className="w-full text-left">
                        <thead className="bg-stone-50">
                            <tr>
                                <th className="py-3 px-5 text-[10px] font-bold text-stone-500 uppercase tracking-widest border-b border-stone-200">Contacto</th>
                                <th className="py-3 px-5 text-[10px] font-bold text-stone-500 uppercase tracking-widest border-b border-stone-200">Cargo</th>
                                <th className="py-3 px-5 text-[10px] font-bold text-stone-500 uppercase tracking-widest border-b border-stone-200">Email</th>
                                <th className="py-3 px-5 text-[10px] font-bold text-stone-500 uppercase tracking-widest border-b border-stone-200">LinkedIn</th>
                                <th className="py-3 px-5 w-10 border-b border-stone-200"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {contactos.map(c => (
                                <tr key={c.id} className="hover:bg-stone-50/50 transition-colors">
                                    <td className="py-3 px-5 text-sm font-bold text-stone-800">{c.first_name} {c.last_name}</td>
                                    <td className="py-3 px-5 text-sm font-medium text-stone-600">{c.cargo?.name || c.cargo?.nombre || '-'}</td>
                                    <td className="py-3 px-5 text-sm font-medium text-stone-600">{c.email || c.email_generic || '-'}</td>
                                    <td className="py-3 px-5 text-sm font-bold text-cyan-600">{c.linkedin ? <a href={c.linkedin} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">link</span> Perfil</a> : '-'}</td>
                                    <td className="py-3 px-5 text-right">
                                        <RowMenu onEdit={() => onEditContact(c)} onDelete={() => onDeleteContact(c)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 bg-stone-50">
                            <span className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Mostrando página {page} de {totalPages} ({total} total)</span>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-600 disabled:opacity-50 hover:bg-stone-100 hover:text-stone-900 transition-colors">Anterior</button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-600 disabled:opacity-50 hover:bg-stone-100 hover:text-stone-900 transition-colors">Siguiente</button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="p-8 text-center text-sm font-medium text-stone-500">No hay contactos vinculados a esta empresa.</div>
            )}
        </div>
    );
}

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
        <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-4">
                {items.length === 0 && <span className="text-stone-400 text-sm">Ninguno asignado.</span>}
                {items.map(itemId => {
                    const opt = availableOptions.find(o => o.id === itemId);
                    return (
                        <span key={itemId} className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-lowest text-stone-700 text-xs font-bold rounded-lg uppercase tracking-wide border border-stone-200">
                            {opt ? (opt.name || opt.nombre) : itemId}
                            <button type="button" onClick={() => handleUnassign(itemId)} disabled={loading} className="text-stone-400 hover:text-error transition-colors material-symbols-outlined text-[14px] leading-none" title="Desasignar">close</button>
                        </span>
                    );
                })}
            </div>
            <div className="flex gap-2">
                <select className="flex-1 bg-surface-container-lowest border border-stone-200 text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-colors hover:border-stone-300" value={selectedToAssign} onChange={e => setSelectedToAssign(e.target.value)} disabled={loading || unassignedOptions.length === 0}>
                    <option value="">{unassignedOptions.length === 0 ? "Todos los elementos ya están asignados" : "-- Seleccionar para asignar --"}</option>
                    {unassignedOptions.map(o => (
                        <option key={o.id} value={o.id}>{o.name || o.nombre}</option>
                    ))}
                </select>
                <button type="button" className="px-5 py-2.5 font-bold text-white bg-stone-800 hover:bg-primary transition-colors rounded-lg text-sm shadow-sm disabled:opacity-50 active:scale-95 flex items-center justify-center whitespace-nowrap" onClick={handleAssign} disabled={!selectedToAssign || loading}>
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

    const [showImportModal, setShowImportModal] = useState(false)

    // Enrichment state
    const [enriching, setEnriching] = useState(null)
    const [enrichError, setEnrichError] = useState(null)
    const [enrichMessage, setEnrichMessage] = useState(null)
    const [invalidCompanies, setInvalidCompanies] = useState([])

    // ===============================
    // BULK SCOPE CENTRALIZADO
    // ===============================
    const getScope = () => {
        if (selectedIds.length > 0) {
            return { ids: selectedIds }
        }

        // Limpieza de filtros vacíos para evitar scopes rotos
        const cleanFilters = Object.fromEntries(
            Object.entries(debouncedFilters).filter(([_, v]) => v !== '' && v != null)
        )

        return buildScope([], cleanFilters)
    }

    const handleEnrich = async (tool) => {
        setEnrichError(null)
        setEnrichMessage(null)
        setInvalidCompanies([])
        setEnriching(tool)

        try {
            const scope = buildScope(selectedIds, debouncedFilters)
            const data = await api.enrichEmpresas({
                tool_key: tool,
                ...scope
            })

            setEnrichMessage(`Enriquecimiento iniciado correctamente (Run ID: ${data.enrichment_run_id.split('-')[0]}...)`);
        } catch (err) {
            console.error('Enrichment failed:', err);

            // Handle Structured Validation Errors (MISSING_WEB or ADSCORE_VALIDATION_FAILED)
            if (err.data && (err.data.error_code === 'MISSING_WEB' || err.data.error_code === 'ADSCORE_VALIDATION_FAILED')) {
                setEnrichError(err.data.message);
                setInvalidCompanies(err.data.invalid_companies || []);
            } else {
                setEnrichError(err.message || 'Error desconocido al iniciar enriquecimiento');
            }
        } finally {
            setEnriching(null)
        }
    }

    // Option maps for chips formatting
    const lookupMaps = useMemo(() => {
        const createMap = (arr) => arr.reduce((acc, curr) => { acc[curr.id] = (curr.name || curr.nombre); return acc; }, {});
        return {
            sector_id: createMap(sectors),
            vertical_id: createMap(verticals),
            product_id: createMap(products),
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
                phone: formData.phone || null,
                web: formData.web || null,
                sector_ids: formData.sector_ids || [],
                vertical_ids: formData.vertical_ids || [],
                product_ids: formData.product_ids || [],
                numero_empleados: formData.numero_empleados ? parseInt(formData.numero_empleados, 10) : null,
                facturacion: formData.facturacion ? parseFloat(formData.facturacion) : null,
                cnae: formData.cnae || null,
                facebook: formData.facebook || null,
                web_competidor_1: formData.web_competidor_1 || null,
                web_competidor_2: formData.web_competidor_2 || null,
                web_competidor_3: formData.web_competidor_3 || null,
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
                phone: empresa.phone || '',
                web: empresa.web || '',
                numero_empleados: empresa.numero_empleados || '',
                facturacion: empresa.facturacion || '',
                cnae: empresa.cnae || '',
                sector_ids: empresa.sectors?.map(s => s.id) || [],
                vertical_ids: empresa.verticals?.map(v => v.id) || [],
                product_ids: empresa.products_rel?.map(p => p.id) || [],
                facebook: empresa.facebook || '',
                web_competidor_1: empresa.web_competidor_1 || '',
                web_competidor_2: empresa.web_competidor_2 || '',
                web_competidor_3: empresa.web_competidor_3 || '',
            }
        })
    }

    const handleDelete = async (empresa) => {
        setConfirmDelete({ ids: [empresa.id], single: true, label: empresa.nombre })
    }



    const filteredCount = totalEmpresas

    const selectionCount = selectedIds.length

    const actionCount = selectionCount > 0 ? selectionCount : filteredCount

    const handleSelect = (id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedIds(empresas.map(c => c.id))
        } else {
            setSelectedIds([])
        }
    }

    const handleDeleteBulk = () => {
        const scope = getScope()

        const count =
            selectedIds.length > 0
                ? selectedIds.length
                : totalEmpresas

        setConfirmDelete({
            scope,
            count,
            single: false
        })
    }

    const handleConfirmDelete = async () => {
        if (!confirmDelete) return
        setBulkDeleting(true)
        setDeleteError(null)
        try {
            if (confirmDelete.single) {
                await api.deleteEmpresa(confirmDelete.scope.ids[0])
            } else {
                await api.deleteBulkEmpresas(confirmDelete.scope)
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
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Empresas</h2>
                    <p className="text-on-surface-variant font-medium">Gestionando {totalEmpresas.toLocaleString()} entidades corporativas en Prisma CRM.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => {
                        const link = document.createElement("a");
                        link.href = "/templates/empresas_import_template.xlsx";
                        link.download = "empresas_import_template.xlsx";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                        className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Plantilla
                    </button>
                    <EmpresaCSVExport filters={filters} icon="ios_share" className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95 cursor-pointer" label="Exportar empresas" />
                    <button onClick={() => setShowImportModal(true)} className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95 cursor-pointer">
                        <span className="material-symbols-outlined text-lg">input</span>
                        Importar empresas
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="btn-primary-gradient text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        <span className="material-symbols-outlined text-lg">domain_add</span>
                        Nueva Empresa
                    </button>
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
                    <button
                        onClick={resetFilters}
                        className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95 flex items-center gap-1.5 border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/40 whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                        Limpiar filtros
                    </button>
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
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">CNAE</label>
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
                            onChange={e =>
                                handleFilterChange(
                                    'sector_id',
                                    e.target.value ? Number(e.target.value) : ''
                                )
                            }
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
                            onChange={e =>
                                handleFilterChange(
                                    'vertical_id',
                                    e.target.value ? Number(e.target.value) : ''
                                )
                            }
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
                            onChange={e =>
                                handleFilterChange(
                                    'product_id',
                                    e.target.value ? Number(e.target.value) : ''
                                )
                            }
                        >
                            <option value="">Todos</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name || p.nombre}</option>)}
                        </select>
                    </div>

                    {/* New Range Filters */}
                    <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Número de empleados</label>
                        <div className="flex gap-2">
                            <input
                                className="w-1/2 bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none placeholder:text-stone-400"
                                placeholder="Min"
                                type="number"
                                value={filters.numero_empleados_min}
                                onChange={e => handleFilterChange('numero_empleados_min', e.target.value === '' ? '' : Number(e.target.value))}
                            />
                            <input
                                className="w-1/2 bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none placeholder:text-stone-400"
                                placeholder="Max"
                                type="number"
                                value={filters.numero_empleados_max}
                                onChange={e => handleFilterChange('numero_empleados_max', e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase">Facturación (€)</label>
                        <div className="flex gap-2">
                            <input
                                className="w-1/2 bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none placeholder:text-stone-400"
                                placeholder="Min"
                                type="number"
                                value={filters.facturacion_min}
                                onChange={e => handleFilterChange('facturacion_min', e.target.value === '' ? '' : Number(e.target.value))}
                            />
                            <input
                                className="w-1/2 bg-surface-container-lowest border-none text-sm px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-cyan-600/20 outline-none placeholder:text-stone-400"
                                placeholder="Max"
                                type="number"
                                value={filters.facturacion_max}
                                onChange={e => handleFilterChange('facturacion_max', e.target.value === '' ? '' : Number(e.target.value))}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Batch Actions Area */}
            <div className="space-y-3">
                {/* Fila 1: Asignar + Eliminar */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setAssignmentModal({ type: 'sector_ids', mode: 'assign' })}
                        className="btn-primary-gradient text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        <span className="material-symbols-outlined text-lg">assignment_ind</span>
                        Asignar Sector
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                    <button
                        onClick={() => setAssignmentModal({ type: 'vertical_ids', mode: 'assign' })}
                        className="btn-primary-gradient text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        <span className="material-symbols-outlined text-lg">category</span>
                        Asignar Vertical
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                    <button
                        onClick={() => setAssignmentModal({ type: 'product_ids', mode: 'assign' })}
                        className="btn-primary-gradient text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        <span className="material-symbols-outlined text-lg">inventory_2</span>
                        Asignar Producto
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                    <div className="flex-1"></div>
                    <button
                        onClick={handleDeleteBulk}
                        className="bg-error/10 text-error px-4 py-2 rounded-lg text-sm font-bold hover:bg-error/20 transition-colors flex items-center gap-2 border border-error/20 shadow-sm active:scale-95"
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                        Eliminar
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                </div>

                {/* Fila 2: Enriquecimiento + Envío */}
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => handleEnrich('Apollo')} className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95">
                        <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                        Enriquecer con Apollo {enriching === 'Apollo' && '...'}
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                    <button onClick={() => handleEnrich('Clay')} className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95">
                        <span className="material-symbols-outlined text-lg">search_insights</span>
                        Enriquecer con Clay {enriching === 'Clay' && '...'}
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                    <button onClick={() => handleEnrich('Adscore')} className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95">
                        <span className="material-symbols-outlined text-lg">contact_page</span>
                        Enriquecer con Adscore {enriching === 'Adscore' && '...'}
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>

                    <div className="flex-1" />

                    <button onClick={() => handleEnrich('Affino')} className="bg-transparent border border-primary px-4 py-2 rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2 active:scale-95">
                        <span className="material-symbols-outlined text-lg">send</span>
                        Enviar a Affino {enriching === 'Affino' && '...'}
                        <span className="bg-transparent px-1">{actionCount}</span>
                    </button>
                </div>
            </div>

            {deleteError && <div className="p-3 bg-error-container text-on-error-container rounded text-sm mt-2">{deleteError}</div>}
            {enrichError && (
                <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm mt-2 border border-error/20 space-y-3">
                    <div className="flex items-center gap-2 font-bold">
                        <span className="material-symbols-outlined text-lg">warning</span>
                        {enrichError}
                    </div>
                    {invalidCompanies.length > 0 && (
                        <div className="bg-surface-container-lowest/50 rounded-lg p-3 space-y-1 mt-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-error-container/70 mb-2">Empresas con datos incompletos:</p>
                            <ul className="list-disc list-inside space-y-1">
                                {invalidCompanies.map(emp => {
                                    const reasons = {
                                        missing_web: "Falta Web principal",
                                        missing_facebook: "Falta Facebook",
                                        missing_competitors: "Falta Web Competidor",
                                        missing_fb_and_competitors: "Falta Facebook y Competidores"
                                    }
                                    return (
                                        <li key={emp.id} className="font-medium text-xs">
                                            {emp.nombre} 
                                            <span className="ml-2 px-1.5 py-0.5 bg-error/10 text-error text-[10px] rounded font-bold uppercase">
                                                {reasons[emp.reason] || emp.reason}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            )}
            {enrichMessage && <div className="p-4 bg-teal-100 text-teal-800 rounded-xl text-sm mt-2 border border-teal-200 font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">check_circle</span>
                {enrichMessage}
            </div>}

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
                                                                Ver contactos
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
                                                        <span key={x.id} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold rounded uppercase tracking-wide">
                                                            {x.name || x.nombre}
                                                        </span>
                                                    )) : <span className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">-</span>}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.isArray(emp.verticals) && emp.verticals.length > 0 ? emp.verticals.map(x => (
                                                        <span key={x.id} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold rounded uppercase tracking-wide">
                                                            {x.name || x.nombre}
                                                        </span>
                                                    )) : <span className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">-</span>}
                                                </div>
                                            </td>
                                            <td className="py-5 px-6">
                                                <div className="flex flex-wrap gap-1">
                                                    {Array.isArray(emp.products_rel) && emp.products_rel.length > 0 ? emp.products_rel.map(x => (
                                                        <span key={x.id} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold rounded uppercase tracking-wide">
                                                            {x.name || x.nombre}
                                                        </span>
                                                    )) : <span className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">-</span>}
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
                                                    <EmpresaContactosRow
                                                        empresaId={emp.id}
                                                        onEditContact={handleEditContact}
                                                        onDeleteContact={handleDeleteContact}
                                                    />
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
                            <button onClick={() => setPage(1)} disabled={currentPage <= 1} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">first_page</span>
                            </button>
                            <button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <button onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                            <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="w-8 h-8 rounded-lg border border-stone-200 flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-50 transition-colors">
                                <span className="material-symbols-outlined text-sm">last_page</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>



            {modalConfig.data && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={handleCloseModal}></div>

                    <div className="relative w-full max-w-4xl bg-surface-container-lowest rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low/50">
                            <div>
                                <h2 className="font-headline text-2xl font-bold text-on-surface">
                                    {modalConfig.mode === 'create' ? 'Registrar Nueva Empresa' : 'Editar Perfil de Empresa'}
                                </h2>
                                <p className="text-xs text-on-surface-variant font-medium mt-1 uppercase tracking-widest">Architectural Ledger • Perfil de Empresa</p>
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
                                    <h3 className="font-headline font-bold text-lg">Información Básica</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Nombre de Empresa *</label>
                                        <input required name="nombre" value={modalConfig.data.nombre} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="ej. Acme Corp" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CIF</label>
                                        <input name="cif" value={modalConfig.data.cif} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="B12345678" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Correo Electrónico</label>
                                        <input type="email" name="email" value={modalConfig.data.email} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="oficina@empresa.com" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Teléfono</label>
                                        <input type="tel" name="phone" value={modalConfig.data.phone || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="+34 900 000 000" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Web</label>
                                        <input name="web" value={modalConfig.data.web} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://..." />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Número de Empleados</label>
                                        <input type="number" name="numero_empleados" value={modalConfig.data.numero_empleados} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Facturación Anual (€)</label>
                                        <input type="number" step="0.01" name="facturacion" value={modalConfig.data.facturacion} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CNAE</label>
                                        <input name="cnae" value={modalConfig.data.cnae} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="ej. 6201" />
                                    </div>
                                </div>
                            </section>
 
                            <hr className="border-outline-variant/30" />
 
                            {/* Section: Social & Competitors */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-primary">hub</span>
                                    <h3 className="font-headline font-bold text-lg">Social y Competencia</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Facebook URL</label>
                                        <input name="facebook" value={modalConfig.data.facebook || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://facebook.com/..." />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Web Competidor 1</label>
                                        <input name="web_competidor_1" value={modalConfig.data.web_competidor_1 || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://competidor1.com" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Web Competidor 2</label>
                                        <input name="web_competidor_2" value={modalConfig.data.web_competidor_2 || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://competidor2.com" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Web Competidor 3</label>
                                        <input name="web_competidor_3" value={modalConfig.data.web_competidor_3 || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://competidor3.com" />
                                    </div>
                                </div>
                            </section>
 
                            <hr className="border-outline-variant/30" />

                            {/* Section: Industry Taxonomy */}
                            <div className="space-y-12">
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-stone-500">category</span>
                                        <h3 className="font-headline font-bold text-lg text-on-surface">Sectores</h3>
                                    </div>
                                    <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                        {modalConfig.mode === 'create' ? (
                                            <MultiSelect
                                                options={sectors}
                                                selectedIds={modalConfig.data.sector_ids || []}
                                                onChange={(ids) => handleChange({ target: { name: 'sector_ids', value: ids } })}
                                                placeholder="Asignar sectores..."
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
                                        <span className="material-symbols-outlined text-stone-500">account_tree</span>
                                        <h3 className="font-headline font-bold text-lg text-on-surface">Verticales de Negocio</h3>
                                    </div>
                                    <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                        {modalConfig.mode === 'create' ? (
                                            <MultiSelect
                                                options={verticals}
                                                selectedIds={modalConfig.data.vertical_ids || []}
                                                onChange={(ids) => handleChange({ target: { name: 'vertical_ids', value: ids } })}
                                                placeholder="Asignar verticales..."
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
                                {/* Section: Product Ecosystem */}
                                <section className="space-y-4 pb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-stone-500">inventory_2</span>
                                        <h3 className="font-headline font-bold text-lg text-on-surface">Productos</h3>
                                    </div>
                                    <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                        {modalConfig.mode === 'create' ? (
                                            <MultiSelect
                                                options={products}
                                                selectedIds={modalConfig.data.product_ids || []}
                                                onChange={(ids) => handleChange({ target: { name: 'product_ids', value: ids } })}
                                                placeholder="Asignar productos..."
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
                            </div>
                        </form>

                        {/* Modal Footer */}
                        <div className="p-8 bg-surface-container-low border-t border-outline-variant/30 flex justify-end gap-3">
                            <button type="button" onClick={handleCloseModal} disabled={saving} className="px-6 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                disabled={saving}
                                className="px-8 py-3 btn-primary-gradient text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                            >
                                {saving ? 'Guardando...' : (modalConfig.mode === 'create' ? 'Crear Empresa' : 'Guardar Cambios')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {assignmentModal && (
                <EmpresaBulkAssignmentModal
                    type={assignmentModal.type}
                    targetCount={actionCount}
                    options={
                        assignmentModal.type === 'sector_ids' ? sectors :
                            assignmentModal.type === 'vertical_ids' ? verticals : products
                    }
                    onClose={() => setAssignmentModal(null)}
                    onSave={async (updateData) => {
                        try {
                            const scope = buildScope(selectedIds, debouncedFilters)
                            await api.updateBulkEmpresas(scope, updateData)
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
                    count={confirmDelete.single ? 1 : confirmDelete.count}
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

            {/* CSV Import Modal */}
            {showImportModal && (
                <ImportEmpresasModal 
                    onClose={() => setShowImportModal(false)}
                    onImported={() => {
                        setShowImportModal(false);
                        loadEmpresas(debouncedFilters);
                    }}
                />
            )}
        </div>
    )
}
