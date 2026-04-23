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
                                <h1 className="font-headline text-3xl font-extrabold tracking-tighter text-on-surface">Prisma CRM</h1>
                            </div>
                        </div>

                        <div className="glass-card rounded-xl border-none shadow-[0_20px_40px_rgba(27,28,28,0.04)] overflow-hidden">
                            <div className="h-1 editorial-gradient w-full"></div>
                            <div className="p-10 space-y-8 text-center">
                                <div className="mx-auto w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center text-primary mb-4">
                                    <span className="material-symbols-outlined text-3xl">mail</span>
                                </div>
                                <h2 className="font-headline text-2xl font-bold text-on-surface">Solicitud enviada</h2>
                                <p className="font-body text-on-surface-variant leading-relaxed">
                                    Tu solicitud de acceso ha sido enviada correctamente.<br />
                                    <strong className="text-on-surface">Pendiente de aprobación.</strong>
                                </p>
                                <p className="font-body text-xs text-outline-variant">
                                    Recibirás una notificación cuando un administrador apruebe tu solicitud.
                                </p>

                                <button 
                                    className="w-full mt-6 bg-surface-container-low text-on-surface font-headline font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-high active:scale-[0.98] transition-all border border-outline-variant/10 cursor-pointer"
                                    onClick={onNavigateLogin}
                                >
                                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                                    Volver al inicio de sesión
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        )
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
                            <h1 className="font-headline text-3xl font-extrabold tracking-tighter text-on-surface">Prisma CRM</h1>
                        </div>
                        <p className="font-body text-on-surface-variant text-lg leading-relaxed">
                            Completa el formulario para solicitar una <span className="text-primary font-semibold italic">cuenta de red</span>.
                        </p>
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
                                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/70 ml-1" htmlFor="request-email">Email Corporativo</label>
                                    <div className="relative bg-surface-container-lowest border-b-2 border-outline-variant/20 transition-all duration-300 focus-within:border-primary">
                                        <input 
                                            className="w-full bg-transparent border-none py-4 pl-1 pr-8 text-on-surface focus:outline-none focus:ring-0 placeholder:text-outline-variant font-body text-sm rounded-none focus:bg-transparent" 
                                            id="request-email" 
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
                                    <label className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/70 ml-1" htmlFor="request-password">Contraseña Deseada</label>
                                    <div className="relative bg-surface-container-lowest border-b-2 border-outline-variant/20 transition-all duration-300 focus-within:border-primary">
                                        <input 
                                            className="w-full bg-transparent border-none py-4 pl-1 pr-8 text-on-surface focus:outline-none focus:ring-0 placeholder:text-outline-variant font-body text-sm rounded-none focus:bg-transparent" 
                                            id="request-password" 
                                            placeholder="••••••••" 
                                            type="password"
                                            required
                                            minLength={6}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">
                                            <span className="material-symbols-outlined text-xl">lock</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-outline-variant mt-1 ml-1 font-body">Mínimo 6 caracteres</span>
                                </div>

                                <button 
                                    className="w-full mt-2 editorial-gradient text-white font-headline font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/10 border-none cursor-pointer disabled:opacity-50"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? 'Enviando...' : 'Enviar solicitud'}
                                    {!loading && <span className="material-symbols-outlined text-lg">send</span>}
                                </button>
                            </form>

                            <div className="pt-4 flex items-center gap-4">
                                <div className="h-[1px] flex-grow bg-surface-container-high"></div>
                                <span className="font-label text-[10px] text-outline-variant uppercase tracking-widest">Ya miembro</span>
                                <div className="h-[1px] flex-grow bg-surface-container-high"></div>
                            </div>

                            <div className="text-center pb-2">
                                <p className="font-body text-xs text-on-surface-variant mb-2">¿Ya tienes una cuenta activa?</p>
                                <button 
                                    type="button"
                                    onClick={onNavigateLogin}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface-container-low text-on-surface font-semibold text-sm rounded-full border border-outline-variant/10 hover:bg-surface-container-high transition-colors cursor-pointer w-full sm:w-auto"
                                >
                                    Iniciar sesión
                                    <span className="material-symbols-outlined text-base">login</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <footer className="mt-12 text-center pb-8">
                        <p className="font-label text-[10px] text-outline-variant tracking-wider uppercase">
                            © 2024 Editorial Precision CRM • Version 4.2.0
                        </p>
                    </footer>
                </div>
            </main>

            <div className="fixed right-0 top-0 bottom-0 w-1/3 hidden lg:block overflow-hidden pointer-events-none z-0">
                <div className="absolute inset-0 bg-surface-container-low opacity-40"></div>
                <img 
                    alt="architectural minimalism abstract" 
                    className="h-full w-full object-cover grayscale opacity-10 mix-blend-multiply" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQqTq_30M7mJ12OEqYj1-L9m-6jA6aZgT42Y2U7U7GXZQ45z32A32z5d_qH_Y12E11I0G_0H_13J9P0A0O01M24L26E0_jW3I-C2kR1X38I-z611L-iVz4r7z6S3G3v3m2D0J1w5l13w2Q9A4n8T7r4F2n8v3_4_6_5_8O8X=s1200"
                />
                <div className="absolute bottom-20 left-12 max-w-xs">
                    <div className="h-12 w-[1px] bg-primary mb-6"></div>
                    <p className="font-headline text-2xl font-bold text-on-surface-variant/40 leading-tight">
                        Integridad de datos<br/>con fineza<br/>editorial.
                    </p>
                </div>
            </div>
        </div>
    )
}
