import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { useContacts, useLookups } from './hooks/useContacts'
import FilterPanel from './components/FilterPanel'
import ContactsTable from './components/ContactsTable'
import ContactModal from './components/ContactModal'
import { CSVImport, CSVExport } from './components/CSV'
// SettingsPage de admin (APIs y Webhooks) — solo accesible para admins
import AdminSettingsPage from './components/SettingsPage'
// SettingsPage de usuario (cambio de contraseña, etc.) — accesible para todos
import UserSettingsPage from './pages/SettingsPage'
import MasterDataPage from './pages/MasterDataPage'
import RequestAccessPage from './pages/RequestAccessPage'
import RequestsPage from './pages/RequestsPage'
import UsersPage from './pages/UsersPage'
import Login from './components/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { api } from './api/client'
import { getUserFromToken } from './auth/token'

// ---- Sidebar ----
// Recibe userRole para mostrar/ocultar opciones según el rol del usuario.
// IMPORTANTE: Esto es solo UX — el backend SIEMPRE verifica permisos.
// Si un gestor intenta acceder a /api/users directamente, el backend
// responde con 403 Forbidden gracias a la dependencia AdminUser.
function Sidebar({ page, setPage, userRole }) {
    // Definición de items del menú
    // El campo 'adminOnly' indica qué opciones son exclusivas para admins
    const allItems = [
        { id: 'contacts', label: 'Contactos', icon: '👥' },
        { id: 'master-data', label: 'Datos maestros', icon: '📚' },
        // Solo admins pueden gestionar solicitudes de acceso.
        // La visibilidad depende de userRole (filtrado abajo).
        // TODO: siempre validar también en backend — la seguridad real
        // no está solo en la UI. El backend ya lo hace via AdminUser
        // en el router /api/requests (access_requests.py).
        { id: 'requests', label: 'Solicitudes', icon: '📝', adminOnly: true },
        { id: 'users', label: 'Usuarios', icon: '👤', adminOnly: true },
        // Solo admins pueden gestionar APIs y Webhooks.
        // La visibilidad depende de userRole (filtrado en línea 37).
        // TODO: siempre validar también en backend — la seguridad real
        // no está solo en la UI. El backend ya lo hace via require_admin
        // en el router /api/system (system.py).
        // Solo admins pueden gestionar APIs y Webhooks.
        // La visibilidad depende de userRole (filtrado abajo).
        { id: 'api-settings', label: 'APIs y Webhooks', icon: '⚙️', adminOnly: true },
        // "Settings" es accesible para TODOS los usuarios (admin y gestor).
        // Permite configuraciones personales como cambio de contraseña.
        // No tiene adminOnly, por lo que no se filtra.
        // TODO futuro: añadir más opciones (email, preferencias, tema, etc.)
        { id: 'user-settings', label: 'Settings', icon: '🔧' },
    ]

    // Filtrar items según el rol del usuario
    // Los items con adminOnly: true solo se muestran si userRole === 'admin'
    // TODO futuro: Añadir más roles ("supervisor", "viewer") con lógica similar
    const items = allItems.filter(item => !item.adminOnly || userRole === 'admin')

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">CRM<span>.</span></div>
            <div style={{ padding: '4px 0 0', flex: 1 }}>
                <p className="sidebar-section-label">Menú</p>
                {items.map((item) => (
                    <button
                        id={`nav-${item.id}`}
                        key={item.id}
                        className={`nav-item${page === item.id ? ' active' : ''}`}
                        onClick={() => setPage(item.id)}
                    >
                        <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </div>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '4px' }}>
                <p className="sidebar-section-label">Cuenta</p>
                <button
                    className="nav-item"
                    onClick={async () => {
                        await api.logout()
                        window.location.reload()
                    }}
                >
                    <span style={{ fontSize: '1rem' }}>🚪</span>
                    Cerrar sesión
                </button>
            </div>
        </aside>
    )
}

