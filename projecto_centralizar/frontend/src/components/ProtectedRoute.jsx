/**
 * ProtectedRoute — Componente de protección de rutas por autenticación y rol.
 *
 * ¿Qué hace?
 * 1. Verifica si hay un token JWT almacenado (autenticación)
 * 2. Opcionalmente verifica si el rol del usuario tiene permiso (autorización)
 * 3. Redirige a /login si no hay token
 * 4. Muestra "Acceso denegado" si el rol no tiene permiso
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  RECORDATORIO: SEGURIDAD EN CAPAS                              │
 * │                                                                 │
 * │  Frontend (este componente):                                    │
 * │  - Mejora la UX al evitar que el usuario vea páginas que no    │
 * │    debería ver                                                  │
 * │  - Es "cosmético" — un usuario técnico podría saltárselo       │
 * │                                                                 │
 * │  Backend (require_admin en FastAPI):                            │
 * │  - Es la barrera REAL de seguridad                              │
 * │  - Verifica el JWT con la clave secreta                         │
 * │  - Verifica el rol contra la base de datos                      │
 * │  - Rechaza con 401/403 cualquier acceso no autorizado          │
 * │                                                                 │
 * │  Ambas capas trabajan juntas:                                   │
 * │  - Frontend: la puerta tiene un cartel de "Solo empleados"     │
 * │  - Backend: la puerta tiene una cerradura con llave            │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Uso:
 *   // Solo autenticación (cualquier rol)
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 *
 *   // Autenticación + rol admin
 *   <ProtectedRoute requiredRole="admin" userRole={role}>
 *     <UsersPage />
 *   </ProtectedRoute>
 */

import { getToken } from '../api/client'
import { Navigate } from 'react-router-dom'


/**
 * Componente ProtectedRoute.
 *
 * Props:
 * @param {ReactNode} children     - Componente hijo a renderizar si pasa las verificaciones
 * @param {string}    requiredRole - Rol requerido para acceder (opcional, ej: "admin")
 * @param {string}    userRole     - Rol actual del usuario (extraído del JWT)
 * @param {Function}  fallback     - Componente a mostrar si no tiene el rol (opcional)
 *
 * Flujo de decisión:
 *   ¿Hay token? → NO  → Redirigir a /login
 *                → SÍ  → ¿Se requiere rol específico?
 *                           → NO  → Renderizar children ✅
 *                           → SÍ  → ¿El usuario tiene ese rol?
 *                                     → SÍ → Renderizar children ✅
 *                                     → NO → Mostrar "Acceso denegado" ❌
 */
export default function ProtectedRoute({ children, requiredRole, userRole, fallback }) {
    // ── Verificación 1: ¿Hay token JWT? ──
    // Si no hay token, el usuario no está autenticado → redirigir a login
    const token = getToken()
    if (!token) {
        return <Navigate to="/login" replace />
    }

    // ── Verificación 2: ¿El rol es el requerido? ──
    // Solo se verifica si se especificó un requiredRole
    if (requiredRole && userRole !== requiredRole) {
        // Si se proporcionó un fallback personalizado, usarlo
        if (fallback) return fallback

        // Fallback por defecto: mensaje de acceso denegado
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '60vh',
                gap: '16px',
                color: 'var(--color-text-muted)',
            }}>
                <span style={{ fontSize: '3rem' }}>🔒</span>
                <h2 style={{ color: 'var(--color-text)', margin: 0 }}>Acceso denegado</h2>
                <p style={{ margin: 0, textAlign: 'center', maxWidth: 400 }}>
                    No tienes permisos para acceder a esta sección.
                    Se requiere rol de <strong style={{ color: 'var(--color-accent)' }}>{requiredRole}</strong>.
                </p>
            </div>
        )
    }

    // ── Todas las verificaciones pasaron → renderizar el contenido ──
    return children
}
