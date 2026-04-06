/**
 * UsersPage — Página de gestión de usuarios y roles del CRM.
 *
 * Muestra una tabla con todos los usuarios activos del sistema,
 * permitiendo ver su email, rol actual, fecha de creación, y:
 *   - Cambiar su rol desde un select desplegable
 *   - Eliminar el usuario (borrado lógico) con modal de confirmación
 *
 * ══ BORRADO LÓGICO ══
 * Al eliminar un usuario, NO se borra físicamente de la base de datos.
 * Se marca como inactivo (is_active = False) en el backend.
 * Esto preserva:
 *   - Historial de logs asociados al usuario
 *   - Datos de auditoría (quién fue, qué hizo, cuándo)
 *   - Posibilidad de reactivar la cuenta en el futuro
 *
 * ¿Por qué solo admins pueden borrar?
 *   - Esta acción tiene impacto directo en el acceso al sistema
 *   - Solo un administrador debe poder revocar acceso de otros
 *   - El backend verifica el rol con AdminUser dependency (403 si no es admin)
 *   - El frontend oculta el botón para reforzar la UX (pero la seguridad real
 *     está en el backend)
 *
 * Integración con backend:
 *   - GET    /api/users          → Carga la lista de usuarios activos
 *   - PUT    /api/users/{id}/role → Cambia el rol al modificar el select
 *   - DELETE /api/users/{id}     → Elimina lógicamente (is_active = False)
 *
 * Integración con logs:
 *   - Cada eliminación queda registrada en la tabla 'logs' con:
 *     action = 'Usuario eliminado', metadata con email, rol, admin que lo hizo
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

/**
 * Roles disponibles en el sistema.
 * Se usan para popular el select desplegable en la columna "Rol".
 *
 * Cada opción tiene:
 * - value: El valor que se envía al backend
 * - label: El texto que se muestra al usuario
 */
const AVAILABLE_ROLES = [
    { value: 'gestor', label: 'Gestor' },
    { value: 'admin', label: 'Admin' },
]

/**
 * Formatea una fecha ISO 8601 a formato legible en español.
 *
 * @param {string} isoString - Fecha en formato ISO 8601
 * @returns {string} Fecha formateada (ej: "15/01/2026, 10:30")
 */
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

/**
 * Badge visual para mostrar el rol del usuario.
 * Usa colores diferentes para distinguir admin de gestor.
 *
 * @param {Object} props
 * @param {string} props.role - Rol del usuario ('admin' o 'gestor')
 */
function RoleBadge({ role }) {
    // Mapeo de roles a estilos de badge
    // - admin: badge-accent (color destacado, verde)
    // - gestor: badge-default (color neutro)
    const map = {
        admin: { label: 'Admin', className: 'badge badge-accent' },
        gestor: { label: 'Gestor', className: 'badge badge-default' },
    }
    const info = map[role] || map.gestor
    return <span className={info.className}>{info.label}</span>
}

/**
 * Modal de confirmación para eliminar un usuario.
 *
 * Muestra el email del usuario que se va a eliminar y pide confirmación
 * antes de proceder. Incluye spinner mientras se procesa la operación.
 *
 * ¿Por qué un modal de confirmación?
 *   - Eliminar un usuario es una acción destructiva (aunque sea lógica)
 *   - Previene eliminaciones accidentales por click erróneo
 *   - Da al administrador una última oportunidad de revisar antes de actuar
 *
 * @param {Object} props
 * @param {string} props.email    - Email del usuario a eliminar
 * @param {boolean} props.loading - Si está procesando la eliminación
 * @param {function} props.onConfirm - Callback al confirmar
 * @param {function} props.onCancel  - Callback al cancelar
 */
