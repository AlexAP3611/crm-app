import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

function MasterDataLedger({ title, singularTitle, icon, fetchApi, createApi, deleteApi, isPrimary = false }) {
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

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAdd = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) {
            setIsAdding(false);
            setError(null);
            return;
        }

        try {
            setSaving(true);
            setError(null);
            if (title === 'Campañas') {
                await createApi({ nombre: trimmed });
            } else {
                await createApi({ name: trimmed });
            }
            setInputValue("");
            setIsAdding(false);
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
        <section className="bg-surface-container-low p-6 rounded-2xl border border-stone-200/50 shadow-sm space-y-4">
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
                                if (e.key === 'Escape') {
                                    setIsAdding(false);
                                    setInputValue("");
                                    setError(null);
                                }
                            }}
                            onBlur={() => {
                                if (!inputValue.trim()) {
                                    setIsAdding(false);
                                    setError(null);
                                }
                            }}
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

export default function MasterDataPage() {
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
                    title="Cargos"
                    singularTitle="Cargo"
                    icon="badge"
                    fetchApi={api.listCargos}
                    createApi={api.createCargo}
                    deleteApi={api.deleteCargo}
                />
                <MasterDataLedger
                    title="Campañas"
                    singularTitle="Campaña"
                    icon="campaign"
                    fetchApi={api.listCampaigns}
                    createApi={api.createCampaign}
                    deleteApi={api.deleteCampaign}
                />
            </div>
        </div>
    );
}

