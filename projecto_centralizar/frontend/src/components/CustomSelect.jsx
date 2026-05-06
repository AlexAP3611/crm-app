import React, { useState, useRef, useEffect } from 'react';

export default function CustomSelect({ options, value, onChange, placeholder = "Seleccionar..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (id) => {
        onChange(id);
        setIsOpen(false);
    };

    const selectedOption = options.find(opt => opt.id === value);

    return (
        <div className="custom-select-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {/* The Trigger Box */}
            <div 
                className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={!selectedOption ? 'text-on-surface-variant/50' : 'text-on-surface'}>
                    {selectedOption ? (selectedOption.name || selectedOption.nombre) : placeholder}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant text-sm transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                    expand_more
                </span>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <ul 
                    className="autocomplete-dropdown animate-in fade-in zoom-in-95 duration-200" 
                    style={{ 
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        marginTop: '4px',
                        maxHeight: '260px',
                        overflowY: 'auto'
                    }}
                >
                    <li
                        className="autocomplete-item text-xs italic text-on-surface-variant/70 border-b border-outline-variant/10"
                        onClick={() => handleSelect(null)}
                    >
                        — Ninguno —
                    </li>
                    {options.map(opt => {
                        const isSelected = opt.id === value;
                        return (
                            <li 
                                key={opt.id}
                                className={`autocomplete-item ${isSelected ? 'active' : ''}`}
                                onClick={() => handleSelect(opt.id)}
                            >
                                {opt.name || opt.nombre}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
