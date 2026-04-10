import { useState, useEffect, useRef } from 'react'

const AVAILABLE_APPS = ['Apollo', 'Clay', 'Adscore']

function WebhookRow({ integration, onChange, onRemove }) {
    return (
        <div className="p-6 rounded-xl border border-outline-variant/20 bg-surface-container-low hover:shadow-md transition-all relative group">
            <button
                type="button"
                onClick={onRemove}
                title="Eliminar integración"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-lowest border border-outline-variant/10 text-on-surface-variant flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-error hover:border-error/30 transition-all"
            >
                <span className="material-symbols-outlined text-sm">delete</span>
            </button>
            <div className="flex justify-between items-start mb-4 pr-10">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary-container"></div>
                    <h3 className="font-bold text-on-surface text-lg">{integration.nombre_aplicacion}</h3>
                </div>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 block">Webhook URL</label>
                    <input
                        className="w-full bg-white/50 border border-outline-variant/20 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                        type="text"
                        placeholder="https://example.com/webhook"
                        value={integration.webhook}
                        onChange={e => onChange('webhook', e.target.value)}
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 block">Autenticación</label>
                        <select
                            className="w-full bg-white/50 border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                            value={integration.auth_type || 'Ninguno'}
                            onChange={e => onChange('auth_type', e.target.value)}
                        >
                            <option value="Ninguno">Ninguno</option>
                            <option value="BasicAuth">BasicAuth</option>
                            <option value="HeaderAuth">HeaderAuth</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 block">API Key</label>
                        <input
                            className={`w-full border rounded-lg px-3 py-2 text-sm font-mono transition-all ${
                                !integration.auth_type || integration.auth_type === 'Ninguno'
                                    ? 'bg-surface-container border-outline-variant/10 text-on-surface-variant/40 cursor-not-allowed'
                                    : 'bg-white/50 border-outline-variant/20 focus:ring-2 focus:ring-primary/20 focus:border-primary/30'
                            }`}
                            type="password"
                            placeholder="API Key"
                            value={integration.api_key}
                            disabled={!integration.auth_type || integration.auth_type === 'Ninguno'}
                            onChange={e => onChange('api_key', e.target.value)}
                        />
                    </div>
                </div>
            </div>
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-outline-variant/10">
                <span className="px-2 py-1 bg-surface-container-highest text-[10px] font-bold rounded uppercase">sync.active</span>
                <span className="px-2 py-1 bg-surface-container-highest text-[10px] font-bold rounded uppercase">data.updated</span>
            </div>
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
        if (!crmApiKey) return;
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
        setIntegrations(prev => [...prev, { nombre_aplicacion: appName, webhook: '', api_key: '', auth_type: 'Ninguno' }])
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
        <div className="pt-8 px-10 pb-12">
            {/* Hero Section */}
            <div className="mb-12">
                <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tighter text-on-surface mb-4">Developer Hub</h1>
                <p className="text-secondary max-w-2xl text-lg leading-relaxed">
                    Connect your editorial ecosystem. Manage secret keys, configure real-time events, and explore our precision-engineered API integrations.
                </p>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-12 gap-8">
                {/* API Keys Section */}
                <section className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)] relative overflow-hidden border border-outline-variant/10">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container"></div>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold font-headline text-on-surface flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">key</span>
                                Authentication Keys
                            </h2>
                            <p className="text-label-sm text-on-surface-variant mt-1">Keep your secret keys secure and never share them.</p>
                        </div>
                        <button 
                            onClick={handleSaveApis}
                            disabled={savingApis}
                            className={`text-sm font-bold px-4 py-2 flex items-center gap-2 rounded-lg transition-all ${
                                savingApis 
                                    ? 'bg-surface-container text-on-surface-variant opacity-70 cursor-not-allowed' 
                                    : 'bg-primary text-white hover:bg-primary-container hover:text-on-primary-container hover:shadow-md'
                            }`}
                        >
                            {savingApis ? <span className="spinner w-4 h-4" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
                            Save API Config
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {/* CRM API Key Row */}
                        <div className="group flex flex-col md:flex-row md:items-center justify-between p-4 bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors ring-1 ring-outline/5 hover:ring-primary/20">
                            <div className="flex-1 mb-4 md:mb-0 md:pr-6">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-xs font-bold uppercase tracking-widest text-secondary">CRM Access Key</span>
                                    {crmApiKey 
                                        ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">ACTIVE</span>
                                        : <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">NOT GENERATED</span>
                                    }
                                </div>
                                {crmApiKey ? (
                                    <div className="font-mono text-sm text-on-surface-variant flex items-center gap-2">
                                        {crmApiKey}
                                        <button onClick={handleCopyKey} className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors text-lg" title="Copiar key">
                                            {copied ? 'check' : 'content_copy'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-sm text-on-surface-variant/60 italic">No key generated yet.</div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    className="text-xs font-bold bg-surface-container-highest hover:bg-surface-dim text-on-surface-variant px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                                    onClick={() => {
                                        if (window.confirm('¿Regenerar la API key? La clave anterior dejará de funcionar.')) {
                                            generateApiKey()
                                        }
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                                    Regenerar
                                </button>
                                {!crmApiKey && (
                                    <button 
                                        className="text-xs font-bold bg-primary text-white hover:bg-primary-container hover:text-on-primary-container px-3 py-1.5 rounded transition-colors flex items-center gap-1 shadow-sm"
                                        onClick={generateApiKey}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">add</span>
                                        Generar Nueva
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Affino Key Row */}
                        <div className="group flex flex-col p-4 bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors ring-1 ring-outline/5 hover:ring-primary/20">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-secondary">Affino API Key</span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">EXTERNAL</span>
                            </div>
                            <div className="flex gap-2 w-full">
                                <input
                                    type="password"
                                    className="flex-1 bg-white/70 border border-outline-variant/20 rounded-md px-3 py-1.5 text-sm font-mono text-on-surface-variant focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                                    placeholder="Introduce la API key de Affino..."
                                    value={affinoKey}
                                    onChange={(e) => setAffinoKey(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Documentation Link Card */}
                <section className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-xl p-8 flex flex-col justify-between group cursor-pointer border border-transparent hover:border-outline-variant/20 shadow-sm transition-all hover:shadow-md">
                    <div>
                        <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center text-tertiary mb-6 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-2xl">menu_book</span>
                        </div>
                        <h2 className="text-2xl font-bold font-headline mb-3 text-on-surface">Core API Reference</h2>
                        <p className="text-on-surface-variant leading-relaxed text-sm">Detailed documentation for REST endpoints, Webhooks, and SDK integrations.</p>
                    </div>
                    <div className="flex items-center gap-2 text-primary font-bold mt-8 group-hover:gap-3 transition-all">
                        Explore Docs <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                </section>

                {/* Webhooks Configuration */}
                <section className="col-span-12 bg-surface-container-lowest border border-outline-variant/10 rounded-xl p-8 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                        <div>
                            <h2 className="text-2xl font-bold font-headline text-on-surface">Webhook Endpoints</h2>
                            <p className="text-on-surface-variant text-sm mt-1">Prisma will send POST requests to your server when events occur.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative" ref={pickerRef}>
                                <button 
                                    className={`bg-gradient-to-r from-primary to-primary-container text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 ${availableToAdd.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => setShowAppPicker(!showAppPicker)}
                                    disabled={availableToAdd.length === 0}
                                >
                                    <span className="material-symbols-outlined">add_link</span>
                                    Add Endpoint
                                </button>
                                {showAppPicker && availableToAdd.length > 0 && (
                                    <div className="absolute top-12 right-0 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/10 w-48 overflow-hidden z-20">
                                        {availableToAdd.map((app, i) => (
                                            <button
                                                key={app}
                                                className={`w-full text-left px-4 py-3 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors ${i !== availableToAdd.length - 1 ? 'border-b border-outline-variant/10' : ''}`}
                                                onClick={() => addIntegration(app)}
                                            >
                                                {app}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button 
                                className="bg-surface-container-highest hover:bg-surface-dim text-on-surface font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 border border-outline-variant/10 shadow-sm"
                                onClick={handleSaveWebhooks}
                                disabled={savingWebhooks || integrations.length === 0}
                            >
                                {savingWebhooks ? <span className="spinner w-4 h-4 border-primary" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
                                Guardar
                            </button>
                        </div>
                    </div>

                    {integrations.length === 0 ? (
                        <div className="text-center py-16 rounded-xl border-2 border-dashed border-outline-variant/20 bg-surface-container-low/30">
                            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3 block">webhook</span>
                            <h3 className="font-bold text-on-surface-variant">No webhooks configured</h3>
                            <p className="text-sm text-on-surface-variant/70 mt-1">Add an endpoint to start sending real-time event payloads.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                            {integrations.map((integration, idx) => (
                                <WebhookRow
                                    key={integration.nombre_aplicacion}
                                    integration={integration}
                                    onChange={(field, value) => updateIntegration(idx, field, value)}
                                    onRemove={() => removeIntegration(idx)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Recent Logs Table (Visual Placeholder to match mockup) */}
                    <div className="mt-8 border-t border-outline-variant/10 pt-8">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Recent Webhook Deliveries</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-outline-variant/10">
                                        <th className="py-4 text-[10px] font-bold text-on-surface-variant uppercase whitespace-nowrap">Status</th>
                                        <th className="py-4 text-[10px] font-bold text-on-surface-variant uppercase whitespace-nowrap">Event</th>
                                        <th className="py-4 text-[10px] font-bold text-on-surface-variant uppercase whitespace-nowrap">Endpoint</th>
                                        <th className="py-4 text-[10px] font-bold text-on-surface-variant uppercase whitespace-nowrap">Latency</th>
                                        <th className="py-4 text-[10px] font-bold text-on-surface-variant uppercase text-right whitespace-nowrap">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/5">
                                    <tr className="hover:bg-surface-container-low transition-colors group cursor-pointer">
                                        <td className="py-4 pr-4">
                                            <div className="flex items-center gap-2 text-green-600">
                                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                                <span className="text-xs font-bold tracking-tight">200 OK</span>
                                            </div>
                                        </td>
                                        <td className="py-4 pr-4">
                                            <code className="text-xs bg-primary-fixed/20 text-on-primary-fixed-variant px-1.5 py-0.5 rounded font-bold">article.published</code>
                                        </td>
                                        <td className="py-4 text-xs font-medium text-on-surface-variant pr-4 whitespace-nowrap">Data Sync Worker</td>
                                        <td className="py-4 text-xs text-secondary pr-4">142ms</td>
                                        <td className="py-4 text-xs text-right text-secondary whitespace-nowrap">Just now</td>
                                    </tr>
                                    <tr className="hover:bg-surface-container-low transition-colors group cursor-pointer">
                                        <td className="py-4 pr-4">
                                            <div className="flex items-center gap-2 text-tertiary">
                                                <span className="material-symbols-outlined text-lg">error</span>
                                                <span className="text-xs font-bold tracking-tight">500 ERR</span>
                                            </div>
                                        </td>
                                        <td className="py-4 pr-4">
                                            <code className="text-xs bg-primary-fixed/20 text-on-primary-fixed-variant px-1.5 py-0.5 rounded font-bold">lead.captured</code>
                                        </td>
                                        <td className="py-4 text-xs font-medium text-on-surface-variant pr-4 whitespace-nowrap">Internal Systems</td>
                                        <td className="py-4 text-xs text-secondary pr-4">3.4s</td>
                                        <td className="py-4 text-xs text-right text-secondary whitespace-nowrap">2h ago</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>

            {/* Footer Help */}
            <div className="mt-16 bg-surface-container-low rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-outline-variant/10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-4 border-white shadow-sm flex items-center justify-center bg-primary text-white">
                        <span className="material-symbols-outlined text-3xl">support_agent</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-xl font-headline text-on-surface">Need integration assistance?</h3>
                        <p className="text-on-surface-variant mt-1 text-sm">Our engineering support team is available 24/7 for Enterprise partners.</p>
                    </div>
                </div>
                <button className="bg-surface-container-highest text-on-surface px-8 py-3 rounded-lg font-bold hover:bg-surface-dim transition-all shadow-sm active:scale-95 whitespace-nowrap border border-outline-variant/10">
                    Contact API Support
                </button>
            </div>
        </div>
    )
}
