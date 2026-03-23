import { useState } from 'react'
import { api } from '../api/client'

export default function Login({ onLoginComplete }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await api.login(email, password)
            onLoginComplete()
        } catch (err) {
            setError(err.message || 'Error de inicio de sesión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--color-bg)', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ padding: '2rem', maxWidth: '400px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div className="sidebar-logo" style={{ marginBottom: '1rem', justifyContent: 'center' }}>CRM<span>.</span></div>
                    <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text)' }}>Iniciar Sesión</h2>
                </div>
                
                {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group full">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-control"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    
                    <div className="form-group full" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Contraseña</label>
                        <input
                            type="password"
                            className="form-control"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
                        {loading ? 'Iniciando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    )
}
