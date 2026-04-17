import React from 'react';

const FILTER_LABELS = {
  search: 'Búsqueda',
  q: 'Búsqueda de Empresa',
  sector: 'Sector',
  vertical: 'Vertical',
  producto: 'Producto',
  cnae: 'CNAE',
  numero_empleados_min: 'Min. Empleados',
  numero_empleados_max: 'Max. Empleados',
  facturacion_min: 'Min. Facturación',
  facturacion_max: 'Max. Facturación',
  sector_id: 'Sector',
  vertical_id: 'Vertical',
  campaign_id: 'Campaña',
  product_id: 'Producto',
  cargo_id: 'Cargo',
  empresa_id: 'Empresa',
  empresa_sector: 'Sector de Empresa',
  empresa_numero_empleados_min: 'Min. Empleados de Empresa',
  empresa_numero_empleados_max: 'Max. Empleados de Empresa',
};

const formatValue = (key, value, optionsMap) => {
  if (!value) return null;
  // If we have an optionsMap (like sector_id -> Name), format it
  if (optionsMap && optionsMap[key] && optionsMap[key][value]) {
    return optionsMap[key][value];
  }
  return value;
};

export const ActiveFilters = ({ filters, onRemove, optionsMap = {} }) => {
  const activeKeys = Object.keys(filters).filter(
    (key) => filters[key] !== null && filters[key] !== undefined && filters[key] !== '' && key !== 'page' && key !== 'page_size' && key !== 'limit' && key !== 'offset'
  );

  if (activeKeys.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4 items-center" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      <span className="text-sm font-medium text-[var(--color-text-secondary)] mr-2" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-muted)', marginRight: '8px' }}>Filtros Activos:</span>
      {activeKeys.map((key) => {
        const value = filters[key];
        let displayValue = formatValue(key, value, optionsMap) || value;
        const label = FILTER_LABELS[key] || key;

        if (key === 'empresa_id') {
             displayValue = `ID: ${filters.empresa_id}`;
        }

        return (
          <div
            key={key}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500, backgroundColor: 'rgba(79, 114, 239, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(79, 114, 239, 0.2)' }}
          >
            <span>
              <span style={{ opacity: 0.75, marginRight: '4px' }}>{label}:</span>
              {displayValue}
            </span>
            <button
              onClick={() => {
                  onRemove(key);
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: '50%' }}
              aria-label={`Remove ${label} filter`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        );
      })}
      
      {activeKeys.length > 1 && (
        <button
          onClick={() => {
            activeKeys.forEach(key => onRemove(key, false));
          }}
          className="text-xs text-[var(--color-text-error)] font-medium hover:underline ml-2"
        >
          Limpiar todos
        </button>
      )}
    </div>
  );
};
