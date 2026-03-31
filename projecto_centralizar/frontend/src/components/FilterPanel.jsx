export default function FilterPanel({ filters, onFilterChange, sectors, verticals, campaigns, products, cargos }) {
    return (
        <div className="filter-bar">
            <div className="form-group">
                <select
                    id="filter-sector"
                    className="form-control"
                    value={filters.sector_id}
                    onChange={(e) => onFilterChange('sector_id', e.target.value)}
                >
                    <option value="">Todos los Sectores</option>
                    {sectors.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <select
                    id="filter-vertical"
                    className="form-control"
                    value={filters.vertical_id}
                    onChange={(e) => onFilterChange('vertical_id', e.target.value)}
                >
                    <option value="">Todas las Verticales</option>
                    {verticals.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <select
                    id="filter-product"
                    className="form-control"
                    value={filters.product_id || ''}
                    onChange={(e) => onFilterChange('product_id', e.target.value)}
                >
                    <option value="">Todos los Productos</option>
                    {(products || []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <select
                    id="filter-cargo"
                    className="form-control"
                    value={filters.cargo_id || ''}
                    onChange={(e) => onFilterChange('cargo_id', e.target.value)}
                >
                    <option value="">Todos los Cargos</option>
                    {(cargos || []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <select
                    id="filter-campaign"
                    className="form-control"
                    value={filters.campaign_id}
                    onChange={(e) => onFilterChange('campaign_id', e.target.value)}
                >
                    <option value="">Todas las Campañas</option>
                    {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <button
                    id="filter-reset"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                        ['search', 'sector_id', 'vertical_id', 'campaign_id', 'product_id', 'cargo_id'].forEach((k) =>
                            onFilterChange(k, '')
                        )
                    }
                >
                    Reset
                </button>
            </div>
        </div>
    )
}