// ---- Confirm Delete Modal ----
function ConfirmDeleteModal({ count, onConfirm, onCancel, loading }) {
    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, gap: 0 }}>
                <div className="modal-header">
                    <h2 className="modal-title">Confirmar eliminación</h2>
                    <button className="modal-close" onClick={onCancel}>✕</button>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem', lineHeight: 1.6, padding: '16px 0' }}>
                    Vas a eliminar <strong style={{ color: 'var(--color-text)' }}>{count} {count === 1 ? 'contacto' : 'contactos'}</strong>. Esta acción no se puede deshacer.
                </p>
                <div className="modal-footer" style={{ marginTop: 0 }}>
                    <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancelar</button>
                    <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Eliminando…' : 'Eliminar contactos'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ---- Bulk Assignment Modal ----
function BulkAssignmentModal({ type, mode = 'assign', targetCount, options = [], onClose, onSave }) {
    const [selected, setSelected] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    const titles = {
        campaña: mode === 'assign' ? 'Asignar a campaña' : 'Desasignar de campaña',
        sector: mode === 'assign' ? 'Asignar a sector' : 'Desasignar de sector',
        vertical: mode === 'assign' ? 'Asignar a vertical' : 'Desasignar de vertical',
        productos: mode === 'assign' ? 'Asignar a productos' : 'Desasignar de productos',
        cargo: mode === 'assign' ? 'Asignar a cargo' : 'Desasignar de cargo'
    }

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

            if (type === 'campaña') {
                data.campaign_ids = selected
            } else if (type === 'productos') {
                data.product_ids = selected
            } else if (type === 'sector') {
                data.sector_ids = selected
            } else if (type === 'vertical') {
                data.vertical_ids = selected
            } else if (type === 'cargo') {
                data.cargo_ids = selected
            }

            await onSave(data)
            // Note: success state closed by parent
        } catch (e) {
            setError(e.message)
            setSaving(false)
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <h2 className="modal-title">{titles[type] || (mode === 'assign' ? 'Asignar' : 'Desasignar')}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div style={{ padding: '16px 0' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
                        Vas a {mode === 'assign' ? 'asignar' : 'desasignar'} <strong style={{ color: 'var(--color-text)' }}>{targetCount} {targetCount === 1 ? 'contacto' : 'contactos'}</strong> a:
                    </p>

                    {error && (
                        <div className="alert alert-error" style={{ marginBottom: 16, fontSize: '0.85rem' }}>
                            {error}
                        </div>
                    )}

                    <div className="selection-list" style={{
                        maxHeight: '320px',
                        overflowY: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {options.map(opt => {
                            const isSelected = selected.includes(opt.id)
                            const label = opt.nombre || opt.name
                            return (
                                <div
                                    key={opt.id}
                                    onClick={() => handleToggle(opt.id)}
                                    style={{
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderBottom: '1px solid var(--color-border)',
                                        backgroundColor: isSelected ? 'rgba(79, 114, 239, 0.1)' : 'transparent',
                                        transition: 'all 0.15s ease'
                                    }}
                                    className="selection-item"
                                >
                                    <span style={{
                                        color: isSelected ? 'var(--color-accent)' : 'inherit',
                                        fontWeight: isSelected ? 600 : 400,
                                        fontSize: '0.9375rem'
                                    }}>
                                        {label}
                                    </span>
                                    <div style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 4,
                                        border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isSelected ? 'var(--color-accent)' : 'transparent',
                                        transition: 'all 0.15s ease'
                                    }}>
                                        {isSelected && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>✓</span>}
                                    </div>
                                </div>
                            )
                        })}
                        {options.length === 0 && (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                No hay opciones disponibles.
                            </div>
                        )}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button
                        className="btn btn-primary"
                        disabled={saving || selected.length === 0}
                        onClick={handleSave}
                    >
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>
    )
}


function ContactsPage() {
    const { contacts, total, loading, error, filters, updateFilter, setPage, setPageSize, refresh } = useContacts()
    const { sectors, verticals, campaigns, products, cargos } = useLookups()
    const [modal, setModal] = useState(null)   // null | 'create' | contact object
    const [showImportModal, setShowImportModal] = useState(false)
    const [deleting, setDeleting] = useState(null)
    const [deleteError, setDeleteError] = useState(null)
    const [selectedIds, setSelectedIds] = useState([])
    const [confirmDelete, setConfirmDelete] = useState(null)  // null | { ids: [], single: bool }
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [assignmentModal, setAssignmentModal] = useState(null) // null | { type: 'campaña'|'sector'|..., mode: 'assign'|'unassign' }

    const [enrichError, setEnrichError] = useState(null)
    const [enrichMessage, setEnrichMessage] = useState(null)
    const [enriching, setEnriching] = useState(null)

    // Helper: get the full array of selected or filtered contacts
    const resolveTargetData = async () => {
        if (selectedIds.length > 0) {
            // Selected rows span across potentially multiple pages. 
            // We'll just fetch all filtered and intersection.
            // (In a true prod app you might fetch by IDs specifically, 
            // but fetching all filtered is fast enough with page_size=100000 here).
            const data = await api.listContacts({ ...filters, page: 1, page_size: 100000 })
            return data.items.filter(c => selectedIds.includes(c.id))
        } else {
            // No selection -> all filtered
            const data = await api.listContacts({ ...filters, page: 1, page_size: 100000 })
            return data.items
        }
    }

    // Label shows total filtered count when nothing is selected, otherwise the selection size
    const actionCount = selectedIds.length > 0 ? selectedIds.length : total

    const totalPages = Math.ceil(total / filters.page_size)

    async function handleDelete(contact) {
        setConfirmDelete({ ids: [contact.id], single: true, label: contact.company })
    }

    const handleSelect = (id, checked) => {
        setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
    }

    const handleSelectAll = (checked) => {
        setSelectedIds(checked ? contacts.map(c => c.id) : [])
    }

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

    const handleCancelDelete = () => setConfirmDelete(null)

    const buildAdscorePayload = (contact) => ({
        id_contacto: contact.id,
        nombre_empresa: contact.company,
        dominio: contact.dominio,
        vertical: contact.verticals && contact.verticals.length > 0 ? contact.verticals[0].name : null
    })

    const handleEnrich = async (service) => {
        setEnrichError(null)
        setEnrichMessage(null)

        const stored = localStorage.getItem('webhooks_integrations')
        let integrations = []
        try {
            if (stored) integrations = JSON.parse(stored)
        } catch (e) { }

        const integration = integrations.find(i => i.nombre_aplicacion === service)

        let missingWebhook = false

        if (!integration || !integration.webhook || !integration.webhook.trim()) {
            missingWebhook = true
        }

        if (missingWebhook) {
            setEnrichError('Falta la URL del webhook')
            return
        }

        setEnriching(service)
        try {
            const resolvedContacts = await resolveTargetData()

            // Validar que todos los contactos tengan dominio antes de enviar
            const sinDominio = resolvedContacts.some(c => !c.dominio || !c.dominio.trim())
            if (sinDominio) {
                setEnrichError('El dominio es obligatorio para enriquecer contactos')
                setEnriching(null)
                return
            }

            // Payload unificado para todos los servicios
            const payload = {
                contacts: resolvedContacts.map(buildAdscorePayload)
            }

            const headers = {
                'Content-Type': 'application/json'
            }
            if (integration) {
                const type = integration.auth_type || 'Ninguno';
                const key = integration.api_key ? integration.api_key.trim() : '';

                if (type === 'HeaderAuth' && key) {
                    headers['Authentication'] = key;
                } else if (type === 'BasicAuth' && key) {
                    headers['Authorization'] = `Basic ${btoa(key)}`;
                } else if (!integration.auth_type && key) {
                    // Backward compatibility if auth_type doesn't exist yet
                    headers['Authorization'] = `Bearer ${key}`;
                }
            }

            const res = await fetch(integration.webhook, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            })

            if (res.status === 401 || res.status === 403) {
                setEnrichError('API key inválida')
                return
            }

            if (!res.ok) throw new Error('Request failed')
            setEnrichMessage(`Enriquecimiento enviado correctamente a ${service}`)
        } catch (err) {
            setEnrichError(`Error al enviar datos a ${service}`)
        } finally {
            setEnriching(null)
        }
    }

    return (
        <>
            {/* 1. Top Action Bar */}
            <div className="top-action-bar">
                <div className="top-search-wrap">
                    <input
                        className="form-control"
                        placeholder="Buscar contactos..."
                        value={filters.search}
                        onChange={(e) => updateFilter('search', e.target.value)}
                    />
                </div>
                <div className="top-actions">
                    <div className="btn-group">
                        <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
                            Importar
                        </button>
                        <CSVExport filters={filters} label="Exportar" />
                        <button id="add-contact-btn" className="btn btn-primary" onClick={() => setModal('create')}>
                            Añadir contacto
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Page Title */}
            <div className="page-title-wrap">
                <h1 className="page-title">Contactos</h1>
            </div>

            {/* 3. Filters Bar */}
            <div className="filters-container">
                <FilterPanel
                    filters={filters}
                    onFilterChange={updateFilter}
                    sectors={sectors}
                    verticals={verticals}
                    campaigns={campaigns}
                    products={products}
                    cargos={cargos}
                />
            </div>

            {/* 4. Bulk Actions Bar */}
            <div className="bulk-actions-bar" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-bulk" onClick={() => setAssignmentModal({ type: 'campaña', mode: 'assign' })}>Asignar a campaña ({actionCount})</button>
                    <button className="btn-bulk" onClick={() => setAssignmentModal({ type: 'sector', mode: 'assign' })}>Asignar a sector ({actionCount})</button>
                    <button className="btn-bulk" onClick={() => setAssignmentModal({ type: 'vertical', mode: 'assign' })}>Asignar a vertical ({actionCount})</button>
                    <button className="btn-bulk" onClick={() => setAssignmentModal({ type: 'productos', mode: 'assign' })}>Asignar a productos ({actionCount})</button>
                    <button className="btn-bulk" onClick={() => setAssignmentModal({ type: 'cargo', mode: 'assign' })}>Asignar a cargo ({actionCount})</button>
                    <button className="btn-bulk btn-bulk-danger" style={{ marginLeft: 'auto' }} onClick={handleDeleteBulk}>Borrar ({actionCount}) contactos</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn-bulk btn-bulk-unassign" onClick={() => setAssignmentModal({ type: 'campaña', mode: 'unassign' })}>Desasignar campaña ({actionCount})</button>
                    <button className="btn-bulk btn-bulk-unassign" onClick={() => setAssignmentModal({ type: 'sector', mode: 'unassign' })}>Desasignar sector ({actionCount})</button>
                    <button className="btn-bulk btn-bulk-unassign" onClick={() => setAssignmentModal({ type: 'vertical', mode: 'unassign' })}>Desasignar vertical ({actionCount})</button>
                    <button className="btn-bulk btn-bulk-unassign" onClick={() => setAssignmentModal({ type: 'productos', mode: 'unassign' })}>Desasignar productos ({actionCount})</button>
                    <button className="btn-bulk btn-bulk-unassign" onClick={() => setAssignmentModal({ type: 'cargo', mode: 'unassign' })}>Desasignar cargo ({actionCount})</button>
                </div>
            </div>

            {/* Enrichment Actions */}
            <div className="bulk-actions-bar">
                <button className="btn-bulk btn-bulk-enrich" onClick={() => handleEnrich('Apollo')} disabled={enriching === 'Apollo'}>
                    {enriching === 'Apollo' ? 'Enviando...' : `Enriquecer con Apollo (${actionCount})`}
                </button>
                <button className="btn-bulk btn-bulk-enrich" onClick={() => handleEnrich('Adscore')} disabled={enriching === 'Adscore'}>
                    {enriching === 'Adscore' ? 'Enviando...' : `Enriquecer con Adscore (${actionCount})`}
                </button>
                <button className="btn-bulk btn-bulk-enrich" onClick={() => handleEnrich('Clay')} disabled={enriching === 'Clay'}>
                    {enriching === 'Clay' ? 'Enviando...' : `Enriquecer con Clay (${actionCount})`}
                </button>
                <button className="btn-bulk btn-bulk-enrich" onClick={() => handleEnrich('Black')} disabled={enriching === 'Black'}>
                    {enriching === 'Black' ? 'Enviando...' : `Enriquecer con Black (${actionCount})`}
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {error && <div className="alert alert-error">{error}</div>}
                {deleteError && <div className="alert alert-error">{deleteError}</div>}
                {enrichError && <div className="alert alert-error">{enrichError}</div>}
                {enrichMessage && <div className="alert alert-success">{enrichMessage}</div>}
            </div>

            {/* 5. Contacts Table */}
            <div className="card">
                <ContactsTable
                    contacts={contacts}
                    loading={loading}
                    onEdit={(c) => setModal(c)}
                    onDelete={handleDelete}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    onSelectAll={handleSelectAll}
                />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination" style={{ alignSelf: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" disabled={filters.page <= 1} onClick={() => setPage(filters.page - 1)}>Anterior</button>
                    <span>Página {filters.page} de {totalPages}</span>
                    <button className="btn btn-secondary btn-sm" disabled={filters.page >= totalPages} onClick={() => setPage(filters.page + 1)}>Siguiente</button>
                    <select
                        className="form-control"
                        style={{ width: 'auto', marginLeft: 12, padding: '4px 8px', fontSize: '0.85rem' }}
                        value={filters.page_size}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                        {[10, 25, 50, 100].map(n => (
                            <option key={n} value={n}>{n} / página</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Create / Edit Modal */}
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

            {/* Import CSV Modal */}
            {showImportModal && (
                <div className="modal-backdrop" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h2 className="modal-title">Importar CSV</h2>
                            <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
                        </div>
                        <div className="alert alert-info" style={{ marginBottom: 20 }}>
                            <strong>Cómo funciona:</strong> Cada fila crea o actualiza un contacto. Clave de upsert: CIF → Web → crear nuevo. La columna <code>company</code> es obligatoria. El resto de columnas son opcionales.
                        </div>
                        <CSVImport onImported={() => refresh()} />
                    </div>
                </div>
            )}
            {/* Confirm Delete Modal */}
            {confirmDelete && (
                <ConfirmDeleteModal
                    count={confirmDelete.ids.length}
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                    loading={bulkDeleting}
                />
            )}

            {/* 6. Assignment Modal */}
            {assignmentModal && (
                <BulkAssignmentModal
                    type={assignmentModal.type}
                    mode={assignmentModal.mode}
                    targetCount={actionCount}
                    options={
                        assignmentModal.type === 'campaña' ? campaigns :
                            assignmentModal.type === 'productos' ? products :
                                assignmentModal.type === 'sector' ? sectors :
                                    assignmentModal.type === 'vertical' ? verticals :
                                        assignmentModal.type === 'cargo' ? cargos : []
                    }
                    onClose={() => setAssignmentModal(null)}
                    onSave={async (updateData) => {
                        try {
                            const targets = await resolveTargetData()
                            await api.updateBulkContacts({
                                ids: targets.map(c => c.id),
                                data: updateData
                            })
                            setAssignmentModal(null)
                            setSelectedIds([])
                            refresh()
                        } catch (err) {
                            throw err
                        }
                    }}
                />
            )}
        </>
    )
}

// ---- Authenticated App Shell ----
// Recibe userRole y userEmail del JWT para controlar qué ve cada usuario.
// - userRole: controla visibilidad del menú y rutas protegidas
// - userEmail: se pasa a UsersPage para ocultar el botón "Eliminar"
//   en la fila del propio admin (no puede auto-eliminarse)
// La protección visual complementa la protección real del backend.
function AuthenticatedApp({ onLogout, userRole, userEmail }) {
    const [page, setPage] = useState('contacts')

    return (
        <div className="app-shell">
            <Sidebar page={page} setPage={setPage} userRole={userRole} />
            <main className="main-content">
                {page === 'contacts' && <ContactsPage />}
                {page === 'master-data' && <MasterDataPage />}
                {/* RequestsPage (Solicitudes) protegida con ProtectedRoute: requiere rol admin.
                    Si un gestor intenta acceder (ej: manipulando el state), ve "Acceso denegado".
                    Refuerzo de seguridad UI — el backend también verifica el rol con
                    AdminUser en el router /api/requests. Doble protección. */}
                {page === 'requests' && (
                    <ProtectedRoute requiredRole="admin" userRole={userRole}>
                        <RequestsPage />
                    </ProtectedRoute>
                )}
                {/* UsersPage protegida con ProtectedRoute: requiere rol admin.
                    Si un gestor llega aquí (ej: manipulando el state), ve "Acceso denegado".
                    Además, las llamadas API fallarían con 403 porque el backend
                    también verifica el rol con AdminUser. Doble protección. */}
                {page === 'users' && (
                    <ProtectedRoute requiredRole="admin" userRole={userRole}>
                        {/* currentUserEmail se usa para ocultar el botón "Eliminar"
                            en la fila del propio admin (no puede auto-eliminarse).
                            El backend también impide la auto-eliminación (400). */}
                        <UsersPage currentUserEmail={userEmail} />
                    </ProtectedRoute>
                )}
                {/* AdminSettingsPage (APIs y Webhooks) protegida con ProtectedRoute: requiere rol admin.
                    Si un gestor intenta acceder (ej: manipulando el state), ve "Acceso denegado".
                    Refuerzo de seguridad UI — el backend también verifica el rol con
                    require_admin en el router /api/system. Doble protección. */}
                {page === 'api-settings' && (
                    <ProtectedRoute requiredRole="admin" userRole={userRole}>
                        <AdminSettingsPage />
                    </ProtectedRoute>
                )}
                {/* UserSettingsPage (cambio de contraseña) — accesible para TODOS los usuarios.
                    No requiere ProtectedRoute porque cualquier usuario autenticado puede
                    cambiar su propia contraseña. El backend también lo permite para
                    cualquier usuario con token JWT válido (CurrentUser, no AdminUser). */}
                {page === 'user-settings' && <UserSettingsPage />}
            </main>
        </div>
    )
}

// ---- App Root with Routing ----
// Gestiona el estado de autenticación y el rol del usuario.
// Al arrancar, verifica si hay un token válido llamando GET /api/me.
// Si el token es válido, se extrae el rol del JWT para control de UI.
function AppRoutes() {
    const [isAuthenticated, setIsAuthenticated] = useState(null) // null = loading
    const [userRole, setUserRole] = useState(null) // 'admin' | 'gestor' | null
    // Email del usuario autenticado — se pasa a UsersPage para controlar
    // la visibilidad del botón "Eliminar" (no puede auto-eliminarse)
    const [userEmail, setUserEmail] = useState(null)
    const navigate = useNavigate()

    /**
     * Verifica la autenticación del usuario al cargar la app.
     *
     * Flujo:
     * 1. Llama GET /api/me (envía el JWT automáticamente via client.js)
     * 2. Si el backend responde OK → el token es válido
     * 3. Extrae el rol del JWT almacenado en localStorage
     * 4. Si falla (401) → no hay sesión válida
     */
    const checkAuth = async () => {
        try {
            await api.me()
            // Token válido → extraer info del usuario del JWT
            const userData = getUserFromToken()
            setUserRole(userData?.role ?? null)
            setUserEmail(userData?.email ?? null)
            setIsAuthenticated(true)
        } catch (e) {
            setIsAuthenticated(false)
            setUserRole(null)
            setUserEmail(null)
        }
    }

    useEffect(() => {
        checkAuth()
    }, [])

    if (isAuthenticated === null) {
        return (
            <div className="auth-page">
                <div className="spinner" style={{ width: 32, height: 32 }}></div>
            </div>
        )
    }

    return (
        <Routes>
            {/* Public routes — accesibles sin autenticación */}
            <Route
                path="/login"
                element={
                    isAuthenticated
                        ? <Navigate to="/" replace />
                        : <Login
                            onLoginComplete={() => {
                                // Después del login, el token ya está en localStorage
                                // (lo guardó api.login → setToken)
                                // Extraemos el rol del JWT para uso inmediato
                                const userData = getUserFromToken()
                                setUserRole(userData?.role ?? null)
                                setUserEmail(userData?.email ?? null)
                                setIsAuthenticated(true)
                                navigate('/')
                            }}
                            onNavigateRequestAccess={() => navigate('/request-access')}
                          />
                }
            />
            <Route
                path="/request-access"
                element={
                    isAuthenticated
                        ? <Navigate to="/" replace />
                        : <RequestAccessPage
                            onNavigateLogin={() => navigate('/login')}
                          />
                }
            />

            {/* Protected routes — requieren autenticación */}
            <Route
                path="/*"
                element={
                    isAuthenticated
                        ? <AuthenticatedApp
                            userRole={userRole}
                            userEmail={userEmail}
                            onLogout={() => {
                                setIsAuthenticated(false)
                                setUserRole(null)
                                setUserEmail(null)
                                navigate('/login')
                            }}
                          />
                        : <Navigate to="/login" replace />
                }
            />
        </Routes>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    )
}
