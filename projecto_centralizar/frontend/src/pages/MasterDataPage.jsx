import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

// ─── Generic chip ledger (Sectors, Verticals, Products, Campaigns) ───────────

function MasterDataLedger({ title, singularTitle, icon, fetchApi, createApi, deleteApi }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchApi();
            setItems(data);
        } catch (err) {
            setError("Error al cargar");
        } finally {
            setLoading(false);
        }
    }, [fetchApi]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) { setIsAdding(false); setError(null); return; }
        try {
            setSaving(true); setError(null);
            await createApi(title === 'Campañas' ? { nombre: trimmed } : { name: trimmed });
            setInputValue(""); setIsAdding(false);
            await loadData();
        } catch (err) {
            setError(err.message || "Error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteApi(id);
            await loadData();
        } catch (err) {
            setError(err.message || "Error");
        }
    };

    const chipClass = "bg-cyan-50 text-[#006877] border-cyan-100 shadow-sm hover:bg-cyan-100/50 hover:border-cyan-200";

    return (
        <section className="bg-white p-6 rounded-2xl border border-stone-200/50 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">{icon}</span>
                    <h4 className="font-headline font-bold text-lg text-on-surface">{title}</h4>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/40 w-[160px] whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                    Añadir {singularTitle || title}
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {loading ? (
                    <div className="text-xs text-stone-400 italic">Cargando...</div>
                ) : items.map((item) => (
                    <div
                        key={item.id}
                        className={`group relative flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-default ${chipClass}`}
                    >
                        <span>{item.name || item.nombre}</span>
                        <button
                            onClick={() => handleDelete(item.id)}
                            className="material-symbols-outlined text-[16px] text-cyan-600/50 hover:text-error transition-colors bg-transparent border-none p-0 outline-none cursor-pointer leading-none"
                        >
                            close
                        </button>
                    </div>
                ))}

                {isAdding && (
                    <form onSubmit={handleAdd} className="flex items-center gap-2">
                        <input
                            autoFocus
                            type="text"
                            className="bg-surface-container-low border border-cyan-300/50 text-sm px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/20 min-w-[160px] shadow-sm transition-all"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') { setIsAdding(false); setInputValue(""); setError(null); }
                            }}
                            onBlur={() => { if (!inputValue.trim()) { setIsAdding(false); setError(null); } }}
                            disabled={saving}
                            placeholder="Escribe un nombre..."
                        />
                    </form>
                )}
            </div>
            {error && <p className="text-[10px] text-error">{error}</p>}
        </section>
    );
}

// ─── Categorías Cargo Ledger ──────────────────────────────────────────────────
// Same as generic but with violet accent to visually distinguish it from Cargos.

function CategoriaCargoLedger({ categorias, onReload }) {
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) { setIsAdding(false); setError(null); return; }
        try {
            setSaving(true); setError(null);
            await api.createCategoriaCargo({ name: trimmed });
            setInputValue(""); setIsAdding(false);
            onReload();
        } catch (err) {
            setError(err.message || "Error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteCategoriaCargo(id);
            onReload();
        } catch (err) {
            setError(err.message || "Error");
        }
    };

    return (
        <section className="bg-white p-6 rounded-2xl border border-violet-200/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-violet-600">psychology</span>
                    <h4 className="font-headline font-bold text-lg text-on-surface">Categorías de Cargo</h4>
                    <span className="text-[10px] text-violet-500 font-bold uppercase tracking-widest bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                        Nivel de decisión
                    </span>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-violet-600/10 text-violet-700 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-violet-600/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 border-0 outline-none w-[160px] whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                    Añadir Categoría
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {categorias.length === 0 && !isAdding && (
                    <p className="text-xs text-stone-400 italic">Sin categorías. Crea la primera.</p>
                )}
                {categorias.map((cat) => (
                    <div
                        key={cat.id}
                        className="group relative flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-default bg-violet-50 text-violet-700 border-violet-200 shadow-sm hover:bg-violet-100/50 hover:border-violet-300"
                    >
                        <span>{cat.name}</span>
                        <button
                            onClick={() => handleDelete(cat.id)}
                            className="material-symbols-outlined text-[16px] text-violet-400/60 hover:text-error transition-colors bg-transparent border-none p-0 outline-none cursor-pointer leading-none"
                        >
                            close
                        </button>
                    </div>
                ))}
                {isAdding && (
                    <form onSubmit={handleAdd} className="flex items-center gap-2">
                        <input
                            autoFocus
                            type="text"
                            className="bg-violet-50/80 border border-violet-300/50 text-sm px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-violet-500/20 min-w-[160px] shadow-sm transition-all"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') { setIsAdding(false); setInputValue(""); setError(null); }
                            }}
                            onBlur={() => { if (!inputValue.trim()) { setIsAdding(false); setError(null); } }}
                            disabled={saving}
                            placeholder="ej. Decisor, Técnico..."
                        />
                    </form>
                )}
            </div>
            {error && <p className="text-[10px] text-error">{error}</p>}
        </section>
    );
}

// ─── Cargo Ledger with inline categoria dropdown ──────────────────────────────

