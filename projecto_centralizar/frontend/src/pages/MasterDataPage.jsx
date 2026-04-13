import { useState, useEffect, useCallback } from "react";
import { masterDataApi } from "../api/masterData";

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

    const chipClass = isPrimary 
        ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" 
        : "bg-surface-container-highest text-on-surface border-outline-variant/30 hover:border-primary/40";

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">{icon}</span>
                    <h4 className="font-headline font-bold text-lg text-on-surface">{title}</h4>
                </div>
                <button 
                    onClick={() => setIsAdding(true)} 
                    className="text-xs font-bold text-primary hover:underline bg-transparent border-none p-0 outline-none cursor-pointer"
                >
                    Añadir {singularTitle || title}
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {loading ? (
                    <div className="text-xs text-stone-400 italic px-2">Cargando...</div>
                ) : items.map((item) => (
                    <div 
                        key={item.id} 
                        className={`group relative flex items-center gap-2 px-3 py-1.5 border rounded-full text-sm font-medium transition-all cursor-default ${chipClass}`}
                    >
                        <span>{item.name || item.nombre}</span>
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className={`material-symbols-outlined text-base hover:text-error transition-colors bg-transparent border-none p-0 outline-none cursor-pointer ${!isPrimary ? 'text-on-surface-variant' : ''}`}
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
                            className="bg-surface-container-low border border-primary/30 text-sm px-3 py-1.5 rounded-full outline-none focus:ring-2 focus:ring-primary/20 min-w-[120px]"
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
            {error && <p className="text-[10px] text-error px-2">{error}</p>}
        </section>
    );
}

export default function MasterDataPage() {
    return (
        <div className="p-8 pb-20 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Arquitectura de Datos</h2>
                    <p className="text-on-surface-variant font-medium">
                        Organiza los cimientos de la base de datos empresarial. Administra sectores, verticales y el diccionario de datos.
                    </p>
                </div>
            </div>

            {/* Distributed Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <MasterDataLedger
                    title="Sectores"
                    singularTitle="Sector"
                    icon="category"
                    fetchApi={masterDataApi.getSectors}
                    createApi={masterDataApi.createSector}
                    deleteApi={masterDataApi.deleteSector}
                />
                <MasterDataLedger
                    title="Verticales"
                    singularTitle="Vertical"
                    icon="layers"
                    fetchApi={masterDataApi.getVerticals}
                    createApi={masterDataApi.createVertical}
                    deleteApi={masterDataApi.deleteVertical}
                />
                <MasterDataLedger
                    title="Productos"
                    singularTitle="Producto"
                    icon="inventory_2"
                    fetchApi={masterDataApi.getProducts}
                    createApi={masterDataApi.createProduct}
                    deleteApi={masterDataApi.deleteProduct}
                />
                <MasterDataLedger
                    title="Cargos"
                    singularTitle="Cargo"
                    icon="badge"
                    fetchApi={masterDataApi.getCargos}
                    createApi={masterDataApi.createCargo}
                    deleteApi={masterDataApi.deleteCargo}
                />
                <MasterDataLedger
                    title="Campañas"
                    singularTitle="Campaña"
                    icon="campaign"
                    fetchApi={masterDataApi.getCampaigns}
                    createApi={masterDataApi.createCampaign}
                    deleteApi={masterDataApi.deleteCampaign}
                />
            </div>
        </div>
    );
}