function ConfirmDeleteUserModal({ email, loading, onConfirm, onCancel }) {
    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 440, gap: 0 }}
            >
                {/* Cabecera del modal */}
                <div className="modal-header">
                    <h2 className="modal-title">Eliminar usuario</h2>
                    <button className="modal-close" onClick={onCancel}>✕</button>
                </div>

                {/* Mensaje de confirmación */}
                <p
                    style={{
                        color: 'var(--color-text-muted)',
                        fontSize: '0.9375rem',
                        lineHeight: 1.6,
                        padding: '16px 0',
                    }}
                >
                    ¿Estás seguro que deseas eliminar al usuario{' '}
                    <strong style={{ color: 'var(--color-text)' }}>{email}</strong>?
                    <br />
                    <span style={{ fontSize: '0.8125rem' }}>
                        El usuario será desactivado y no podrá acceder al sistema.
                        Esta acción queda registrada en los logs de auditoría.
                    </span>
                </p>

                {/* Botones de acción */}
                <div className="modal-footer" style={{ marginTop: 0 }}>
                    <button
                        className="btn btn-secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={onConfirm}
                        disabled={loading}
                        id="confirm-delete-user-btn"
                    >
                        {/* Spinner visual durante la operación de borrado */}
                        {loading ? 'Eliminando…' : 'Eliminar usuario'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/**
 * Componente principal: Página de gestión de usuarios.
 *
 * Props:
 * - currentUserEmail: Email del admin autenticado actualmente.
 *   Se usa para:
 *     1. No mostrar el botón "Eliminar" en la fila del propio admin
 *        (no puede auto-eliminarse)
 *     2. Reforzar la UX — el backend también impide la auto-eliminación
 *        pero ocultando el botón se evita confusión
 *
 * Estado interno:
 * - users:           Array de usuarios cargados desde GET /api/users
 * - loading:         Boolean para mostrar spinner durante la carga inicial
 * - error:           Mensaje de error si falla alguna operación
 * - successMsg:      Mensaje de éxito temporal (se oculta a los 3 segundos)
 * - changingRoleId:  ID del usuario cuyo rol se está cambiando
 * - deleteTarget:    Objeto { id, email } del usuario a eliminar (null si no hay modal)
 * - deletingUserId:  ID del usuario que se está eliminando (para spinner)
 */
export default function UsersPage({ currentUserEmail }) {
    // ── Estado del componente ──
    const [users, setUsers] = useState([])           // Lista de usuarios activos
    const [loading, setLoading] = useState(true)     // Spinner de carga inicial
    const [error, setError] = useState(null)         // Mensaje de error
    const [successMsg, setSuccessMsg] = useState('') // Mensaje de éxito temporal
    const [changingRoleId, setChangingRoleId] = useState(null) // ID en proceso de cambio de rol

    // ── Estado para eliminación de usuarios ──
    // deleteTarget: contiene { id, email } del usuario a eliminar.
    // Se usa para mostrar/ocultar el modal de confirmación.
    // Cuando es null, el modal no se muestra.
    const [deleteTarget, setDeleteTarget] = useState(null)
    // deletingUserId: ID del usuario que se está procesando para eliminación.
    // Se usa para mostrar spinner en el botón del modal durante la operación.
    const [deletingUserId, setDeletingUserId] = useState(null)

    /**
     * Carga la lista de usuarios activos desde el backend.
     *
     * Llama a GET /api/users que retorna { users: [...] }
     * donde cada usuario tiene: id, email, role, created_at.
     *
     * NOTA: El backend ya filtra por is_active = True,
     * por lo que los usuarios eliminados lógicamente no aparecen.
     */
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

    // Cargar usuarios al montar el componente
    useEffect(() => {
        fetchUsers()
    }, [fetchUsers])

    /**
     * Maneja el cambio de rol de un usuario.
     *
     * Llama a PUT /api/users/{id}/role con body { role: newRole }
     * El backend valida el rol, actualiza la DB y registra en logs.
     *
     * @param {number} userId - ID del usuario a modificar
     * @param {string} newRole - Nuevo rol ('admin' o 'gestor')
     */
    const handleRoleChange = async (userId, newRole) => {
        setError(null)
        setSuccessMsg('')
        setChangingRoleId(userId)

        try {
            await api.updateUserRole(userId, newRole)

            // Actualizar el estado local sin recargar toda la lista
            setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
            )

            const user = users.find((u) => u.id === userId)
            const email = user ? user.email : `ID ${userId}`

            // Mensaje de éxito temporal (se oculta a los 3 segundos)
            setSuccessMsg(`Rol de ${email} cambiado a "${newRole}" correctamente`)
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err) {
            setError(err.message || 'Error al cambiar rol del usuario')
        } finally {
            setChangingRoleId(null)
        }
    }

    /**
     * ══ ELIMINAR USUARIO (borrado lógico) ══
     *
     * Flujo completo de eliminación:
     * 1. El admin hace clic en "Eliminar" → se abre el modal (setDeleteTarget)
     * 2. El admin confirma en el modal → se ejecuta handleConfirmDelete
     * 3. Se llama a DELETE /api/users/{id} (borrado lógico en backend)
     * 4. El backend cambia is_active = False y registra log de auditoría
     * 5. Se refresca la tabla (el usuario eliminado ya no aparece)
     * 6. Se muestra mensaje de éxito temporal
     *
     * Si hay error, se muestra el mensaje de error del backend.
     */
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return

        setDeletingUserId(deleteTarget.id)
        setError(null)
        setSuccessMsg('')

        try {
            // Llamada al backend: DELETE /api/users/{id}
            // El backend realiza borrado lógico (is_active = False)
            // y registra la acción en la tabla de logs
            await api.deleteUser(deleteTarget.id)

            // Cerrar el modal
            setDeleteTarget(null)

            // Mensaje de éxito temporal
            setSuccessMsg(`Usuario "${deleteTarget.email}" eliminado correctamente`)
            setTimeout(() => setSuccessMsg(''), 3000)

            // Refrescar la tabla — el usuario eliminado ya no aparecerá
            // porque GET /api/users filtra is_active = True
            await fetchUsers()
        } catch (err) {
            // Mostrar error del backend (ej: "No puedes eliminar tu propia cuenta",
            // "No se puede eliminar al último administrador", etc.)
            setError(err.message || 'Error al eliminar usuario')
        } finally {
            setDeletingUserId(null)
        }
    }

    // ── Render ──
    return (
        <>
            {/* ── Título de la página ── */}
            <div className="page-title-wrap">
                <h1 className="page-title">Usuarios</h1>
                <p className="page-subtitle">
                    Gestiona los usuarios registrados y sus roles en el sistema
                </p>
            </div>

            {/* ── Mensajes de feedback ── */}
            {error && <div className="alert alert-error">{error}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}

            {/* ── Tabla de usuarios ── */}
            <div className="card">
                <div className="table-wrap" style={{ border: 'none' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Fecha de creación</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ── Estado: Cargando ── */}
                            {loading ? (
                                <tr>
                                    <td colSpan={4}>
                                        <div
                                            className="empty-state"
                                            style={{ padding: '60px 24px' }}
                                        >
                                            <div className="spinner"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                /* ── Estado: Sin usuarios ── */
                                <tr>
                                    <td colSpan={4}>
                                        <div
                                            className="empty-state"
                                            style={{ padding: '60px 24px' }}
                                        >
                                            <div className="empty-state-icon">👤</div>
                                            <p
                                                style={{
                                                    fontSize: '1rem',
                                                    fontWeight: 600,
                                                    marginBottom: 4,
                                                }}
                                            >
                                                No hay usuarios registrados
                                            </p>
                                            <p className="text-muted text-xs">
                                                Los usuarios aprobados aparecerán aquí
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                /* ── Estado: Con usuarios — renderizar filas ── */
                                users.map((user) => (
                                    <tr key={user.id}>
                                        {/* Celda Email */}
                                        <td>
                                            <span style={{ fontWeight: 500 }}>
                                                {user.email}
                                            </span>
                                        </td>

                                        {/* Celda Rol — Select desplegable para cambiar rol */}
                                        <td>
                                            {changingRoleId === user.id ? (
                                                /* Spinner mientras se procesa el cambio */
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span
                                                        className="spinner"
                                                        style={{
                                                            width: 16,
                                                            height: 16,
                                                            borderWidth: 2,
                                                        }}
                                                    ></span>
                                                    <span className="text-muted text-xs">
                                                        Cambiando...
                                                    </span>
                                                </div>
                                            ) : (
                                                /* Select desplegable para elegir rol */
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <RoleBadge role={user.role} />
                                                    <select
                                                        id={`role-select-${user.id}`}
                                                        className="form-control"
                                                        value={user.role}
                                                        onChange={(e) =>
                                                            handleRoleChange(
                                                                user.id,
                                                                e.target.value
                                                            )
                                                        }
                                                        style={{
                                                            width: 'auto',
                                                            padding: '4px 8px',
                                                            fontSize: '0.85rem',
                                                            minWidth: 100,
                                                        }}
                                                    >
                                                        {AVAILABLE_ROLES.map((r) => (
                                                            <option key={r.value} value={r.value}>
                                                                {r.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </td>

                                        {/* Celda Fecha de creación */}
                                        <td className="td-muted">
                                            {formatDate(user.created_at)}
                                        </td>

                                        {/* ══ Celda Acciones — Botón Eliminar ══
                                            El botón "Eliminar" se muestra SOLO si:
                                            1. El usuario NO es el propio admin logueado
                                               (no puede auto-eliminarse)

                                            ¿Por qué no se permite auto-eliminación?
                                            - Si el admin se elimina, pierde acceso al sistema
                                            - El backend también lo impide (400 Bad Request)
                                            - Ocultar el botón refuerza la UX
                                        */}
                                        <td style={{ textAlign: 'right' }}>
                                            {user.email !== currentUserEmail ? (
                                                <button
                                                    id={`delete-user-${user.id}`}
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() =>
                                                        setDeleteTarget({
                                                            id: user.id,
                                                            email: user.email,
                                                        })
                                                    }
                                                >
                                                    🗑 Eliminar
                                                </button>
                                            ) : (
                                                /* El admin actual ve un indicador en lugar del botón */
                                                <span
                                                    className="text-muted text-xs"
                                                    style={{ fontStyle: 'italic' }}
                                                >
                                                    (tú)
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Contador de usuarios ── */}
            {!loading && users.length > 0 && (
                <div
                    style={{
                        marginTop: 8,
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                    }}
                >
                    Mostrando {users.length} usuario{users.length !== 1 ? 's' : ''}
                </div>
            )}

            {/* ══ MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ══
                Se muestra cuando deleteTarget !== null.
                Contiene el email del usuario a eliminar y botones de
                confirmar/cancelar con spinner durante el procesamiento.

                Integración con backend:
                - Al confirmar → DELETE /api/users/{id} (borrado lógico)
                - El backend cambia is_active = False
                - El backend registra log: action = 'Usuario eliminado'
                - Al completarse → se refresca la tabla y se muestra éxito */}
            {deleteTarget && (
                <ConfirmDeleteUserModal
                    email={deleteTarget.email}
                    loading={deletingUserId === deleteTarget.id}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </>
    )
}