function CargoLedger({ categorias }) {
    const [cargos, setCargos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.listCargos();
            setCargos(data);
        } catch (err) {
            setError("Error al cargar cargos");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) { setIsAdding(false); setError(null); return; }
        try {
            setSaving(true); setError(null);
            await api.createCargo({ name: trimmed });
            setInputValue(""); setIsAdding(false);
            await loadData();
        } catch (err) {
            setError(err.message || "Error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteCargo(id);
            await loadData();
        } catch (err) {
            setError(err.message || "Error");
        }
    };

    const handleCategoriaChange = async (cargoId, newCategoriaId) => {
        setUpdatingId(cargoId);
        setError(null);
        try {
            const categoriaId = newCategoriaId === "" ? null : Number(newCategoriaId);
            await api.updateCargoCategoria(cargoId, categoriaId);
            await loadData();
        } catch (err) {
            setError(err.message || "Error al actualizar categoría");
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <section className="bg-white p-6 rounded-2xl border border-stone-200/50 shadow-sm space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">badge</span>
                    <h4 className="font-headline font-bold text-lg text-on-surface">Cargos</h4>
                    <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                        con categoría asignable
                    </span>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/40 w-[160px] whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-[14px]">add_circle</span>
                    Añadir Cargo
                </button>
            </div>

            {loading ? (
                <div className="text-xs text-stone-400 italic">Cargando...</div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-stone-100">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-stone-50 border-b border-stone-100">
                                <th className="py-3 px-4 text-[10px] font-bold text-stone-500 uppercase tracking-widest">Cargo</th>
                                <th className="py-3 px-4 text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                    Categoría
                                    <span className="ml-1.5 text-violet-500 normal-case font-normal">(nivel de decisión)</span>
                                </th>
                                <th className="py-3 px-4 text-right text-[10px] font-bold text-stone-500 uppercase tracking-widest">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {cargos.length === 0 && !isAdding && (
                                <tr>
                                    <td colSpan="3" className="py-8 text-center text-xs text-stone-400 italic">Sin cargos. Crea el primero.</td>
                                </tr>
                            )}
                            {cargos.map((cargo) => (
                                <tr key={cargo.id} className="hover:bg-stone-50/80 transition-colors">
                                    <td className="py-3 px-4 font-semibold text-stone-800">
                                        {cargo.name}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="relative max-w-[200px]">
                                            <select
                                                value={cargo.categoria?.id ?? ""}
                                                onChange={(e) => handleCategoriaChange(cargo.id, e.target.value)}
                                                disabled={updatingId === cargo.id}
                                                className={`w-full text-xs px-3 py-1.5 rounded-lg border appearance-none outline-none cursor-pointer transition-all focus:ring-2 focus:ring-violet-400/30
                                                    ${cargo.categoria
                                                        ? 'bg-violet-50 text-violet-700 border-violet-200 font-bold'
                                                        : 'bg-stone-50 text-stone-400 border-stone-200 italic'
                                                    }
                                                    ${updatingId === cargo.id ? 'opacity-50 cursor-wait' : ''}
                                                `}
                                            >
                                                <option value="">Sin categoría</option>
                                                {categorias.map((cat) => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-stone-400 pointer-events-none">
                                                expand_more
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <button
                                            onClick={() => handleDelete(cargo.id)}
                                            className="material-symbols-outlined text-[18px] text-stone-300 hover:text-error transition-colors bg-transparent border-none p-0 outline-none cursor-pointer leading-none"
                                            title="Eliminar cargo"
                                        >
                                            delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {isAdding && (
                                <tr className="bg-stone-50/50">
                                    <td className="py-3 px-4" colSpan="3">
                                        <form onSubmit={handleAdd} className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                className="bg-white border border-cyan-300/50 text-sm px-4 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500/20 min-w-[200px] shadow-sm transition-all"
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') { setIsAdding(false); setInputValue(""); setError(null); }
                                                }}
                                                onBlur={() => { if (!inputValue.trim()) { setIsAdding(false); setError(null); } }}
                                                disabled={saving}
                                                placeholder="Nombre del cargo..."
                                            />
                                        </form>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {error && <p className="text-[10px] text-error">{error}</p>}
        </section>
    );
}

// ─── MasterDataPage ───────────────────────────────────────────────────────────

export default function MasterDataPage() {
    const [categoriasCargo, setCategoriasCargo] = useState([]);

    const loadCategorias = useCallback(async () => {
        try {
            const data = await api.listCategoriasCargo();
            setCategoriasCargo(data);
        } catch (_) {}
    }, []);

    useEffect(() => { loadCategorias(); }, [loadCategorias]);

    return (
        <div className="p-8 pb-20 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Segmentación</h2>
                </div>
            </div>

            {/* Distributed Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <MasterDataLedger
                    title="Sectores"
                    singularTitle="Sector"
                    icon="category"
                    fetchApi={api.listSectors}
                    createApi={api.createSector}
                    deleteApi={api.deleteSector}
                />
                <MasterDataLedger
                    title="Verticales"
                    singularTitle="Vertical"
                    icon="layers"
                    fetchApi={api.listVerticals}
                    createApi={api.createVertical}
                    deleteApi={api.deleteVertical}
                />
                <MasterDataLedger
                    title="Productos"
                    singularTitle="Producto"
                    icon="inventory_2"
                    fetchApi={api.listProducts}
                    createApi={api.createProduct}
                    deleteApi={api.deleteProduct}
                />
                <MasterDataLedger
                    title="Campañas"
                    singularTitle="Campaña"
                    icon="campaign"
                    fetchApi={api.listCampaigns}
                    createApi={api.createCampaign}
                    deleteApi={api.deleteCampaign}
                />

                {/* Categorías de Cargo — violet accent, full-width on lg */}
                <CategoriaCargoLedger
                    categorias={categoriasCargo}
                    onReload={loadCategorias}
                />

                {/* Cargos — spans both columns, includes inline categoria dropdown */}
                <CargoLedger categorias={categoriasCargo} />
            </div>
        </div>
    );
}
