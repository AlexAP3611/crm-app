import { useState } from 'react'
import { api } from '../api/client'

export default function Login({ onLoginComplete, onNavigateRequestAccess }) {
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
        <div className="asymmetric-bg min-h-screen flex flex-col font-body text-on-surface w-full h-full absolute inset-0 z-50 bg-[#fbf9f8]">
            <style>
                {`
                .material-symbols-outlined {
                    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                }
                .editorial-gradient {
                    background: linear-gradient(135deg, #006877 0%, #00bbd4 100%);
                }
                .asymmetric-bg {
                    background-color: #fbf9f8;
                    background-image: radial-gradient(at 0% 0%, rgba(0, 104, 119, 0.03) 0, transparent 50%),
                                      radial-gradient(at 100% 100%, rgba(190, 0, 59, 0.02) 0, transparent 50%);
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                }
                `}
            </style>
            <main className="flex-grow flex items-center justify-center px-6 py-12 relative z-10 w-full h-full">
                <div className="w-full max-w-[480px]">
                    <div className="mb-12 text-center md:text-left">
                        <div className="inline-flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 editorial-gradient rounded-lg flex items-center justify-center text-white">
                                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
                            </div>
                            <h1 className="font-headline text-3xl font-extrabold tracking-tighter text-on-surface">Prisma</h1>
                        </div>
                    </div>

                    <div className="glass-card rounded-xl border-none shadow-[0_20px_40px_rgba(27,28,28,0.04)] overflow-hidden">
                        <div className="h-1 editorial-gradient w-full"></div>
                        <div className="p-10 space-y-8">

                            {error && (
                                <div className="p-4 bg-error-container text-on-error-container rounded text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="group relative flex flex-col gap-1">
                                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/70 ml-1" htmlFor="email">Email</label>
                                    <div className="relative bg-surface-container-lowest border-b-2 border-outline-variant/20 transition-all duration-300 focus-within:border-primary">
                                        <input
                                            className="w-full bg-transparent border-none py-4 pl-1 pr-8 text-on-surface focus:outline-none focus:ring-0 placeholder:text-outline-variant font-body text-sm rounded-none focus:bg-transparent"
                                            id="email"
                                            placeholder="nombre@empresa.com"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">
                                            <span className="material-symbols-outlined text-xl">alternate_email</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="group relative flex flex-col gap-1">
                                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/70 ml-1" htmlFor="password">Contraseña</label>
                                    <div className="relative bg-surface-container-lowest border-b-2 border-outline-variant/20 transition-all duration-300 focus-within:border-primary">
                                        <input
                                            className="w-full bg-transparent border-none py-4 pl-1 pr-8 text-on-surface focus:outline-none focus:ring-0 placeholder:text-outline-variant font-body text-sm rounded-none focus:bg-transparent"
                                            id="password"
                                            placeholder="••••••••"
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">
                                            <span className="material-symbols-outlined text-xl">lock</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20 bg-surface-container-lowest" type="checkbox" />
                                        <span className="font-label text-xs text-on-surface-variant group-hover:text-on-surface transition-colors">Recordar credenciales</span>
                                    </label>
                                </div>

                                <button
                                    className="w-full editorial-gradient text-white font-headline font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/10 border-none cursor-pointer disabled:opacity-50"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? 'Validando...' : 'Entrar al Espacio'}
                                    {!loading && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
                                </button>
                            </form>

                            <div className="pt-4 flex items-center gap-4">
                                <div className="h-[1px] flex-grow bg-surface-container-high"></div>
                                <span className="font-label text-[10px] text-outline-variant uppercase tracking-widest">Nuevo Ingreso</span>
                                <div className="h-[1px] flex-grow bg-surface-container-high"></div>
                            </div>

                            <div className="text-center pb-2">
                                <p className="font-body text-xs text-on-surface-variant mb-2">¿Aún no formas parte de la red?</p>
                                <button
                                    type="button"
                                    onClick={onNavigateRequestAccess}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface-container-low text-on-surface font-semibold text-sm rounded-full border border-outline-variant/10 hover:bg-surface-container-high transition-colors cursor-pointer w-full sm:w-auto"
                                >
                                    Solicitar una cuenta
                                    <span className="material-symbols-outlined text-base">contact_page</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <div className="fixed right-0 top-0 bottom-0 w-1/3 hidden lg:block overflow-hidden pointer-events-none z-0">
                <div className="absolute inset-0 bg-surface-container-low opacity-40"></div>
                <img
                    alt="architectural minimalism"
                    className="h-full w-full object-cover grayscale opacity-10 mix-blend-multiply"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAm9YzAbSgbrrqxcild7S7CcaXHDLe8F59BC72AmyOOM0Vozg2Tf2sP3YyOYjRHFkbqrW-0LasabRRqGNoYc8YQ1chjKjgNxHQxEtRmhhTERG9bhybiyjN8vWxJ-aANRuxzTC9YkJZ0x74pw6zhkTuQYN_kfyhNBqRVK0qdLvdOjifsKKw935RXsQnemkWhmWE18bHvaz45Q7QhMFCsuUcWrcaoFe8pnKJ5ZMcoqjciHSrPNU_gp4Rz0diqof60ACIGG08vIW10ymBy"
                />
                <div className="absolute bottom-20 left-12 max-w-xs">
                    <div className="h-12 w-[1px] bg-primary mb-6"></div>
                    <p className="font-headline text-2xl font-bold text-on-surface-variant/40 leading-tight">
                        Estructura de datos<br />con fineza<br />editorial.
                    </p>
                </div>
            </div>
        </div>
    )
}
