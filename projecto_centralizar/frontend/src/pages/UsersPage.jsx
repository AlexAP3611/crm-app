/**
 * UsersPage — Página de gestión de usuarios y roles del CRM.
 *
 * Muestra una tabla con todos los usuarios registrados del sistema,
 * permitiendo ver su email, rol actual, fecha de creación, y
 * cambiar su rol desde un select desplegable.
 *
 * Integración con backend:
 * - GET  /api/users            → Carga la lista de usuarios al montar
 * - PUT  /api/users/{id}/role  → Cambia el rol al modificar el select
 *
 * Ambos endpoints están definidos en backend/app/routers/users.py
 * y registrados en main.py.
 *
 * TODO futuro:
 * - Añadir paginación si hay muchos usuarios
 * - Filtrado por rol
 * - Proteger esta página solo para admins
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
 *
 * TODO: En el futuro, estos roles podrían venir del backend
 * para permitir roles dinámicos.
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
    // - admin: badge-accent (color destacado, azul/morado)
    // - gestor: badge-default (color neutro)
    const map = {
        admin: { label: 'Admin', className: 'badge badge-accent' },
        gestor: { label: 'Gestor', className: 'badge badge-default' },
    }
    const info = map[role] || map.gestor
    return <span className={info.className}>{info.label}</span>
}

/**
 * Componente principal: Página de gestión de usuarios.
 *
 * Estructura:
 * 1. Título de página con descripción
 * 2. Mensajes de feedback (éxito/error)
 * 3. Tabla de usuarios con:
 *    - Email del usuario
 *    - Select desplegable para cambiar rol
 *    - Fecha de creación formateada
 *    - Acciones futuras
 *
 * Estado interno:
 * - users: Array de usuarios cargados desde GET /api/users
 * - loading: Boolean para mostrar spinner mientras se cargan datos
 * - error: Mensaje de error si falla la carga o el cambio de rol
 * - successMsg: Mensaje de éxito temporal al cambiar rol
 * - changingRoleId: ID del usuario cuyo rol se está cambiando (para feedback visual)
 */
export default function UsersPage() {
    // ── Estado del componente ──
    const [users, setUsers] = useState([])           // Lista de usuarios
    const [loading, setLoading] = useState(true)     // Spinner de carga inicial
    const [error, setError] = useState(null)         // Mensaje de error
    const [successMsg, setSuccessMsg] = useState('') // Mensaje de éxito temporal
    const [changingRoleId, setChangingRoleId] = useState(null) // ID del usuario en proceso de cambio

    /**
     * Carga la lista de usuarios desde el backend.
     *
     * Llama a GET /api/users que retorna { users: [...] }
     * donde cada usuario tiene: id, email, role, created_at.
     *
     * El backend ordena por created_at DESC (más recientes primero)
     * y registra la consulta en la tabla de logs.
     */
    const fetchUsers = useCallback(async () => {
        setError(null)
        setLoading(true)
        try {
            // Llamada real al backend: GET /api/users
            // Respuesta esperada: { users: [{ id, email, role, created_at }, ...] }
            const data = await api.listUsers()
            setUsers(data.users || [])
        } catch (err) {
            // Si la llamada a la API falla, mostramos el error
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
     * Respuesta esperada: { success: true, new_role: "admin"|"gestor" }
     *
     * Errores posibles del backend:
     * - 422: Rol inválido (solo acepta 'admin' o 'gestor')
     * - 404: Usuario no encontrado
     * - 403: No autorizado (cuando se implemente validación real)
     *
     * @param {number} userId - ID del usuario a modificar
     * @param {string} newRole - Nuevo rol ('admin' o 'gestor')
     */
    const handleRoleChange = async (userId, newRole) => {
        // Limpiar mensajes anteriores
        setError(null)
        setSuccessMsg('')
        // Marcar qué usuario está siendo cambiado (para mostrar spinner en esa fila)
        setChangingRoleId(userId)

        try {
            // Llamada real al backend: PUT /api/users/{userId}/role
            // Body: { role: newRole }
            await api.updateUserRole(userId, newRole)

            // Actualizar el estado local para reflejar el cambio visualmente
            // sin necesidad de recargar toda la lista
            setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
            )

            // Buscar el email del usuario para el mensaje de feedback
            const user = users.find((u) => u.id === userId)
            const email = user ? user.email : `ID ${userId}`

            // Mostrar mensaje de éxito temporal (se oculta a los 3 segundos)
            setSuccessMsg(`Rol de ${email} cambiado a "${newRole}" correctamente`)
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err) {
            // En caso de error del backend, mostramos el mensaje de error
            setError(err.message || 'Error al cambiar rol del usuario')
        } finally {
            // Limpiar el indicador de cambio en progreso
            setChangingRoleId(null)
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
            {/* Mensaje de error: se muestra en rojo cuando algo falla */}
            {error && <div className="alert alert-error">{error}</div>}
            {/* Mensaje de éxito: se muestra en verde temporalmente tras un cambio */}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}

            {/* ── Tabla de usuarios ── */}
            <div className="card">
                <div className="table-wrap" style={{ border: 'none' }}>
                    <table>
                        <thead>
                            <tr>
                                {/* Columna Email: identificador principal del usuario */}
                                <th>Email</th>
                                {/* Columna Rol: select desplegable para cambiar el rol */}
                                <th>Rol</th>
                                {/* Columna Fecha: cuándo se creó el usuario */}
                                <th>Fecha de creación</th>
                                {/* Columna Acciones: reservada para futuras acciones */}
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ── Estado: Cargando ── */}
                            {/* Muestra un spinner centrado mientras se cargan los datos */}
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
                                /* Muestra un mensaje cuando no hay usuarios registrados */
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
                                /* ── Estado: Con usuarios ── */
                                /* Renderiza una fila por cada usuario */
                                users.map((user) => (
                                    <tr key={user.id}>
                                        {/* Celda Email */}
                                        <td>
                                            <span style={{ fontWeight: 500 }}>
                                                {user.email}
                                            </span>
                                        </td>

                                        {/* Celda Rol — Select desplegable */}
                                        {/*
                                         * El select permite cambiar el rol.
                                         * Al cambiar, se llama handleRoleChange que
                                         * llama a PUT /api/users/{id}/role en el backend.
                                         *
                                         * Mientras se procesa el cambio de un usuario,
                                         * mostramos el spinner en lugar del select.
                                         */}
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
                                                    {/* Badge visual del rol actual */}
                                                    <RoleBadge role={user.role} />
                                                    {/* Select para cambiar */}
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

                                        {/* Celda Acciones */}
                                        {/*
                                         * TODO futuro: Añadir acciones como:
                                         * - Eliminar usuario (DELETE /api/users/{id})
                                         * - Resetear contraseña
                                         * - Ver historial de actividad del usuario
                                         */}
                                        <td style={{ textAlign: 'right' }}>
                                            <span
                                                className="text-muted text-xs"
                                                style={{ fontStyle: 'italic' }}
                                            >
                                                {/* Placeholder para futuras acciones */}
                                                —
                                            </span>
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
        </>
    )
}
