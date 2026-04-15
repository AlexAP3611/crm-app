import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

const AVAILABLE_ROLES = [
    { value: 'gestor', label: 'Gestor' },
    { value: 'admin', label: 'Admin' },
]

function formatDate(isoString) {
    if (!isoString) return '—'
    const date = new Date(isoString)
    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function RoleBadge({ role }) {
    if (role === 'admin') {
        return (
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">verified_user</span>
                <span className="text-sm font-medium">Admin</span>
            </div>
        )
    }
    return (
        <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-lg">edit_square</span>
            <span className="text-sm font-medium">Gestor</span>
        </div>
    )
}

function ConfirmDeleteUserModal({ email, loading, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4" onClick={onCancel}>
            <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                    <h2 className="font-display text-lg font-bold text-stone-900">Eliminar usuario</h2>
                    <button className="text-stone-400 hover:text-stone-600" onClick={onCancel}><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="p-6">
                    <p className="text-stone-600 text-sm mb-2">
                        ¿Estás seguro que deseas eliminar al usuario <strong className="text-stone-900">{email}</strong>?
                    </p>
                    <p className="text-stone-500 text-xs leading-relaxed">
                        El usuario será desactivado y no podrá acceder al sistema. Esta acción queda registrada en los logs de auditoría y bloquea el acceso inmediatamente.
                    </p>
                </div>
                <div className="px-6 py-4 bg-surface-container-low flex justify-end gap-3">
                    <button className="px-4 py-2 font-medium text-stone-600 hover:bg-stone-200 rounded-lg text-sm transition-colors" onClick={onCancel} disabled={loading}>
                        Cancelar
                    </button>
                    <button className="px-4 py-2 font-bold text-white bg-error rounded-lg text-sm hover:opacity-90 transition-opacity" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Eliminando…' : 'Desactivar usuario'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function UsersPage({ currentUserEmail }) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [successMsg, setSuccessMsg] = useState('')
    const [changingRoleId, setChangingRoleId] = useState(null)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deletingUserId, setDeletingUserId] = useState(null)

    const fetchUsers = useCallback(async () => {
        setError(null)
        setLoading(true)
        try {
            const data = await api.listUsers()
            setUsers(data.users || [])
        } catch (err) {
            setError(err.message || 'Error al cargar usuarios')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchUsers() }, [fetchUsers])

    const handleRoleChange = async (userId, newRole) => {
        setError(null)
        setSuccessMsg('')
        setChangingRoleId(userId)

        try {
            await api.updateUserRole(userId, newRole)
            setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)))
            const user = users.find(u => u.id === userId)
            const email = user ? user.email : `ID ${userId}`
            setSuccessMsg(`Rol de ${email} cambiado a "${newRole}" correctamente`)
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err) {
            setError(err.message || 'Error al cambiar rol del usuario')
        } finally {
            setChangingRoleId(null)
        }
    }

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        setDeletingUserId(deleteTarget.id)
        setError(null)
        setSuccessMsg('')
        try {
            await api.deleteUser(deleteTarget.id)
            setDeleteTarget(null)
            setSuccessMsg(`Usuario "${deleteTarget.email}" eliminado correctamente`)
            setTimeout(() => setSuccessMsg(''), 3000)
            await fetchUsers()
        } catch (err) {
            setError(err.message || 'Error al eliminar usuario')
        } finally {
            setDeletingUserId(null)
        }
    }

    return (
        <div className="p-8 pb-20 space-y-8">
            {/* Header & Hero */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Usuarios y Equipos</h2>
                    <p className="text-on-surface-variant font-medium">
                        Gestiona la jerarquía editorial de tu organización. Controla los niveles de acceso y gestiona a los miembros del equipo.
                    </p>
                </div>
            </div>

            {/* Error / Success Messages */}
            {error && <div className="mb-6 bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium">{error}</div>}
            {successMsg && <div className="mb-6 bg-primary-fixed/30 text-primary p-4 rounded-xl text-sm font-medium">{successMsg}</div>}

            {/* Content Table */}
            <section className="bg-surface-container-lowest rounded-2xl p-2 shadow-sm border border-outline-variant/10">
                <div className="flex items-center justify-between p-6 border-b border-surface-container-low">
                    <h3 className="font-headline font-bold text-lg text-on-surface">Miembros Registrados</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary font-medium">Mostrando {users.length} de {users.length}</span>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface-container-low/50">
                                <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Usuario</th>
                                <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Estado</th>
                                <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Rol Asignado</th>
                                <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Última Actividad</th>
                                <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-widest text-on-surface-variant text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container-low">
                            {loading ? (
                                <tr><td colSpan="5" className="py-20 text-center text-stone-400">Cargando catálogo de usuarios...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan="5" className="py-20 text-center text-stone-400">No se encontraron usuarios.</td></tr>
                            ) : users.map(user => (
                                <tr key={user.id} className="group hover:bg-surface-container-low/50 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary font-bold uppercase overflow-hidden ring-1 ring-outline/10">
                                                {user.email.substring(0, 2)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-on-surface">{user.email.split('@')[0]}</div>
                                                <div className="text-xs text-secondary">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="px-3 py-1 bg-primary-fixed/50 text-on-primary-fixed text-[10px] font-bold rounded-full uppercase tracking-tighter">Activo</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            {changingRoleId === user.id ? (
                                                <div className="flex items-center gap-2 text-primary text-sm font-medium">Cambiando...</div>
                                            ) : (
                                                <>
                                                    <RoleBadge role={user.role} />
                                                    <select
                                                        className="bg-transparent text-xs text-secondary border border-outline-variant/50 rounded-md py-1 pl-2 pr-6 hover:border-primary transition-colors focus:ring-0"
                                                        value={user.role}
                                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                    >
                                                        {AVAILABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                                    </select>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-stone-800">{formatDate(user.created_at)}</span>
                                            <span className="text-[10px] text-secondary">Cuenta Creada</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        {user.email !== currentUserEmail ? (
                                            <button
                                                onClick={() => setDeleteTarget({ id: user.id, email: user.email })}
                                                className="bg-error/10 text-error px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-error/20 transition-all flex items-center gap-1 ml-auto active:scale-95 border border-error/20 shadow-sm outline-none focus:outline-none focus:ring-2 focus:ring-error/40"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">person_remove</span>
                                                Eliminar
                                            </button>
                                        ) : (
                                            <span className="text-xs text-secondary font-medium italic flex items-center justify-end gap-1 px-3 py-1.5">
                                                Usuario Actual
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Modals */}
            {deleteTarget && (
                <ConfirmDeleteUserModal
                    email={deleteTarget.email}
                    loading={deletingUserId === deleteTarget.id}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    )
}
