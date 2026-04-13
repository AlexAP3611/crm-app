/**
 * useSessionTimeout — Hook de gestión de inactividad de sesión.
 *
 * Detecta inactividad del usuario escuchando eventos globales del DOM.
 * Gestiona dos timers independientes:
 *   - Timer de aviso    (WARNING_MS):  muestra modal de advertencia
 *   - Timer de expiración (LOGOUT_MS): cierra sesión automáticamente
 *
 * Ambos timers se reinician con cualquier actividad del usuario.
 *
 * Uso:
 *   const { showWarning, secondsLeft, extendSession, forceLogout } =
 *       useSessionTimeout({ onLogout })
 *
 * @param {Object} options
 * @param {Function} options.onLogout - Callback que ejecuta el cierre de sesión global
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { api, removeToken } from '../api/client'

// ── Configuración de tiempos ──────────────────────────────────────────
const WARNING_MINUTES  = 25   // Mostrar aviso tras N minutos de inactividad
const LOGOUT_MINUTES   = 30   // Logout automático tras N minutos de inactividad
const WARNING_MS = WARNING_MINUTES * 60 * 1000
const LOGOUT_MS  = LOGOUT_MINUTES  * 60 * 1000

// Eventos de actividad que resetean los timers
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

export function useSessionTimeout({ onLogout }) {
    const [showWarning, setShowWarning]   = useState(false)
    const [secondsLeft, setSecondsLeft]   = useState((LOGOUT_MINUTES - WARNING_MINUTES) * 60)

    // Refs para los timers — no necesitan provocar re-render
    const warningTimerRef    = useRef(null)
    const logoutTimerRef     = useRef(null)
    const countdownTimerRef  = useRef(null)
    const isLoggingOutRef    = useRef(false)

    // ── Logout ────────────────────────────────────────────────────────
    const forceLogout = useCallback(async () => {
        if (isLoggingOutRef.current) return
        isLoggingOutRef.current = true

        // Limpiar todos los timers
        clearTimeout(warningTimerRef.current)
        clearTimeout(logoutTimerRef.current)
        clearInterval(countdownTimerRef.current)

        setShowWarning(false)

        try {
            await api.logout()
        } catch (_) {
            // Si el logout falla (token ya expirado), igualmente limpiamos el estado
            removeToken()
        }

        if (onLogout) onLogout()
    }, [onLogout])

    // ── Reiniciar timers ──────────────────────────────────────────────
    const resetTimers = useCallback(() => {
        // No reiniciar si ya estamos en proceso de logout
        if (isLoggingOutRef.current) return

        // Limpiar timers actuales
        clearTimeout(warningTimerRef.current)
        clearTimeout(logoutTimerRef.current)
        clearInterval(countdownTimerRef.current)

        // Ocultar modal si estaba visible
        setShowWarning(false)
        setSecondsLeft((LOGOUT_MINUTES - WARNING_MINUTES) * 60)

        // Timer 1: mostrar aviso a los WARNING_MS
        warningTimerRef.current = setTimeout(() => {
            setShowWarning(true)

            // Iniciar cuenta regresiva de segundos en el modal
            let remaining = (LOGOUT_MINUTES - WARNING_MINUTES) * 60
            setSecondsLeft(remaining)

            countdownTimerRef.current = setInterval(() => {
                remaining -= 1
                setSecondsLeft(remaining)
                if (remaining <= 0) clearInterval(countdownTimerRef.current)
            }, 1000)
        }, WARNING_MS)

        // Timer 2: logout automático a los LOGOUT_MS
        logoutTimerRef.current = setTimeout(() => {
            forceLogout()
        }, LOGOUT_MS)
    }, [forceLogout])

    // ── Renovar sesión (botón "Continuar sesión") ─────────────────────
    const extendSession = useCallback(async () => {
        try {
            await api.refreshToken()
        } catch (err) {
            // Si el token ya expiró en el backend, forzar logout
            console.warn('[session] No se pudo renovar el token:', err.message)
            forceLogout()
            return
        }
        // Token renovado — reiniciar timers y ocultar modal
        resetTimers()
    }, [resetTimers, forceLogout])

    // ── Efecto: registrar listeners de actividad ──────────────────────
    useEffect(() => {
        // Handler de actividad: invocar resetTimers con throttle implícito
        // (setTimeout ya actúa como debounce natural — reiniciar no es costoso)
        const handleActivity = () => resetTimers()

        ACTIVITY_EVENTS.forEach((event) =>
            window.addEventListener(event, handleActivity, { passive: true })
        )

        // Iniciar timers al montar
        resetTimers()

        // Cleanup al desmontar
        return () => {
            ACTIVITY_EVENTS.forEach((event) =>
                window.removeEventListener(event, handleActivity)
            )
            clearTimeout(warningTimerRef.current)
            clearTimeout(logoutTimerRef.current)
            clearInterval(countdownTimerRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Solo al montar — resetTimers es estable gracias a useCallback

    return {
        showWarning,
        secondsLeft,
        extendSession,
        forceLogout,
    }
}
