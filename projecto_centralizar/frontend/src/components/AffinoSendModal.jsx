import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function AffinoSendModal({ scope, actionCount, onClose, onSent, onError }) {
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedId, setSelectedId] = useState(null)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        const fetchAccounts = async () => {
            setLoading(true)
            try {
                const data = await api.listAffinoAccounts()
                setAccounts(data || [])
                // Select the first account by default if available
                if (data && data.length > 0) {
                    setSelectedId(data[0].id)
                }
            } catch (err) {
                console.error('Error fetching Affino accounts:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchAccounts()
    }, [])

    const handleSend = async () => {
        if (!selectedId) return
        setSending(true)
        try {
            const payload = {
                account_id: selectedId,
                ...scope
            }
            const res = await api.exportAffino(payload)
            onSent(res.run_id)
        } catch (err) {
            console.error('Affino export failed:', err)
            if (err.data && err.data.invalid_entities) {
                onError(err.data.message, err.data.invalid_entities)
            } else {
                onError(err.message || 'Error desconocido al enviar a Affino', [])
            }
        } finally {
            setSending(false)
        }
    }

    const obfuscate = (val) => {
        if (!val) return ''
        return val.length > 4 ? '••••••' + val.slice(-4) : '••••'
    }

    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-stone-200/70 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-stone-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-cyan-600 text-lg">send</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-stone-900 text-base leading-tight">Enviar a Affino</h2>
                            <p className="text-[11px] text-stone-400 font-medium">
                                Selecciona la cuenta destinataria para {actionCount} {actionCount === 1 ? 'contacto' : 'contactos'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors border-0 bg-transparent outline-none cursor-pointer">
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {loading ? (
                        <div className="py-8 text-center text-stone-400 text-sm flex flex-col items-center gap-2">
                            <span className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                            Cargando cuentas de Affino...
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="py-4 text-center">
                            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="material-symbols-outlined text-amber-500 text-2xl">warning</span>
                            </div>
                            <p className="text-sm font-semibold text-stone-900">No hay cuentas configuradas</p>
                            <p className="text-xs text-stone-500 mt-2 max-w-xs mx-auto leading-relaxed">
                                No tienes ninguna cuenta de Affino registrada en el sistema.
                                Solicita a un administrador que configure una cuenta en la sección de <strong>APIs y Webhooks</strong>.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Cuentas disponibles</p>
                            {accounts.map(acc => {
                                const isSelected = selectedId === acc.id
                                return (
                                    <div
                                        key={acc.id}
                                        onClick={() => setSelectedId(acc.id)}
                                        className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
                                            isSelected
                                                ? 'border-cyan-600 bg-cyan-50/30 shadow-sm'
                                                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                            isSelected ? 'border-cyan-600 bg-cyan-600' : 'border-stone-300 bg-white'
                                        }`}>
                                            {isSelected && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-stone-900 truncate">{acc.nombre}</p>
                                            <p className="text-xs text-stone-400 font-mono mt-0.5">{obfuscate(acc.x_user_id)}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                    <button
                        className="px-4 py-2 font-medium text-stone-600 hover:bg-stone-200 rounded-lg text-sm transition-colors border-0 bg-transparent outline-none cursor-pointer"
                        onClick={onClose}
                        disabled={sending}
                    >
                        Cancelar
                    </button>
                    {accounts.length > 0 && (
                        <button
                            className="px-5 py-2 font-bold text-white btn-primary-gradient rounded-lg text-sm shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity active:scale-95 border-0 outline-none cursor-pointer flex items-center gap-2"
                            onClick={handleSend}
                            disabled={sending || !selectedId}
                        >
                            {sending ? (
                                <>
                                    <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: '#fff' }} />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    Enviar
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

            </div>
        </div>
    )
}
