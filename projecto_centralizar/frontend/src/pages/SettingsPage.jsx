/**
 * SettingsPage — Página de configuración personal del usuario.
 *
 * Esta página es accesible para TODOS los usuarios del CRM,
 * sin importar su rol (admin o gestor). A diferencia de la página
 * "APIs y Webhooks" (que es solo para admins), esta página contiene
 * configuraciones personales del usuario autenticado.
 *
 * Funcionalidades actuales:
 * - Cambio de contraseña: permite al usuario cambiar su contraseña actual
 *   proporcionando la contraseña actual y una nueva contraseña.
 *
 * Validaciones (frontend):
 * - Todos los campos son obligatorios
 * - La nueva contraseña debe tener al menos 6 caracteres
 * - La nueva contraseña y la confirmación deben coincidir
 *
 * El backend realiza validaciones adicionales:
 * - Verifica la contraseña actual contra el hash bcrypt en DB
 * - Valida longitud mínima de la nueva contraseña
 * - Registra el cambio en la tabla de logs para auditoría
 *
 * TODO futuro:
 * - Añadir sección para cambiar email
 * - Añadir preferencias de notificaciones
 * - Añadir configuración de idioma/tema
 * - Añadir sección de perfil (nombre, avatar, etc.)
 */

import { useState } from 'react'
import { api } from '../api/client'

export default function SettingsPage() {
    // ── Estado del formulario de cambio de contraseña ──
    // Tres campos: contraseña actual, nueva contraseña, y confirmación
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    // ── Estado de la UI ──
    // loading: muestra spinner mientras se procesa la solicitud
    // error: mensaje de error si falla la operación
    // success: mensaje temporal de éxito (desaparece en 3s)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    /**
     * Maneja el envío del formulario de cambio de contraseña.
     *
     * Flujo:
     * 1. Validaciones frontend (campos vacíos, coincidencia, longitud mínima)
     * 2. Llamada al backend POST /api/change-password
     * 3. Si éxito: muestra mensaje temporal (3s) y limpia formulario
     * 4. Si error: muestra mensaje de error del backend
     */
    const handleChangePassword = async (e) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        // ── Validación: todos los campos son obligatorios ──
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Todos los campos son obligatorios')
            return
        }

        // ── Validación: la nueva contraseña y la confirmación deben coincidir ──
        // Esta validación se hace solo en frontend (UX). El backend no recibe
        // confirmPassword, ya que es redundante una vez validado aquí.
        if (newPassword !== confirmPassword) {
            setError('La nueva contraseña y la confirmación no coinciden')
            return
        }

        // ── Validación: longitud mínima de 6 caracteres ──
        // Misma regla que el backend, validada aquí para feedback inmediato
        if (newPassword.length < 6) {
            setError('La nueva contraseña debe tener al menos 6 caracteres')
            return
        }

        // ── Enviar al backend ──
        setLoading(true)
        try {
            // POST /api/change-password → verifica contraseña actual,
            // hashea la nueva con bcrypt, y actualiza en DB
            await api.changePassword(currentPassword, newPassword)

            // Éxito: mostrar mensaje temporal y limpiar formulario
            setSuccess('Contraseña actualizada correctamente')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')

            // El mensaje de éxito desaparece después de 3 segundos
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            // El backend retorna mensajes específicos:
            // - "La contraseña actual es incorrecta" (400)
            // - "La nueva contraseña debe tener al menos 6 caracteres" (400)
            setError(err.message || 'Error al cambiar la contraseña')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {/* Título de la página */}
            <div className="page-title-wrap">
                <h1 className="page-title">Settings</h1>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SECCIÓN 1: Cambio de contraseña
                Accesible para todos los usuarios (admin y gestor).
                TODO futuro: añadir más secciones (email, preferencias, etc.)
               ═══════════════════════════════════════════════════════════ */}
            <div className="card" style={{ padding: '24px' }}>
                <h2 style={{
                    fontSize: '1.25rem',
                    marginBottom: '8px',
                    color: 'var(--color-text)',
                }}>
                    Cambiar contraseña
                </h2>
                <p style={{
                    color: 'var(--color-text-muted)',
                    marginBottom: '24px',
                    fontSize: '0.9rem',
                }}>
                    Actualiza tu contraseña de acceso al CRM. La nueva contraseña
                    debe tener al menos 6 caracteres.
                </p>

                {/* Mensajes de éxito y error */}
                {success && (
                    <div className="alert alert-success" style={{
                        marginBottom: '16px',
                        fontSize: '0.9rem',
                    }}>
                        {success}
                    </div>
                )}
                {error && (
                    <div className="alert alert-error" style={{
                        marginBottom: '16px',
                        fontSize: '0.9rem',
                    }}>
                        {error}
                    </div>
                )}

                {/* Formulario de cambio de contraseña */}
                <form onSubmit={handleChangePassword}>
                    {/* Campo: Contraseña actual
                        Se envía al backend para verificar la identidad del usuario.
                        El backend compara este valor con el hash bcrypt en la DB. */}
                    <div className="form-group full" style={{ marginBottom: '16px' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            Contraseña actual
                        </label>
                        <input
                            id="current-password-input"
                            type="password"
                            className="form-control"
                            placeholder="Introduce tu contraseña actual"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            disabled={loading}
                            autoComplete="current-password"
                        />
                    </div>

                    {/* Campo: Nueva contraseña
                        Se hashea con bcrypt en el backend antes de almacenar.
                        Mínimo 6 caracteres (validado en frontend y backend). */}
                    <div className="form-group full" style={{ marginBottom: '16px' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            Nueva contraseña
                        </label>
                        <input
                            id="new-password-input"
                            type="password"
                            className="form-control"
                            placeholder="Mínimo 6 caracteres"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={loading}
                            autoComplete="new-password"
                        />
                    </div>

                    {/* Campo: Confirmar nueva contraseña
                        Solo se valida en frontend para evitar errores de escritura.
                        No se envía al backend — es solo una medida de UX. */}
                    <div className="form-group full" style={{ marginBottom: '24px' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                            Confirmar nueva contraseña
                        </label>
                        <input
                            id="confirm-password-input"
                            type="password"
                            className="form-control"
                            placeholder="Repite la nueva contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            autoComplete="new-password"
                        />
                    </div>

                    {/* Botón de envío con spinner de carga */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--color-border)',
                    }}>
                        <button
                            id="change-password-btn"
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            {/* Spinner visible solo mientras se procesa la solicitud */}
                            {loading && (
                                <span
                                    className="spinner"
                                    style={{ width: 16, height: 16 }}
                                />
                            )}
                            {loading ? 'Cambiando...' : 'Cambiar contraseña'}
                        </button>
                    </div>
                </form>
            </div>

            {/* TODO futuro: añadir más secciones de configuración aquí
                Posibles secciones:
                - Cambiar email
                - Preferencias de notificaciones
                - Configuración de idioma / tema
                - Gestión de sesiones activas
                - Exportación de datos personales (GDPR)
            */}
        </div>
    )
}
