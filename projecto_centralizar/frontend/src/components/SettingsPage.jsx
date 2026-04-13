import { useState, useEffect } from 'react'

/* ──────────────────────────────────────────────────────────
   Service definitions — each card in External Connectivity
   ────────────────────────────────────────────────────────── */
const SERVICES = [
    {
        id: 'affino',
        name: 'Affino',
        icon: 'hub',                  // background watermark icon
        defaultAuth: 'Bearer Token',
        placeholder: 'Introduce la API Key de Affino',
    },
    {
        id: 'apollo',
        name: 'Apollo',
        icon: 'rocket_launch',
        defaultAuth: 'OAuth2',
        placeholder: 'Introduce la API Key de Apollo',
    },
    {
        id: 'clay',
        name: 'Clay',
        icon: 'layers',
        defaultAuth: 'Bearer Token',
        placeholder: 'Introduce la API Key de Clay',
    },
    {
        id: 'adscore',
        name: 'Adscore',
        icon: 'verified_user',
        defaultAuth: 'Basic Auth',
        placeholder: 'Introduce la API Key de Adscore',
    },
]

const AUTH_TYPES = ['Ninguno', 'Bearer Token', 'Basic Auth', 'OAuth2']

/* ──────────────────────────────────────────────────────────
   AuthFields — Dynamic fields rendered per auth method
   ────────────────────────────────────────────────────────── */
