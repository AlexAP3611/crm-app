import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { settingsService } from '../api/settingsService'

const AUTH_TYPES = ['Ninguno', 'Bearer Token', 'Basic Auth', 'Header Auth', 'Affino']

export default function AffinoAccountsManager() {
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [modalState, setModalState] = useState(null) // null | { mode: 'create' | 'edit', account?: any }
    const [deleteConfirm, setDeleteConfirm] = useState(null) // null | account
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showXUserId, setShowXUserId] = useState(false)
    const [formValues, setFormValues] = useState({ nombre: '', x_user_id: '' })
    const [error, setError] = useState('')

    // ── Connection config state ──
    const [connConfig, setConnConfig] = useState({})
    const [connLoading, setConnLoading] = useState(true)
    const [connDirty, setConnDirty] = useState(false)
    const [connSaving, setConnSaving] = useState(false)
    const [connSaved, setConnSaved] = useState(false)
    const [connError, setConnError] = useState('')
    const [showConnToken, setShowConnToken] = useState(false)

    // Load accounts on mount
    const loadAccounts = async () => {
        setLoading(true)
        try {
            const data = await api.listAffinoAccounts()
            setAccounts(data || [])
        } catch (err) {
            console.error('Error al cargar cuentas de Affino:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadConnConfig = async () => {
        setConnLoading(true)
        try {
            const configs = await settingsService.getExternalConfigs()
            setConnConfig(configs['affino'] || {})
        } catch (err) {
            console.error('Error al cargar config de conexión Affino:', err)
        } finally {
            setConnLoading(false)
        }
    }

    useEffect(() => {
        loadAccounts()
        loadConnConfig()
    }, [])

    const handleOpenCreate = () => {
        setFormValues({ nombre: '', x_user_id: '' })
        setError('')
        setShowXUserId(false)
        setModalState({ mode: 'create' })
    }

    const handleOpenEdit = (account) => {
        setFormValues({ nombre: account.nombre, x_user_id: account.x_user_id })
        setError('')
        setShowXUserId(false)
        setModalState({ mode: 'edit', account })
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (!formValues.nombre.trim() || !formValues.x_user_id.trim()) {
            setError('Todos los campos son obligatorios')
            return
        }
        setSaving(true)
        setError('')
        try {
            if (modalState.mode === 'create') {
                await api.createAffinoAccount(formValues)
            } else {
                await api.updateAffinoAccount(modalState.account.id, formValues)
            }
            await loadAccounts()
            setModalState(null)
        } catch (err) {
            console.error('Error al guardar cuenta:', err)
            setError(err.message || 'Error al guardar la cuenta')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteConfirm) return
        setDeleting(true)
        try {
            await api.deleteAffinoAccount(deleteConfirm.id)
            await loadAccounts()
            setDeleteConfirm(null)
        } catch (err) {
            console.error('Error al eliminar cuenta:', err)
            alert(err.message || 'Error al eliminar la cuenta')
        } finally {
            setDeleting(false)
        }
    }

    const handleSaveConnConfig = async () => {
        setConnSaving(true)
        setConnError('')
        try {
            await api.updateSystemSetting('ext_config_affino', connConfig)
            await settingsService.refreshSettings()
            setConnDirty(false)
            setConnSaved(true)
            setTimeout(() => setConnSaved(false), 3000)
        } catch (err) {
            console.error('Error al guardar config Affino:', err)
            setConnError(err.message || 'Error al guardar la configuración')
        } finally {
            setConnSaving(false)
        }
    }

    const updateConn = (partial) => {
        setConnConfig((prev) => ({ ...prev, ...partial }))
        setConnDirty(true)
    }

    const handleConnAuthTypeChange = (newType) => {
        const { token, username, password, headerName, prefix, headerValue, ...rest } = connConfig
        setConnConfig({ ...rest, authType: newType })
        setConnDirty(true)
    }

    const obfuscate = (val) => {
        if (!val) return ''
        return val.length > 4 ? '••••••' + val.slice(-4) : '••••'
    }

    // Shared input class
    const inputCls =
        'w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm ' +
        'focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600/30 transition-all ' +
        'outline-none placeholder:text-stone-300'

    const labelCls =
        'block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2'

    const selectStyle = {
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7280' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: '36px',
    }

    const renderConnAuthFields = () => {
        const authType = connConfig.authType || 'Affino'
        const toggleBtn = (
            <button type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors border-0 bg-transparent outline-none cursor-pointer"
                onClick={() => setShowConnToken(v => !v)}
            >
                <span className="material-symbols-outlined text-lg">{showConnToken ? 'visibility_off' : 'visibility'}</span>
            </button>
        )

        if (authType === 'Ninguno') return null

        if (authType === 'Bearer Token') return (
            <div>
                <label className={labelCls}>Token de acceso</label>
                <div className="relative">
                    <input className={inputCls + ' pr-11'} type={showConnToken ? 'text' : 'password'}
                        placeholder="Pega aquí tu Bearer Token" value={connConfig.token || ''}
                        onChange={(e) => updateConn({ token: e.target.value })} />
                    {toggleBtn}
                </div>
                <p className="text-[10px] text-stone-400 mt-1">Se enviará como <code className="bg-stone-100 px-1 rounded text-stone-600">Authorization: Bearer &lt;token&gt;</code></p>
            </div>
        )

        if (authType === 'Basic Auth') return (
            <div className="space-y-4">
                <div>
                    <label className={labelCls}>Usuario</label>
                    <input className={inputCls} type="text" placeholder="Nombre de usuario"
                        value={connConfig.username || ''} onChange={(e) => updateConn({ username: e.target.value })} />
                </div>
                <div>
                    <label className={labelCls}>Contraseña</label>
                    <div className="relative">
                        <input className={inputCls + ' pr-11'} type={showConnToken ? 'text' : 'password'} placeholder="••••••••"
                            value={connConfig.password || ''} onChange={(e) => updateConn({ password: e.target.value })} />
                        {toggleBtn}
                    </div>
                </div>
            </div>
        )

        if (authType === 'Header Auth') {
            const pName = connConfig.headerName?.trim() || 'Header-Name'
            const pPfx  = connConfig.prefix?.trim() || ''
            const pVal  = connConfig.headerValue ? '••••••' : '<valor>'
            const preview = pPfx ? `${pName}: ${pPfx} ${pVal}` : `${pName}: ${pVal}`
            return (
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Nombre del Header</label>
                        <input className={inputCls} type="text" placeholder="ej: Authorization, X-API-Key"
                            value={connConfig.headerName || ''} onChange={(e) => updateConn({ headerName: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelCls}>Prefijo <span className="normal-case font-normal text-stone-400">(opcional)</span></label>
                        <input className={inputCls} type="text" placeholder="ej: Bearer, Token"
                            value={connConfig.prefix || ''} onChange={(e) => updateConn({ prefix: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelCls}>Valor (token / clave)</label>
                        <div className="relative">
                            <input className={inputCls + ' pr-11'} type={showConnToken ? 'text' : 'password'} placeholder="Pega aquí tu token"
                                value={connConfig.headerValue || ''} onChange={(e) => updateConn({ headerValue: e.target.value })} />
                            {toggleBtn}
                        </div>
                    </div>
                    <div className="rounded-lg bg-stone-50 border border-stone-200 px-4 py-3">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Preview del header</p>
                        <code className="text-xs text-cyan-700 font-mono break-all">{preview}</code>
                    </div>
                </div>
            )
        }

        // authType === 'Affino' (default)
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Nombre del Header (Auth)</label>
                        <input className={inputCls} type="text" placeholder="ej: Authorization"
                            value={connConfig.headerName || ''} onChange={(e) => updateConn({ headerName: e.target.value })} />
                    </div>
                    <div>
                        <label className={labelCls}>Prefijo <span className="normal-case font-normal text-stone-400">(opcional)</span></label>
                        <input className={inputCls} type="text" placeholder="ej: Bearer"
                            value={connConfig.prefix || ''} onChange={(e) => updateConn({ prefix: e.target.value })} />
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Valor del Token</label>
                    <div className="relative">
                        <input className={inputCls + ' pr-11'} type={showConnToken ? 'text' : 'password'} placeholder="Pega aquí tu token"
                            value={connConfig.headerValue || ''} onChange={(e) => updateConn({ headerValue: e.target.value })} />
                        {toggleBtn}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-surface-container-low rounded-xl p-8 relative overflow-hidden flex flex-col border border-outline-variant/30 col-span-1 lg:col-span-2 mt-8">
            {/* Watermark icon */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.04] pointer-events-none">
                <span className="material-symbols-outlined" style={{ fontSize: '5rem' }}>
                    hub
                </span>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border border-stone-100">
                        <span className="material-symbols-outlined text-2xl text-cyan-700">hub</span>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold font-headline text-stone-900 tracking-tight">Cuentas de Affino</h3>
                        <p className="text-xs text-stone-500 mt-0.5">Configura múltiples credenciales X-User-ID para enviar contactos a Affino.</p>
                    </div>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="bg-primary/10 text-primary hover:bg-primary/20 font-bold text-sm px-4 py-2.5 rounded-lg transition-all active:scale-95 border-0 outline-none flex items-center justify-center gap-2 self-start sm:self-auto"
                >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Añadir Cuenta
                </button>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="py-12 text-center text-stone-400 text-sm flex flex-col items-center gap-2">
                    <span className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                    Cargando cuentas de Affino...
                </div>
            ) : accounts.length === 0 ? (
                <div className="border-2 border-dashed border-stone-200 rounded-xl p-8 text-center text-stone-500">
                    <span className="material-symbols-outlined text-4xl text-stone-300 mb-2 block">database_off</span>
                    <p className="text-sm font-semibold">No hay cuentas de Affino configuradas</p>
                    <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                        Añade una cuenta de Affino para poder seleccionar a quién enviar los contactos desde la página de búsqueda.
                    </p>
                    <button
                        onClick={handleOpenCreate}
                        className="btn-primary-gradient text-white font-bold text-xs px-4 py-2 mt-4 rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all border-0 outline-none inline-flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Crear primera cuenta
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl overflow-hidden border border-stone-200/50 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-stone-50/70 border-b border-stone-100">
                                    <th className="py-4 px-6 text-[10px] font-bold text-stone-500 uppercase tracking-widest">Nombre</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-stone-500 uppercase tracking-widest">X-User-ID</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-stone-500 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {accounts.map((acc) => (
                                    <tr key={acc.id} className="group hover:bg-stone-50/40 transition-colors">
                                        <td className="py-4 px-6 text-sm font-bold text-stone-900">{acc.nombre}</td>
                                        <td className="py-4 px-6 text-xs text-stone-600 font-mono tracking-wider">{obfuscate(acc.x_user_id)}</td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenEdit(acc)}
                                                    className="w-8 h-8 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-colors inline-flex items-center justify-center border-0 outline-none"
                                                    title="Editar cuenta"
                                                >
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(acc)}
                                                    className="w-8 h-8 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600 transition-colors inline-flex items-center justify-center border-0 outline-none"
                                                    title="Eliminar cuenta"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal: Crear / Editar */}
            {modalState && (
                <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <form
                        onSubmit={handleSave}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-stone-200/70"
                    >
                        {/* Header */}
                        <div className="px-6 py-5 flex items-center justify-between border-b border-stone-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-cyan-600 text-lg">
                                        {modalState.mode === 'create' ? 'add_box' : 'edit_square'}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="font-bold text-stone-900 text-base leading-tight">
                                        {modalState.mode === 'create' ? 'Añadir cuenta Affino' : 'Editar cuenta Affino'}
                                    </h2>
                                    <p className="text-[11px] text-stone-400 font-medium">
                                        {modalState.mode === 'create' ? 'Configura un nuevo X-User-ID' : 'Modifica los datos de la cuenta'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalState(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors border-0 outline-none"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className={labelCls}>Nombre de la cuenta</label>
                                <input
                                    className={inputCls}
                                    type="text"
                                    placeholder="ej: Cuenta de Juan, Cuenta Principal"
                                    value={formValues.nombre}
                                    onChange={(e) => setFormValues({ ...formValues, nombre: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className={labelCls}>X-User-ID</label>
                                <div className="relative">
                                    <input
                                        className={inputCls + ' pr-11'}
                                        type={showXUserId ? 'text' : 'password'}
                                        placeholder="Pega aquí tu ID de usuario de Affino"
                                        value={formValues.x_user_id}
                                        onChange={(e) => setFormValues({ ...formValues, x_user_id: e.target.value })}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors border-0 bg-transparent outline-none cursor-pointer"
                                        onClick={() => setShowXUserId(!showXUserId)}
                                        title={showXUserId ? 'Ocultar' : 'Mostrar'}
                                    >
                                        <span className="material-symbols-outlined text-lg">
                                            {showXUserId ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-stone-400 mt-1">
                                    Identificador numérico o cadena de credencial que requiere Affino en su cabecera HTTP.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                            <button
                                type="button"
                                className="px-4 py-2 font-medium text-stone-600 hover:bg-stone-200 rounded-lg text-sm transition-colors border-0 outline-none cursor-pointer"
                                onClick={() => setModalState(null)}
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 font-bold text-white btn-primary-gradient rounded-lg text-sm shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity active:scale-95 border-0 outline-none cursor-pointer"
                                disabled={saving}
                            >
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── Configuración de Conexión ─── */}
            <div className="mt-8 pt-8 border-t border-stone-200/60">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-cyan-600 text-base">settings_ethernet</span>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-stone-800">Configuración de Conexión</h4>
                        <p className="text-[11px] text-stone-400 mt-0.5">URL del endpoint y método de autenticación global compartido por todas las cuentas.</p>
                    </div>
                </div>
                {connLoading ? (
                    <div className="py-6 text-center text-stone-400 text-sm flex items-center gap-2 justify-center">
                        <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                        Cargando configuración...
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div>
                            <label className={labelCls}>Dirección del Servicio (URL)</label>
                            <input className={inputCls} type="text" placeholder="https://api.affino.com/webhook/..."
                                value={connConfig.apiKey || ''}
                                onChange={(e) => updateConn({ apiKey: e.target.value })} />
                            <p className="text-[10px] text-stone-400 mt-1">Endpoint al que se enviarán los contactos exportados.</p>
                        </div>
                        <div>
                            <label className={labelCls}>Tipo de Autenticación</label>
                            <select className={inputCls + ' appearance-none cursor-pointer'} style={selectStyle}
                                value={connConfig.authType || 'Affino'}
                                onChange={(e) => handleConnAuthTypeChange(e.target.value)}
                            >
                                {AUTH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
                            {renderConnAuthFields()}
                        </div>
                        {connError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold">{connError}</div>
                        )}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            {connSaved && (
                                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    Configuración guardada
                                </span>
                            )}
                            <button onClick={handleSaveConnConfig} disabled={connSaving || !connDirty}
                                className="bg-primary/10 text-primary hover:bg-primary/20 font-bold text-sm px-4 py-2.5 rounded-lg transition-all active:scale-95 border-0 outline-none flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {connSaving
                                    ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Guardando...</>
                                    : <><span className="material-symbols-outlined text-base">save</span> Guardar configuración</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Confirmación de Eliminación */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-stone-200/50">
                        <div className="p-6 border-b border-stone-100">
                            <h2 className="font-display text-lg font-bold text-stone-900 flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">warning</span>
                                Confirmar eliminación
                            </h2>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-600 text-sm">
                                ¿Estás seguro de que quieres eliminar la cuenta de Affino <strong>"{deleteConfirm.nombre}"</strong>?
                            </p>
                            <p className="text-[11px] text-stone-400 mt-1">Esta acción no afectará a los registros ni logs históricos ya enviados.</p>
                        </div>
                        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                            <button
                                className="px-4 py-2 font-medium text-stone-600 hover:bg-stone-200 rounded-lg text-sm transition-colors border-0 outline-none cursor-pointer"
                                onClick={() => setDeleteConfirm(null)}
                                disabled={deleting}
                            >
                                Cancelar
                            </button>
                            <button
                                className="px-4 py-2 font-bold text-white btn-danger-gradient rounded-lg text-sm hover:opacity-90 transition-opacity active:scale-95 border-0 outline-none cursor-pointer"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? 'Eliminando...' : 'Eliminar cuenta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
