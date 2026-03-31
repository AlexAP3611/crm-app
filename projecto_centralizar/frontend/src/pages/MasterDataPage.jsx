import { useState, useEffect, useCallback } from "react";
import { masterDataApi } from "../api/masterData";

// Reusable card for each master data section
function MasterDataCard({ title, description, placeholder, fetchApi, createApi, deleteApi }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchApi();
            setItems(data);
        } catch (err) {
            setError("Error al cargar los datos");
        } finally {
            setLoading(false);
        }
    }, [fetchApi]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAdd = async (e) => {
        e.preventDefault();
        const trimmed = inputValue.trim();

        if (!trimmed) {
            setError("El nombre no puede estar vacío");
            return;
        }

        // Client-side duplicate check (case-insensitive)
        const exists = items.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            setError("Este valor ya existe");
            return;
        }

        try {
            setError(null);
            setSaving(true);
            await createApi({ name: trimmed });
            setInputValue("");
            await loadData();
        } catch (err) {
            setError(err.message || "Error al añadir");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        try {
            setError(null);
            await deleteApi(id);
            await loadData();
        } catch (err) {
            setError(err.message || "Error al eliminar (puede que esté en uso)");
        }
    };

    return (
        <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px" }}>
            <div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 4px 0" }}>{title}</h2>
                <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: "0.875rem" }}>{description}</p>
            </div>

            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignContent: "flex-start",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginTop: "24px",
                    marginBottom: "32px",
                }}
            >
                {loading ? (
                    <span style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>Cargando…</span>
                ) : items.length === 0 ? (
                    <span style={{ color: "var(--color-text-muted)", fontStyle: "italic", fontSize: "0.875rem" }}>
                        No hay valores aún.
                    </span>
                ) : (
                    items.map((item) => (
                        <span
                            key={item.id}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                backgroundColor: "var(--color-bg)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "999px",
                                padding: "4px 10px 4px 12px",
                                fontSize: "0.875rem",
                                maxWidth: "100%",
                            }}
                        >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.name}
                            </span>
                            <button
                                type="button"
                                title={`Eliminar "${item.name}"`}
                                onClick={() => handleDelete(item.id, item.name)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "var(--color-text-muted)",
                                    padding: "0 2px",
                                    lineHeight: 1,
                                    fontSize: "1.1rem",
                                    flexShrink: 0,
                                }}
                            >
                                ×
                            </button>
                        </span>
                    ))
                )}
            </div>

            {error && (
                <div className="alert alert-error" style={{ padding: "8px 12px", fontSize: "0.875rem", marginBottom: "12px" }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleAdd} style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                <input
                    type="text"
                    className="form-control"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        if (error) setError(null);
                    }}
                    style={{ flex: 1 }}
                    disabled={saving}
                />
                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: "0 18px", fontWeight: 700, fontSize: "1.25rem" }}
                    disabled={saving}
                >
                    +
                </button>
            </form>
        </div>
    );
}

// Separate card for Campañas — uses `nombre` field (not `name`)
function CampaignMasterCard() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await masterDataApi.getCampaigns();
            setItems(data);
        } catch (err) {
            setError("Error al cargar las campañas");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = async (e) => {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) { setError("El nombre no puede estar vacío"); return; }
        const exists = items.find(i => i.nombre.toLowerCase() === trimmed.toLowerCase());
        if (exists) { setError("Esta campaña ya existe"); return; }
        try {
            setError(null);
            setSaving(true);
            await masterDataApi.createCampaign({ nombre: trimmed });
            setInputValue("");
            await loadData();
        } catch (err) {
            setError(err.message || "Error al añadir");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, nombre) => {
        try {
            setError(null);
            await masterDataApi.deleteCampaign(id);
            await loadData();
        } catch (err) {
            setError(err.message || "Error al eliminar (puede que esté en uso)");
        }
    };

    return (
        <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px" }}>
            <div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 4px 0" }}>Campañas</h2>
                <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: "0.875rem" }}>
                    Gestiona las campañas disponibles para asignar a contactos
                </p>
            </div>

            <div
                style={{
                    flex: 1, display: "flex", alignContent: "flex-start", flexWrap: "wrap",
                    gap: "8px", marginTop: "24px", marginBottom: "32px"
                }}
            >
                {loading ? (
                    <span style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>Cargando…</span>
                ) : items.length === 0 ? (
                    <span style={{ color: "var(--color-text-muted)", fontStyle: "italic", fontSize: "0.875rem" }}>
                        No hay campañas aún.
                    </span>
                ) : (
                    items.map(item => (
                        <span
                            key={item.id}
                            style={{
                                display: "inline-flex", alignItems: "center", gap: "6px",
                                backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)",
                                borderRadius: "999px", padding: "4px 10px 4px 12px",
                                fontSize: "0.875rem", maxWidth: "100%",
                            }}
                        >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.nombre}
                            </span>
                            <button
                                type="button"
                                title={`Eliminar "${item.nombre}"`}
                                onClick={() => handleDelete(item.id, item.nombre)}
                                style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    color: "var(--color-text-muted)", padding: "0 2px",
                                    lineHeight: 1, fontSize: "1.1rem", flexShrink: 0,
                                }}
                            >×</button>
                        </span>
                    ))
                )}
            </div>

            {error && (
                <div className="alert alert-error" style={{ padding: "8px 12px", fontSize: "0.875rem", marginBottom: "12px" }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleAdd} style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                <input
                    type="text"
                    className="form-control"
                    placeholder="Nueva campaña…"
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); if (error) setError(null); }}
                    style={{ flex: 1 }}
                    disabled={saving}
                />
                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: "0 18px", fontWeight: 700, fontSize: "1.25rem" }}
                    disabled={saving}
                >
                    +
                </button>
            </form>
        </div>
    );
}

export default function MasterDataPage() {
    return (
        <>
            <div className="page-title-wrap">
                <h1 className="page-title">Datos maestros</h1>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                    gap: "32px",
                    margin: "32px auto 64px",
                    maxWidth: "1400px",
                    alignItems: "stretch"
                }}
            >
                <MasterDataCard
                    title="Sectores"
                    description="Gestiona los sectores de empresa"
                    placeholder="Nuevo sector…"
                    fetchApi={masterDataApi.getSectors}
                    createApi={masterDataApi.createSector}
                    deleteApi={masterDataApi.deleteSector}
                />
                <MasterDataCard
                    title="Verticales o Etiquetas"
                    description="Gestiona las verticales de negocio o etiquetas"
                    placeholder="Nueva vertical o etiqueta…"
                    fetchApi={masterDataApi.getVerticals}
                    createApi={masterDataApi.createVertical}
                    deleteApi={masterDataApi.deleteVertical}
                />
                <MasterDataCard
                    title="Productos"
                    description="Gestiona los productos a ofrecer"
                    placeholder="Nuevo producto…"
                    fetchApi={masterDataApi.getProducts}
                    createApi={masterDataApi.createProduct}
                    deleteApi={masterDataApi.deleteProduct}
                />
                <MasterDataCard
                    title="Cargos"
                    description="Gestiona los cargos de los contactos"
                    placeholder="Nuevo cargo…"
                    fetchApi={masterDataApi.getCargos}
                    createApi={masterDataApi.createCargo}
                    deleteApi={masterDataApi.deleteCargo}
                />
                <CampaignMasterCard />
            </div>
        </>
    );
}
