export default function FilterPanel({ filters, onFilterChange, onClearFilters, sectors, verticals, campaigns, products, cargos }) {
    return (
        <div className="filter-card">
            <div className="filter-section-title" style={{ marginBottom: '16px' }}>
                <svg className="title-icon-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filtros de Búsqueda
            </div>

            <div className="filter-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group">
                    <div className="search-box">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Buscar por nombre de contacto..."
                            value={filters.contacto_nombre || ''}
                            onChange={(e) => onFilterChange('contacto_nombre', e.target.value)}
                        />
                    </div>
                </div>


                <div className="form-group">
                    <div className="search-box">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Buscar por Email..."
                            value={filters.email || ''}
                            onChange={(e) => onFilterChange('email', e.target.value)}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <select id="filter-sector" className="form-control" value={filters.sector_id || ''} onChange={(e) => onFilterChange('sector_id', e.target.value)}>
                        <option value="">Todos los Sectores</option>
                        {sectors.map((s) => <option key={s.id} value={s.id}>{s.name || s.nombre}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <select id="filter-vertical" className="form-control" value={filters.vertical_id || ''} onChange={(e) => onFilterChange('vertical_id', e.target.value)}>
                        <option value="">Todas las Verticales</option>
                        {verticals.map((v) => <option key={v.id} value={v.id}>{v.name || v.nombre}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <select id="filter-product" className="form-control" value={filters.product_id || ''} onChange={(e) => onFilterChange('product_id', e.target.value)}>
                        <option value="">Todos los Productos</option>
                        {(products || []).map((p) => <option key={p.id} value={p.id}>{p.name || p.nombre}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <select id="filter-cargo" className="form-control" value={filters.cargo_id || ''} onChange={(e) => onFilterChange('cargo_id', e.target.value)}>
                        <option value="">Todos los Cargos</option>
                        {(cargos || []).map((c) => <option key={c.id} value={c.id}>{c.name || c.nombre}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <select id="filter-campaign" className="form-control" value={filters.campaign_id || ''} onChange={(e) => onFilterChange('campaign_id', e.target.value)}>
                        <option value="">Todas las Campañas</option>
                        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name || c.nombre}</option>)}
                    </select>
                </div>
            </div>

            <div className="filter-actions" style={{ marginTop: '16px' }}>
                <button
                    id="filter-reset"
                    className="btn btn-secondary"
                    onClick={() => onClearFilters ? onClearFilters() : 
                        ['search', 'contacto_nombre', 'email', 'sector_id', 'vertical_id', 'campaign_id', 'product_id', 'cargo_id', 'empresa_id'].forEach((k) =>
                            onFilterChange(k, '')
                        )
                    }
                >
                    Limpiar Filtros
                </button>
            </div>
        </div>
    )
}
