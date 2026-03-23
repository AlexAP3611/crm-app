import { useState, useEffect, useRef } from 'react'

const AVAILABLE_APPS = ['Apollo', 'Clay', 'Adscore']

function WebhookRow({ integration, onChange, onRemove }) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 1fr auto',
            gap: '12px',
            alignItems: 'center',
            padding: '14px 16px',
            background: '#f1f5f9',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
        }}>
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                {integration.nombre_aplicacion}
            </span>
            <input
                className="form-control"
                type="text"
                placeholder="https://example.com/webhook"
                value={integration.webhook}
                onChange={e => onChange('webhook', e.target.value)}
            />
            <input
                className="form-control"
                type="password"
                placeholder="API Key"
                value={integration.api_key}
                onChange={e => onChange('api_key', e.target.value)}
            />
            <button
                type="button"
                title="Eliminar integración"
                onClick={onRemove}
                style={{
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    padding: '6px 10px',
                    fontSize: '1rem',
                    lineHeight: 1,
                    transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#e53e3e'; e.currentTarget.style.borderColor = '#e53e3e' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
            >
                ×
            </button>
        </div>
    )
}

export default function SettingsPage() {
    const [affinoKey, setAffinoKey] = useState('')
    const [savingApis, setSavingApis] = useState(false)

    // CRM API key
    const [crmApiKey, setCrmApiKey] = useState('')
    const [copied, setCopied] = useState(false)

    // Dynamic integrations: [{ nombre_aplicacion, webhook, api_key }]
    const [integrations, setIntegrations] = useState([])
    const [savingWebhooks, setSavingWebhooks] = useState(false)

    // Dropdown state
    const [showAppPicker, setShowAppPicker] = useState(false)
    const pickerRef = useRef(null)

    // Load from backend on mount
    useEffect(() => {
        const storedAffino = localStorage.getItem('affino_api_key')
        if (storedAffino) setAffinoKey(storedAffino)

        const stored = localStorage.getItem('webhooks_integrations')
        if (stored) {
            try { setIntegrations(JSON.parse(stored)) } catch (e) { /* ignore */ }
        }

        // Fetch persistent API key from backend
        fetch('/api/system/api-key', { credentials: 'include' })
            .then(res => { if (res.ok) return res.json(); return null; })
            .then(data => { if (data && data.api_key) setCrmApiKey(data.api_key); })
            .catch(err => console.error("Could not fetch API key:", err));
    }, [])

    // Close picker on outside click
    useEffect(() => {
        function handle(e) {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                setShowAppPicker(false)
            }
        }
        document.addEventListener('mousedown', handle)
        return () => document.removeEventListener('mousedown', handle)
    }, [])

    const handleSaveApis = () => {
        setSavingApis(true)
        setTimeout(() => {
            localStorage.setItem('affino_api_key', affinoKey)
            setSavingApis(false)
            alert('Configuración de APIs guardada')
        }, 500)
    }

    const generateApiKey = async () => {
        try {
            const res = await fetch('/api/system/api-key', { method: 'POST', credentials: 'include' })
            if (res.ok) {
                const data = await res.json()
                if (data.api_key) {
                    setCrmApiKey(data.api_key)
                    setCopied(false)
                }
            }
        } catch (e) {
            console.error("Failed to generate crm api key", e)
        }
    }

    const handleCopyKey = () => {
        navigator.clipboard.writeText(crmApiKey).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const handleSaveWebhooks = () => {
        setSavingWebhooks(true)
        setTimeout(() => {
            localStorage.setItem('webhooks_integrations', JSON.stringify(integrations))
            setSavingWebhooks(false)
            alert('Configuración de Webhooks guardada')
        }, 500)
    }

    const addIntegration = (appName) => {
        setIntegrations(prev => [...prev, { nombre_aplicacion: appName, webhook: '', api_key: '' }])
        setShowAppPicker(false)
    }

    const removeIntegration = (index) => {
        setIntegrations(prev => prev.filter((_, i) => i !== index))
    }

    const updateIntegration = (index, field, value) => {
        setIntegrations(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ))
    }

    const usedApps = integrations.map(i => i.nombre_aplicacion)
    const availableToAdd = AVAILABLE_APPS.filter(a => !usedApps.includes(a))

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div className="page-title-wrap">
                <h1 className="page-title">APIs y Webhooks</h1>
            </div>

            {/* SECCIÓN 1: APIs */}
            <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--color-text)' }}>APIs</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
                    Configuración de claves API utilizadas por herramientas externas.
                </p>

                <div className="form-group full" style={{ marginBottom: '24px' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Servicio</label>
                    <input className="form-control" value="Affino" disabled style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }} />
                </div>

                <div className="form-group full" style={{ marginBottom: '24px' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>API Key</label>
                    <input
                        type="password"
                        className="form-control"
                        value={affinoKey}
                        onChange={(e) => setAffinoKey(e.target.value)}
                        placeholder="Introduce la API key de Affino"
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                    <button className="btn btn-primary" onClick={handleSaveApis} disabled={savingApis}>
                        {savingApis ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* SECCIÓN 1b: API Key del CRM */}
            <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--color-text)' }}>API Key del CRM</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
                    Genera una API key para que aplicaciones externas accedan a este CRM.
                </p>

                {crmApiKey ? (
                    <>
                        <div className="form-group full" style={{ marginBottom: '16px' }}>
                            <label className="form-label" style={{ fontWeight: 600 }}>Tu API Key</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    className="form-control"
                                    type="text"
                                    readOnly
                                    value={crmApiKey}
                                    style={{
                                        flex: 1,
                                        fontFamily: 'monospace',
                                        fontSize: '0.8125rem',
                                        color: 'var(--color-text)',
                                        background: '#f1f5f9',
                                        cursor: 'text',
                                    }}
                                />
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleCopyKey}
                                    style={{ whiteSpace: 'nowrap', minWidth: 90 }}
                                >
                                    {copied ? '✓ Copiado' : 'Copiar'}
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                        	<button 
                        	       	className="btn btn-secondary"
                        	        onClick={() => {
                        	            if (window.confirm('¿Regenerar la API key? La clave anterior dejará de funcionar.')) {
                        	                generateApiKey()
                        	            }
                        	        }}
                        	    >
                                🔄 Regenerar API Key
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                        <button className="btn btn-primary" onClick={() => generateApiKey()}>
                            Generar API Key
                        </button>
                    </div>
                )}
            </div>

            {/* SECCIÓN 2: Webhooks */}
            <div className="card" style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', margin: 0, color: 'var(--color-text)' }}>Webhooks</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px', fontSize: '0.9rem', marginTop: '8px' }}>
                    Configura las integraciones con aplicaciones externas mediante webhooks y API keys.
                </p>

                {/* Column headers — only shown when there are rows */}
                {integrations.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 1fr 1fr auto',
                        gap: '12px',
                        padding: '0 16px 8px',
                        marginBottom: '4px',
                    }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aplicación</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Webhook URL</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Key</span>
                        <span />
                    </div>
                )}

                {/* Integration rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: integrations.length > 0 ? '20px' : '0' }}>
                    {integrations.map((integration, idx) => (
                        <WebhookRow
                            key={integration.nombre_aplicacion}
                            integration={integration}
                            onChange={(field, value) => updateIntegration(idx, field, value)}
                            onRemove={() => removeIntegration(idx)}
                        />
                    ))}
                </div>

                {/* Empty state */}
                {integrations.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '32px 16px',
                        borderRadius: 8,
                        border: '2px dashed var(--color-border)',
                        color: 'var(--color-text-muted)',
                        fontSize: '0.9375rem',
                        marginBottom: '20px',
                        fontStyle: 'italic',
                    }}>
                        No hay integraciones configuradas.
                    </div>
                )}

                {/* Footer: add button + save */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ position: 'relative' }} ref={pickerRef}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowAppPicker(v => !v)}
                            disabled={availableToAdd.length === 0}
                            title={availableToAdd.length === 0 ? 'Todas las aplicaciones ya están añadidas' : undefined}
                        >
                            + Añadir integración
                        </button>

                        {showAppPicker && (
                            <div style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 6px)',
                                left: 0,
                                background: '#ffffff',
                                border: '1px solid var(--color-border)',
                                borderRadius: 8,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                minWidth: 180,
                                zIndex: 100,
                                overflow: 'hidden',
                            }}>
                                {availableToAdd.map((app, i) => (
                                    <button
                                        key={app}
                                        type="button"
                                        onClick={() => addIntegration(app)}
                                        style={{
                                            display: 'block',
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 16px',
                                            background: 'none',
                                            border: 'none',
                                            borderBottom: i < availableToAdd.length - 1 ? '1px solid var(--color-border)' : 'none',
                                            cursor: 'pointer',
                                            color: '#111827',
                                            fontSize: '0.9375rem',
                                            transition: 'background 0.1s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    >
                                        {app}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handleSaveWebhooks}
                        disabled={savingWebhooks || integrations.length === 0}
                    >
                        {savingWebhooks ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
