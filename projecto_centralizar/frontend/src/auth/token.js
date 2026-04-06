/**
 * Token Utils — Decodificación de JWT en el frontend.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  IMPORTANTE: SEGURIDAD FRONTEND vs BACKEND                     │
 * │                                                                 │
 * │  La decodificación del JWT en el frontend es SOLO para UX:     │
 * │  - Mostrar/ocultar elementos del menú según el rol             │
 * │  - Redirigir a páginas apropiadas para el rol del usuario      │
 * │                                                                 │
 * │  La seguridad REAL está en el BACKEND:                          │
 * │  - El backend SIEMPRE verifica el JWT con la clave secreta     │
 * │  - El backend SIEMPRE verifica el rol antes de ejecutar        │
 * │  - Un usuario malicioso puede manipular el frontend, pero      │
 * │    el backend rechazará cualquier petición no autorizada (403) │
 * │                                                                 │
 * │  Resumen: el frontend "esconde" botones, el backend "bloquea"  │
 * │  acciones. Ambos son necesarios para una buena experiencia.    │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ¿Cómo funciona la decodificación?
 * Un JWT tiene tres partes separadas por puntos: header.payload.signature
 * El payload es un JSON codificado en Base64URL. Podemos leerlo sin
 * necesidad de la clave secreta (no verificamos la firma — eso lo
 * hace el backend). Solo extraemos los datos para uso visual.
 */

import { getToken } from '../api/client'


/**
 * Decodifica el payload de un JWT sin verificar la firma.
 *
 * Estructura del JWT: <header>.<payload>.<signature>
 * - header:    {"alg":"HS256","typ":"JWT"} → no nos interesa
 * - payload:   {"sub":"1","email":"..","role":"admin","exp":...} → lo que extraemos
 * - signature: firma HMAC del servidor → no podemos verificarla (ni debemos)
 *
 * @param {string} token - Token JWT completo
 * @returns {Object|null} Payload decodificado o null si el token es inválido
 */
export function decodeJwtPayload(token) {
    try {
        // Separar las 3 partes del JWT
        const parts = token.split('.')
        if (parts.length !== 3) return null

        // El payload es la segunda parte (índice 1)
        // Está codificado en Base64URL (variante de Base64 sin padding)
        const payload = parts[1]

        // Base64URL → Base64 estándar:
        // - Reemplazar '-' por '+' y '_' por '/'
        // - Añadir padding '=' si es necesario
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')

        // Decodificar Base64 → string JSON → objeto JavaScript
        const jsonStr = atob(base64)
        return JSON.parse(jsonStr)
    } catch (e) {
        // Si el token no es un JWT válido (mal formado, etc.)
        console.warn('[auth] No se pudo decodificar el JWT:', e.message)
        return null
    }
}


/**
 * Obtiene el rol del usuario actual desde el JWT almacenado.
 *
 * Flujo:
 * 1. Lee el token de localStorage (getToken)
 * 2. Decodifica el payload del JWT
 * 3. Extrae el campo "role" del payload
 *
 * @returns {string|null} Rol del usuario ('admin' | 'gestor') o null
 */
export function getUserRole() {
    const token = getToken()
    if (!token) return null

    const payload = decodeJwtPayload(token)
    return payload?.role ?? null
}


/**
 * Obtiene toda la información del usuario desde el JWT almacenado.
 *
 * @returns {Object|null} Datos del usuario { id, email, role } o null
 */
export function getUserFromToken() {
    const token = getToken()
    if (!token) return null

    const payload = decodeJwtPayload(token)
    if (!payload) return null

    return {
        id: payload.sub ? parseInt(payload.sub, 10) : null,
        email: payload.email ?? null,
        role: payload.role ?? null,
    }
}


/**
 * Verifica si el token ha expirado (basándose en el claim "exp").
 *
 * NOTA: Esta verificación es solo orientativa para la UX.
 * El backend SIEMPRE verifica la expiración de forma autoritativa.
 *
 * @returns {boolean} true si el token ha expirado o no existe
 */
export function isTokenExpired() {
    const token = getToken()
    if (!token) return true

    const payload = decodeJwtPayload(token)
    if (!payload?.exp) return true

    // "exp" es un timestamp en segundos (estándar JWT)
    // Date.now() devuelve millisegundos, por eso dividimos entre 1000
    return Date.now() / 1000 > payload.exp
}
