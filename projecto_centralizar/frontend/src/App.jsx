import { useState, useEffect, useMemo } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { useContacts, useLookups } from './hooks/useContacts'
import FilterPanel from './components/FilterPanel'
import ContactsTable from './components/ContactsTable'
import ContactModal from './components/ContactModal'
import { CSVImport, CSVExport } from './components/CSV'
// SettingsPage de admin (APIs y Webhooks) — solo accesible para admins
import AdminSettingsPage from './components/SettingsPage'
// SettingsPage de usuario (cambio de contraseña, etc.) — accesible para todos
import UserSettingsPage from './pages/SettingsPage'
import MasterDataPage from './pages/MasterDataPage'
import RequestAccessPage from './pages/RequestAccessPage'
import RequestsPage from './pages/RequestsPage'
import UsersPage from './pages/UsersPage'
import EmpresasPage from './pages/EmpresasPage'
import Login from './components/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { api, setUnauthorizedHandler } from './api/client'
import { getUserFromToken } from './auth/token'
import { ActiveFilters } from './components/ActiveFilters'
import ContactsPage from './pages/ContactsPage'
import { useSessionTimeout } from './hooks/useSessionTimeout'
import SessionTimeoutModal from './components/SessionTimeoutModal'

// ---- Sidebar ----
// Recibe userRole para mostrar/ocultar opciones según el rol del usuario.
// IMPORTANTE: Esto es solo UX — el backend SIEMPRE verifica permisos.
// Si un gestor intenta acceder a /api/users directamente, el backend
// responde con 403 Forbidden gracias a la dependencia AdminUser.
function Sidebar({ page, setPage, userRole, onLogout }) {
    // Definición de items del menú con Material Symbols Outlined
    const allItems = [
        { id: 'contacts', label: 'Contactos', icon: 'group' },
        { id: 'empresas', label: 'Empresas', icon: 'business' },
        { id: 'master-data', label: 'Datos maestros', icon: 'dataset', adminOnly: true },
        { id: 'requests', label: 'Solicitudes', icon: 'fact_check', adminOnly: true },
        { id: 'users', label: 'Usuarios', icon: 'manage_accounts', adminOnly: true },
        { id: 'api-settings', label: 'APIs y Webhooks', icon: 'api', adminOnly: true },
        { id: 'user-settings', label: 'Ajustes', icon: 'settings' },
    ]

    const items = allItems.filter(item => !item.adminOnly || userRole === 'admin')

    return (
        <aside className="h-screen w-64 fixed left-0 top-0 bg-stone-100 flex flex-col py-6 z-50">
            <div className="px-6 mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 btn-primary-gradient rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm">
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
                    </div>
                    <h1 className="font-headline text-xl font-bold text-stone-900 leading-tight tracking-tight">Prisma CRM</h1>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-medium opacity-60 ml-11">Architectural Ledger</p>
            </div>
            
            <nav className="flex-1 px-4 space-y-1">
                {items.map((item) => {
                    const isActive = page === item.id;
                    return (
                        <button
                            id={`nav-${item.id}`}
                            key={item.id}
                            onClick={() => setPage(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 font-sans text-sm transition-all group shadow-none outline-none appearance-none border-0 bg-transparent ${
                                isActive 
                                    ? 'text-primary font-bold border-r-[3px] border-solid border-r-primary rounded-none' 
                                    : 'text-stone-600 font-medium hover:text-primary hover:bg-stone-200/60 rounded-lg'
                            }`}
                        >
                            <span 
                                className="material-symbols-outlined text-xl" 
                                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                            >
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                        </button>
                    )
                })}
            </nav>
            
            <div className="mt-auto px-4 space-y-1">

                <button 
                    className="w-full flex items-center gap-3 px-4 py-3 text-stone-600 font-medium hover:text-primary hover:bg-stone-200/60 rounded-lg transition-all group shadow-none outline-none appearance-none border-0 bg-transparent cursor-pointer"
                    onClick={async () => {
                        await api.logout()
                        if (onLogout) onLogout()
                        window.location.reload()
                    }}
                >
                    <span className="material-symbols-outlined text-xl">logout</span>
                    Cerrar sesión
                </button>
            </div>
        </aside>
    )
}


// ---- Authenticated App Shell ----
// Recibe userRole y userEmail del JWT para controlar qué ve cada usuario.
// - userRole: controla visibilidad del menú y rutas protegidas
// - userEmail: se pasa a UsersPage para ocultar el botón "Eliminar"
//   en la fila del propio admin (no puede auto-eliminarse)
// La protección visual complementa la protección real del backend.
function AuthenticatedApp({ onLogout, userRole, userEmail }) {
    const [page, setPage] = useState('empresas')
    const [extending, setExtending] = useState(false)

    // ── Logout global ──
    // Limpia el estado de autenticación y redirige a login.
    // Usado tanto en logout manual como en automático por inactividad o 401.
    const handleLogout = async () => {
        await api.logout()
        if (onLogout) onLogout()
    }

    // ── Gestión de inactividad ──
    const { showWarning, secondsLeft, extendSession, forceLogout } = useSessionTimeout({
        onLogout: handleLogout,
    })

    // Registrar el handler global de 401: si el backend rechaza el token,
    // ejecutar logout automáticamente (una sola vez).
    useEffect(() => {
        setUnauthorizedHandler(forceLogout)
        return () => setUnauthorizedHandler(null)
    }, [forceLogout])

    // Renovar sesión con feedback visual en el modal (spinner mientras espera)
    const handleExtendSession = async () => {
        setExtending(true)
        await extendSession()
        setExtending(false)
    }

    return (
        <div className="bg-background text-on-background min-h-screen font-body flex">
            <Sidebar page={page} setPage={setPage} userRole={userRole} onLogout={handleLogout} />
            
            <main className="ml-64 w-full min-h-screen flex flex-col relative">
                {/* Top Nav Bar Shell */}
                <header className="w-full h-16 sticky top-0 z-40 bg-stone-50/80 backdrop-blur-xl flex justify-between items-center px-8 border-b border-stone-200/20">
                    <div className="flex items-center flex-1 max-w-xl">
                        <div className="relative w-full group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-cyan-600 transition-colors">search</span>
                            <input 
                                className="w-full bg-stone-100 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-cyan-600/20 transition-all outline-none" 
                                placeholder="Search accounts, leads, or tasks..." 
                                type="text"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 ml-8">
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-stone-900 leading-none">{userEmail}</p>
                                <p className="text-[10px] text-stone-500 font-medium capitalize">{userRole}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center ring-2 ring-stone-100">
                                <span className="material-symbols-outlined text-sm">person</span>
                            </div>
                        </div>
                    </div>
                </header>

                {page === 'contacts' && <ContactsPage />}
                {page === 'empresas' && <EmpresasPage />}
                {page === 'master-data' && (
                    <ProtectedRoute requiredRole="admin" userRole={userRole}>
                        <MasterDataPage />
                    </ProtectedRoute>
                )}
                {page === 'requests' && (
                    <ProtectedRoute requiredRole="admin" userRole={userRole}>
                        <RequestsPage />
                    </ProtectedRoute>
                )}
                {page === 'users' && (
                    <ProtectedRoute requiredRole="admin" userRole={userRole}>
                        <UsersPage currentUserEmail={userEmail} />
                    </ProtectedRoute>
                )}
                {page === 'api-settings' && (
                    <ProtectedRoute requiredRole="admin" userRole={userRole}>
                        <AdminSettingsPage />
                    </ProtectedRoute>
                )}
                {page === 'user-settings' && <UserSettingsPage />}
            </main>

            {/* Modal global de inactividad — montado sobre todo el contenido */}
            {showWarning && (
                <SessionTimeoutModal
                    secondsLeft={secondsLeft}
                    onExtend={handleExtendSession}
                    onLogout={forceLogout}
                    extending={extending}
                />
            )}
        </div>
    )
}


// ---- App Root with Routing ----
// Gestiona el estado de autenticación y el rol del usuario.
// Al arrancar, verifica si hay un token válido llamando GET /api/me.
// Si el token es válido, se extrae el rol del JWT para control de UI.
function AppRoutes() {
    const [isAuthenticated, setIsAuthenticated] = useState(null) // null = loading
    const [userRole, setUserRole] = useState(null) // 'admin' | 'gestor' | null
    // Email del usuario autenticado — se pasa a UsersPage para controlar
    // la visibilidad del botón "Eliminar" (no puede auto-eliminarse)
    const [userEmail, setUserEmail] = useState(null)
    const navigate = useNavigate()

    /**
     * Verifica la autenticación del usuario al cargar la app.
     *
     * Flujo:
     * 1. Llama GET /api/me (envía el JWT automáticamente via client.js)
     * 2. Si el backend responde OK → el token es válido
     * 3. Extrae el rol del JWT almacenado en localStorage
     * 4. Si falla (401) → no hay sesión válida
     */
    const checkAuth = async () => {
        try {
            await api.me()
            // Token válido → extraer info del usuario del JWT
            const userData = getUserFromToken()
            setUserRole(userData?.role ?? null)
            setUserEmail(userData?.email ?? null)
            setIsAuthenticated(true)
        } catch (e) {
            setIsAuthenticated(false)
            setUserRole(null)
            setUserEmail(null)
        }
    }

    useEffect(() => {
        checkAuth()
    }, [])

    if (isAuthenticated === null) {
        return (
            <div className="auth-page">
                <div className="spinner" style={{ width: 32, height: 32 }}></div>
            </div>
        )
    }

    return (
        <Routes>
            {/* Public routes — accesibles sin autenticación */}
            <Route
                path="/login"
                element={
                    isAuthenticated
                        ? <Navigate to="/" replace />
                        : <Login
                            onLoginComplete={() => {
                                // Después del login, el token ya está en localStorage
                                // (lo guardó api.login → setToken)
                                // Extraemos el rol del JWT para uso inmediato
                                const userData = getUserFromToken()
                                setUserRole(userData?.role ?? null)
                                setUserEmail(userData?.email ?? null)
                                setIsAuthenticated(true)
                                navigate('/')
                            }}
                            onNavigateRequestAccess={() => navigate('/request-access')}
                          />
                }
            />
            <Route
                path="/request-access"
                element={
                    isAuthenticated
                        ? <Navigate to="/" replace />
                        : <RequestAccessPage
                            onNavigateLogin={() => navigate('/login')}
                          />
                }
            />

            {/* Protected routes — requieren autenticación */}
            <Route
                path="/*"
                element={
                    isAuthenticated
                        ? <AuthenticatedApp
                            userRole={userRole}
                            userEmail={userEmail}
                            onLogout={() => {
                                setIsAuthenticated(false)
                                setUserRole(null)
                                setUserEmail(null)
                                navigate('/login')
                            }}
                          />
                        : <Navigate to="/login" replace />
                }
            />
        </Routes>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    )
}