function AuthFields({ authType, config, onChange }) {
    const [showToken, setShowToken] = useState(false)
    const [showSecret, setShowSecret] = useState(false)

    const field = (key, value) => onChange({ ...config, [key]: value })

    // Shared input style
    const inputCls =
        'w-full bg-white border border-stone-200 rounded-lg px-4 py-3 text-sm ' +
        'focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600/30 transition-all ' +
        'outline-none placeholder:text-stone-400'

    const labelCls =
        'block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2'

    /* ── Bearer Token ── */
    if (authType === 'Bearer Token') {
        return (
            <div className="space-y-4">
                <div>
                    <label className={labelCls}>Token de acceso</label>
                    <div className="relative">
                        <input
                            className={inputCls + ' pr-11'}
                            type={showToken ? 'text' : 'password'}
                            placeholder="Pega aquí tu Bearer Token"
                            value={config.token || ''}
                            onChange={(e) => field('token', e.target.value)}
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                            onClick={() => setShowToken((v) => !v)}
                            title={showToken ? 'Ocultar' : 'Mostrar'}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {showToken ? 'visibility_off' : 'visibility'}
                            </span>
                        </button>
                    </div>
                    <p className="mt-2 text-[11px] text-stone-400">
                        Se enviará como <code className="bg-stone-100 px-1 rounded text-stone-600">Authorization: Bearer &lt;token&gt;</code>
                    </p>
                </div>
            </div>
        )
    }

    /* ── Basic Auth ── */
    if (authType === 'Basic Auth') {
        return (
            <div className="space-y-4">
                <div>
                    <label className={labelCls}>Usuario</label>
                    <input
                        className={inputCls}
                        type="text"
                        placeholder="Nombre de usuario"
                        value={config.username || ''}
                        onChange={(e) => field('username', e.target.value)}
                    />
                </div>
                <div>
                    <label className={labelCls}>Contraseña</label>
                    <div className="relative">
                        <input
                            className={inputCls + ' pr-11'}
                            type={showSecret ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={config.password || ''}
                            onChange={(e) => field('password', e.target.value)}
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                            onClick={() => setShowSecret((v) => !v)}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {showSecret ? 'visibility_off' : 'visibility'}
                            </span>
                        </button>
                    </div>
                    <p className="mt-2 text-[11px] text-stone-400">
                        Se enviará como <code className="bg-stone-100 px-1 rounded text-stone-600">Authorization: Basic &lt;base64&gt;</code>
                    </p>
                </div>
            </div>
        )
    }

    /* ── OAuth2 ── */
    if (authType === 'OAuth2') {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Client ID</label>
                        <input
                            className={inputCls}
                            type="text"
                            placeholder="client_id"
                            value={config.clientId || ''}
                            onChange={(e) => field('clientId', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Client Secret</label>
                        <div className="relative">
                            <input
                                className={inputCls + ' pr-11'}
                                type={showSecret ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={config.clientSecret || ''}
                                onChange={(e) => field('clientSecret', e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                                onClick={() => setShowSecret((v) => !v)}
                            >
                                <span className="material-symbols-outlined text-lg">
                                    {showSecret ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Token URL</label>
                    <input
                        className={inputCls}
                        type="url"
                        placeholder="https://api.example.com/oauth/token"
                        value={config.tokenUrl || ''}
                        onChange={(e) => field('tokenUrl', e.target.value)}
                    />
                    <p className="mt-2 text-[11px] text-stone-400">
                        Endpoint al que se hará POST para obtener el access token.
                    </p>
                </div>
            </div>
        )
    }

    return null
}

/* ──────────────────────────────────────────────────────────
   ServiceCard — A single integration tile
   ────────────────────────────────────────────────────────── */
function ServiceCard({ service, config, onChange, onTestConnection }) {
    const authType = config.authType || service.defaultAuth

    const handleAuthType = (newType) => {
        // Reset auth-specific fields when switching auth type, keep other fields
        const { token, username, password, clientId, clientSecret, tokenUrl, ...rest } = config
        onChange(service.id, { ...rest, authType: newType })
    }

    const handleAuthFields = (updatedConfig) => {
        onChange(service.id, updatedConfig)
    }

    return (
        <div className="bg-surface-container-low rounded-xl p-8 relative overflow-hidden flex flex-col border border-outline-variant/30">
            {/* Watermark icon */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.04] pointer-events-none">
                <span className="material-symbols-outlined" style={{ fontSize: '5rem' }}>
                    {service.icon}
                </span>
            </div>

            {/* Service header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm border border-stone-100">
                    <span className="material-symbols-outlined text-2xl text-cyan-700">{service.icon}</span>
                </div>
                <h3 className="text-xl font-bold font-headline text-stone-900 tracking-tight">{service.name}</h3>
            </div>

            {/* Form fields */}
            <div className="space-y-6 flex-1">
                {/* API Key / URL del servicio */}
                <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">
                        Clave API del Servicio
                    </label>
                    <input
                        className="w-full bg-white border border-stone-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600/30 transition-all outline-none placeholder:text-stone-400"
                        type="text"
                        placeholder={service.placeholder}
                        value={config.apiKey || ''}
                        onChange={(e) => handleAuthFields({ ...config, apiKey: e.target.value })}
                    />
                </div>

                {/* Auth Type selector */}
                <div>
                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-2">
                        Tipo de Autenticación
                    </label>
                    <select
                        className="w-full bg-white border border-stone-200 rounded-lg px-4 py-3 text-sm focus:ring-0 outline-none appearance-none cursor-pointer"
                        value={authType}
                        onChange={(e) => handleAuthType(e.target.value)}
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236b7280' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 12px center',
                            paddingRight: '36px',
                        }}
                    >
                        {AUTH_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {/* Dynamic fields — change with auth type */}
                <div
                    key={authType}
                    style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
                >
                    <AuthFields
                        authType={authType}
                        config={config}
                        onChange={handleAuthFields}
                    />
                </div>
            </div>

            {/* Test Connection */}
            <div className="mt-8 flex justify-end">
                <button
                    className="text-cyan-700 font-bold text-sm px-4 py-2 hover:bg-white rounded-lg transition-colors active:scale-95"
                    onClick={() => onTestConnection(service.id)}
                >
                    Probar Conexión
                </button>
            </div>
        </div>
    )
}

/* ──────────────────────────────────────────────────────────
   Main Page Component — APIs & Webhooks
   ────────────────────────────────────────────────────────── */
export default function SettingsPage() {
    // Prisma CRM API Key state
    const [crmApiKey, setCrmApiKey] = useState('')
    const [copied, setCopied] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [lastRotated, setLastRotated] = useState('')

    // External service configs
    const [serviceConfigs, setServiceConfigs] = useState({})
    const [testingService, setTestingService] = useState(null)
    const [testResult, setTestResult] = useState(null)

    // Load persisted data
    useEffect(() => {
        // Fetch CRM API key from backend
        fetch('/api/system/api-key', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && data.api_key) {
                    setCrmApiKey(data.api_key)
                    setLastRotated(data.rotated_at || '')
                }
            })
            .catch((err) => console.error('Could not fetch API key:', err))

        // Load service configs from localStorage
        const stored = localStorage.getItem('external_service_configs')
        if (stored) {
            try {
                setServiceConfigs(JSON.parse(stored))
            } catch (e) { /* ignore */ }
        }
    }, [])

    // Persist service configs on change
    useEffect(() => {
        if (Object.keys(serviceConfigs).length > 0) {
            localStorage.setItem('external_service_configs', JSON.stringify(serviceConfigs))
        }
    }, [serviceConfigs])

    const handleCopyKey = () => {
        if (!crmApiKey) return
        navigator.clipboard.writeText(crmApiKey).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const generateApiKey = async () => {
        setGenerating(true)
        try {
            const res = await fetch('/api/system/api-key', { method: 'POST', credentials: 'include' })
            if (res.ok) {
                const data = await res.json()
                if (data.api_key) {
                    setCrmApiKey(data.api_key)
                    setCopied(false)
                    setLastRotated(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }))
                }
            }
        } catch (e) {
            console.error('Failed to generate CRM API key', e)
        } finally {
            setGenerating(false)
        }
    }

    const handleServiceChange = (serviceId, config) => {
        setServiceConfigs((prev) => ({ ...prev, [serviceId]: config }))
    }

    const handleTestConnection = async (serviceId) => {
        setTestingService(serviceId)
        setTestResult(null)
        // Simulate connection test
        setTimeout(() => {
            setTestResult({ serviceId, success: true })
            setTestingService(null)
            setTimeout(() => setTestResult(null), 3000)
        }, 1500)
    }

    // Count active services (those with an API key)
    const activeServices = SERVICES.filter(
        (s) => serviceConfigs[s.id]?.apiKey?.trim()
    ).length

    return (
        <div className="p-8 pb-20 w-full">
            {/* ─── Hero Section ─── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">
                        APIs &amp; Webhooks
                    </h2>
                    <p className="text-on-surface-variant font-medium">
                        Gestiona tus tokens de acceso globales y las conexiones con servicios externos.
                    </p>
                </div>
            </div>

            {/* ─── Section 1: Prisma API Key ─── */}
            <section className="mb-24">
                <div className="bg-stone-50 rounded-xl p-1">
                    <div className="bg-white rounded-lg p-8 md:p-12 shadow-sm border border-stone-100">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-4">
                                    Clave API de Prisma
                                </label>
                                <div className="relative group">
                                    <input
                                        id="prisma-api-key"
                                        className="w-full bg-stone-50 border-none rounded-lg px-6 py-4 font-mono text-cyan-700 text-sm focus:ring-0 outline-none"
                                        type="text"
                                        readOnly
                                        value={crmApiKey || 'Aún no se ha generado ninguna clave'}
                                        style={!crmApiKey ? { color: '#9ca3af', fontFamily: 'Inter, sans-serif', fontStyle: 'italic' } : {}}
                                    />
                                    {crmApiKey && (
                                        <button
                                            id="copy-api-key"
                                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-stone-200 rounded-md transition-colors"
                                            onClick={handleCopyKey}
                                            title="Copiar API Key"
                                        >
                                            <span className="material-symbols-outlined text-stone-400">
                                                {copied ? 'check' : 'content_copy'}
                                            </span>
                                        </button>
                                    )}
                                </div>
                                <p className="mt-4 text-xs text-stone-400">
                                    {lastRotated
                                        ? `Última rotación: ${lastRotated}. Mantén esta clave confidencial.`
                                        : 'Mantén esta clave confidencial.'}
                                </p>
                            </div>
                            <div className="shrink-0">
                                <button
                                    id="generate-new-key"
                                    className="btn-primary-gradient text-white px-8 py-4 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={() => {
                                        if (crmApiKey) {
                                            if (window.confirm('¿Regenerar la API key? La clave anterior dejará de funcionar.')) {
                                                generateApiKey()
                                            }
                                        } else {
                                            generateApiKey()
                                        }
                                    }}
                                    disabled={generating}
                                >
                                    {generating ? (
                                        <span className="flex items-center gap-2">
                                            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                            Generando…
                                        </span>
                                    ) : (
                                        'Generar Nueva Clave'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Section 2: External Connectivity ─── */}
            <section>
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-2xl font-bold font-headline tracking-tight text-stone-900">Conectividad Externa</h2>
                    <div className="flex items-center gap-2 text-stone-500 text-xs font-semibold">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: activeServices > 0 ? '#10b981' : '#9ca3af' }}
                        />
                        {activeServices} {activeServices === 1 ? 'Servicio Activo' : 'Servicios Activos'}
                    </div>
                </div>

                {/* Integration Bento Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {SERVICES.map((service) => (
                        <ServiceCard
                            key={service.id}
                            service={service}
                            config={serviceConfigs[service.id] || {}}
                            onChange={handleServiceChange}
                            onTestConnection={handleTestConnection}
                        />
                    ))}
                </div>

                {/* Connection test feedback toast */}
                {(testingService || testResult) && (
                    <div
                        className="fixed bottom-8 right-8 z-50 bg-white rounded-xl shadow-xl border border-stone-200 px-6 py-4 flex items-center gap-3 animate-in"
                        style={{
                            animation: 'slideUp 0.3s ease-out',
                        }}
                    >
                        {testingService && (
                            <>
                                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                                <span className="text-sm font-medium text-stone-700">
                                    Probando {SERVICES.find((s) => s.id === testingService)?.name}…
                                </span>
                            </>
                        )}
                        {testResult && (
                            <>
                                <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                                <span className="text-sm font-medium text-stone-700">
                                    {SERVICES.find((s) => s.id === testResult.serviceId)?.name}: Conexión exitosa
                                </span>
                            </>
                        )}
                    </div>
                )}
            </section>

            {/* Bottom spacer */}
            <div className="h-24" />

            {/* Inline keyframes */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
