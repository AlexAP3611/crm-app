import { useState } from 'react'
import { api } from '../api/client'

export default function SettingsPage() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const handleChangePassword = async (e) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('Todos los campos son obligatorios')
            return
        }

        if (newPassword !== confirmPassword) {
            setError('La nueva contraseña y la confirmación no coinciden')
            return
        }

        if (newPassword.length < 6) {
            setError('La nueva contraseña debe tener al menos 6 caracteres')
            return
        }

        setLoading(true)
        try {
            await api.changePassword(currentPassword, newPassword)
            setSuccess('Contraseña actualizada correctamente')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setTimeout(() => setSuccess(null), 3000)
        } catch (err) {
            setError(err.message || 'Error al cambiar la contraseña')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-8 pb-20 space-y-8">
            {/* Header & Hero */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Ajustes</h2>
                </div>
            </div>

            <div className="max-w-3xl">
                {/* Status Messages */}
                {success && (
                    <div className="mb-6 bg-primary-fixed/30 text-primary p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300">
                        {success}
                    </div>
                )}
                {error && (
                    <div className="mb-6 bg-error-container text-on-error-container p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300">
                        {error}
                    </div>
                )}

                {/* Password Change Section */}
                <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
                    <div className="p-8 border-b border-surface-container-low">
                        <h3 className="font-headline font-bold text-xl text-on-surface mb-1">Cambiar contraseña</h3>
                    </div>

                    <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 col-span-full md:col-span-1">
                                <label className="block text-xs font-bold uppercase tracking-widest text-secondary ml-1" htmlFor="current-password-input">
                                    Contraseña actual
                                </label>
                                <input
                                    id="current-password-input"
                                    type="password"
                                    className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder="••••••••"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                            </div>

                            <div className="hidden md:block"></div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-secondary ml-1" htmlFor="new-password-input">
                                    Nueva contraseña
                                </label>
                                <input
                                    id="new-password-input"
                                    type="password"
                                    className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder="Mínimo 6 caracteres"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={loading}
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-secondary ml-1" htmlFor="confirm-password-input">
                                    Confirmar nueva contraseña
                                </label>
                                <input
                                    id="confirm-password-input"
                                    type="password"
                                    className="w-full bg-surface-container-low/50 border border-outline-variant/30 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder="Repite la contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-surface-container-low">
                            <button
                                id="change-password-btn"
                                type="submit"
                                className="inline-flex items-center gap-2 px-8 py-3 btn-primary-gradient text-white rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 font-bold text-sm border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Actualizando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-lg">vpn_key</span>
                                        <span>Actualizar contraseña</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Optional Info Card */}
            </div>
        </div>
    )
}
