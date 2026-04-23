import React, { useState, useRef, useEffect } from 'react';
import Checkbox from './Checkbox';

export default function MultiSelect({ options, selectedIds, onChange, placeholder = "Seleccionar opciones..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearch('');
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleSelection = (id) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(selectedId => selectedId !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const removeSelection = (e, id) => {
        e.stopPropagation(); // prevent opening dropdown
        onChange(selectedIds.filter(selectedId => selectedId !== id));
    };

    const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));
    const filteredOptions = options.filter(opt => 
        (opt.name || opt.nombre || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="multi-select-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {/* The Select Box acting as control */}
            <div 
                className="form-control" 
                style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '4px', 
                    minHeight: '40px', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    padding: '6px 12px'
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                {selectedOptions.length === 0 && (
                    <span style={{ color: 'var(--color-text-faint)', fontSize: '0.85rem' }}>{placeholder}</span>
                )}
                
                {selectedOptions.map(opt => (
                    <span 
                        key={opt.id} 
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: 'var(--color-primary-dark)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '16px',
                            padding: '2px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 500
                        }}
                    >
                        {opt.name || opt.nombre}
                        <span 
                            onClick={(e) => removeSelection(e, opt.id)}
                            style={{ cursor: 'pointer', opacity: 0.7, padding: '0 2px' }}
                        >
                            ✕
                        </span>
                    </span>
                ))}
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div 
                    className="autocomplete-dropdown" 
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        minWidth: '100%',
                        maxHeight: '260px' 
                    }}
                >
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            style={{ 
                                width: '100%', 
                                border: 'none', 
                                outline: 'none', 
                                background: 'transparent',
                                fontSize: '0.85rem'
                            }}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()} // keep open when typing
                            autoFocus
                        />
                    </div>
                    
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--color-text-faint)', textAlign: 'center' }}>
                                No se encontraron opciones.
                            </div>
                        ) : (
                            filteredOptions.map(opt => {
                                const isSelected = selectedIds.includes(opt.id);
                                return (
                                    <div 
                                        key={opt.id}
                                        className={`autocomplete-item ${isSelected ? 'active' : ''}`}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center',
                                            gap: '8px' 
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSelection(opt.id);
                                        }}
                                    >
                                        <Checkbox 
                                            checked={isSelected}
                                            readOnly
                                            style={{ pointerEvents: 'none' }}
                                        />
                                        <span style={{ fontSize: '0.85rem' }}>{opt.name || opt.nombre}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
