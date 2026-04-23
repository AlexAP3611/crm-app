/**
 * SessionTimeoutModal — Modal de advertencia de inactividad.
 *
 * Se muestra cuando el usuario lleva 25 minutos sin actividad.
 * Ofrece dos acciones:
 *   - Continuar sesión → renueva el token JWT
 *   - Cerrar sesión    → logout inmediato
 *
 * El diseño sigue el sistema "Architectural Ledger" del CRM
 * (mismos tokens de color, tipografía y border-radius).
 *
 * Props:
 * @param {number}   secondsLeft  - Segundos restantes hasta el logout automático
 * @param {Function} onExtend     - Callback para renovar la sesión
 * @param {Function} onLogout     - Callback para cerrar sesión
 * @param {boolean}  extending    - True mientras se está renovando (muestra spinner)
 */

export default function SessionTimeoutModal({ secondsLeft, onExtend, onLogout, extending }) {
    // Convertir segundos a mm:ss
    const minutes = Math.floor(Math.max(0, secondsLeft) / 60)
    const seconds = Math.max(0, secondsLeft) % 60
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

    // El porcentaje de la barra de progreso (decrece con el tiempo)
    const totalSeconds = 5 * 60 // 5 minutos = 300 segundos
    const pct = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100))

    // Color de la barra según urgencia
    const barColor = secondsLeft > 120
        ? '#006877'   // primary (cyan oscuro)
        : secondsLeft > 60
            ? '#e97c1a'  // naranja
            : '#ba1a1a'  // error (rojo)

    return (
        <>
            {/* Backdrop con blur */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    backgroundColor: 'rgba(27, 28, 28, 0.55)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                    animation: 'sessionFadeIn 0.25s ease-out',
                }}
            >
                {/* Panel del modal */}
                <div
                    style={{
                        background: '#ffffff',
                        borderRadius: '1.5rem',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                        width: '100%',
                        maxWidth: '420px',
                        overflow: 'hidden',
                        animation: 'sessionSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                >
                    {/* Barra de progreso en la parte superior */}
                    <div style={{ height: '4px', background: '#f0eded', position: 'relative' }}>
                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                height: '100%',
                                width: `${pct}%`,
                                background: barColor,
                                transition: 'width 1s linear, background 0.5s ease',
                                borderRadius: '0 2px 2px 0',
                            }}
                        />
                    </div>

                    {/* Contenido */}
                    <div style={{ padding: '2rem' }}>
                        {/* Icono + Título */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
                            {/* Icono pulsante */}
                            <div
                                style={{
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    background: 'rgba(0,104,119,0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    animation: 'sessionPulse 2s ease-in-out infinite',
                                }}
                            >
                                <span
                                    className="material-symbols-outlined"
                                    style={{ color: '#006877', fontSize: '22px' }}
                                >
                                    schedule
                                </span>
                            </div>
                            <div>
                                <h2
                                    style={{
                                        margin: 0,
                                        fontFamily: '"Plus Jakarta Sans", sans-serif',
                                        fontSize: '1.125rem',
                                        fontWeight: 800,
                                        color: '#1b1c1c',
                                        lineHeight: 1.3,
                                    }}
                                >
                                    Tu sesión va a expirar
                                </h2>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#5f5e5e' }}>
                                    Por inactividad
                                </p>
                            </div>
                        </div>

                        {/* Mensaje */}
                        <p
                            style={{
                                margin: '0 0 1.5rem',
                                fontSize: '0.875rem',
                                color: '#3c494c',
                                lineHeight: 1.6,
                            }}
                        >
                            No hemos detectado actividad en los últimos 25 minutos. La sesión se cerrará automáticamente en:
                        </p>

                        {/* Countdown */}
                        <div
                            style={{
                                textAlign: 'center',
                                margin: '0 0 1.75rem',
                                padding: '1rem',
                                background: pct > 40 ? 'rgba(0,104,119,0.06)' : 'rgba(186,26,26,0.06)',
                                borderRadius: '0.75rem',
                                border: `1px solid ${pct > 40 ? 'rgba(0,104,119,0.12)' : 'rgba(186,26,26,0.12)'}`,
                                transition: 'background 0.5s, border-color 0.5s',
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                                    fontSize: '2.25rem',
                                    fontWeight: 800,
                                    color: barColor,
                                    letterSpacing: '0.05em',
                                    fontVariantNumeric: 'tabular-nums',
                                    transition: 'color 0.5s',
                                    fontFeatureSettings: '"tnum"',
                                }}
                            >
                                {timeStr}
                            </span>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#5f5e5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                minutos restantes
                            </p>
                        </div>

                        {/* Botones */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Continuar sesión — primario */}
                            <button
                                id="session-extend-btn"
                                onClick={onExtend}
                                disabled={extending}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    width: '100%',
                                    padding: '0.875rem 1.5rem',
                                    background: extending
                                        ? '#bbc9cc'
                                        : 'linear-gradient(135deg, #006877 0%, #00bbd4 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '0.75rem',
                                    fontFamily: '"Inter", sans-serif',
                                    fontWeight: 700,
                                    fontSize: '0.9375rem',
                                    cursor: extending ? 'not-allowed' : 'pointer',
                                    transition: 'opacity 0.15s, transform 0.1s',
                                    boxShadow: extending ? 'none' : '0 4px 14px rgba(0,104,119,0.30)',
                                }}
                                onMouseEnter={(e) => { if (!extending) e.currentTarget.style.opacity = '0.9' }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                                onMouseDown={(e) => { if (!extending) e.currentTarget.style.transform = 'scale(0.98)' }}
                                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                            >
                                {extending ? (
                                    <>
                                        <span style={{
                                            width: 16, height: 16,
                                            borderRadius: '50%',
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            borderTopColor: '#fff',
                                            animation: 'sessionSpin 0.7s linear infinite',
                                            display: 'inline-block',
                                        }} />
                                        Renovando sesión…
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                            refresh
                                        </span>
                                        Continuar sesión
                                    </>
                                )}
                            </button>

                            {/* Cerrar sesión — secundario */}
                            <button
                                id="session-logout-btn"
                                onClick={onLogout}
                                disabled={extending}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    width: '100%',
                                    padding: '0.75rem 1.5rem',
                                    background: 'transparent',
                                    color: '#ba1a1a',
                                    border: '1px solid rgba(186,26,26,0.25)',
                                    borderRadius: '0.75rem',
                                    fontFamily: '"Inter", sans-serif',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: extending ? 'not-allowed' : 'pointer',
                                    opacity: extending ? 0.5 : 1,
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => { if (!extending) e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                    logout
                                </span>
                                Cerrar sesión ahora
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Keyframes para animaciones del modal */}
            <style>{`
                @keyframes sessionFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes sessionSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)    scale(1);    }
                }
                @keyframes sessionPulse {
                    0%, 100% { transform: scale(1);    opacity: 1;    }
                    50%       { transform: scale(1.08); opacity: 0.75; }
                }
                @keyframes sessionSpin {
                    from { transform: rotate(0deg);   }
                    to   { transform: rotate(360deg); }
                }
            `}</style>
        </>
    )
}
