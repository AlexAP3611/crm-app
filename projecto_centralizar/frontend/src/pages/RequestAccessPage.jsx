import { useState } from 'react'
import { api } from '../api/client'

export default function RequestAccessPage({ onNavigateLogin }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await api.requestAccess(email, password)
            setSubmitted(true)
        } catch (err) {
            setError(err.message || 'Error al enviar la solicitud')
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-card-header">
                        <div className="sidebar-logo" style={{ marginBottom: '0.5rem', justifyContent: 'center' }}>CRM<span>.</span></div>
                    </div>
                    <div className="request-success">
                        <div className="request-success-icon">✉️</div>
                        <h2 className="request-success-title">Solicitud enviada</h2>
                        <p className="request-success-text">
                            Tu solicitud de acceso ha sido enviada correctamente.<br />
                            <strong>Pendiente de aprobación.</strong>
                        </p>
                        <p className="request-success-hint">
                            Recibirás una notificación cuando un administrador apruebe tu solicitud.
                        </p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                        onClick={onNavigateLogin}
                    >
                        Volver al inicio de sesión
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-card-header">
                    <div className="sidebar-logo" style={{ marginBottom: '0.5rem', justifyContent: 'center' }}>CRM<span>.</span></div>
                    <h2 className="auth-title">Solicitar acceso</h2>
                    <p className="auth-subtitle">Completa el formulario para solicitar una cuenta</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group full">
                        <label className="form-label">Email</label>
                        <input
                            id="request-email"
                            type="email"
                            className="form-control"
                            placeholder="tu@email.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="form-group full">
                        <label className="form-label">Contraseña</label>
                        <input
                            id="request-password"
                            type="password"
                            className="form-control"
                            placeholder="••••••••"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <span className="form-helper-text">Mínimo 6 caracteres</span>
                    </div>

                    <button
                        id="request-submit-btn"
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ width: '100%', justifyContent: 'center' }}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span>
                                Enviando...
                            </>
                        ) : 'Enviar solicitud'}
                    </button>
                </form>

                <div className="auth-footer">
                    <span className="text-muted">¿Ya tienes una cuenta?</span>
                    <button className="auth-link" onClick={onNavigateLogin}>
                        Iniciar sesión
                    </button>
                </div>
            </div>
        </div>
    )
}
