import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';

export default function CompanyAutocomplete({ value, onChange }) {
    const [query, setQuery] = useState(value || '');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [options, setOptions] = useState([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const wrapperRef = useRef(null);
    const listRef = useRef(null);
    const limit = 50;

    // Detect click outside to close
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounce typing
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(query);
            setPage(0);
            setOptions([]);
            setHasMore(true);
        }, 300);
        return () => clearTimeout(handler);
    }, [query]);

    // Fetch data when debounced query or page changes
    const fetchCompanies = useCallback(async () => {
        if (!hasMore || (!isOpen && page === 0)) return;
        setLoading(true);
        try {
            const data = await api.listEmpresas({
                q: debouncedQuery || undefined,
                limit,
                offset: page * limit
            });
            if (data.items.length < limit) {
                setHasMore(false);
            }
            setOptions((prev) => page === 0 ? data.items : [...prev, ...data.items]);
        } catch (err) {
            console.error('Failed to fetch companies', err);
        } finally {
            setLoading(false);
        }
    }, [debouncedQuery, page, hasMore, isOpen]);

    useEffect(() => {
        if (isOpen) {
            fetchCompanies();
        }
    }, [debouncedQuery, page, isOpen, fetchCompanies]);

    const handleScroll = () => {
        if (!listRef.current) return;
        const { scrollTop, clientHeight, scrollHeight } = listRef.current;
        if (scrollHeight - scrollTop <= clientHeight + 30 && hasMore && !loading) {
            setPage((prev) => prev + 1);
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        setIsOpen(true);
        // Reset ID when user types manually
        onChange(val, null, null); 
    };

    const handleSelect = (empresa) => {
        setQuery(empresa.nombre);
        setIsOpen(false);
        onChange(empresa.nombre, empresa.id, empresa);
    };

    const handleInputClick = () => {
        setIsOpen(true);
    };

    return (
        <div ref={wrapperRef} className="autocomplete-wrapper" style={{ position: 'relative', width: '100%' }}>
            <input
                id="field-company"
                type="text"
                className="form-control"
                value={query}
                onChange={handleInputChange}
                onClick={handleInputClick}
                onFocus={handleInputClick}
                placeholder="Selecciona o escribe una empresa..."
                required
            />
            {isOpen && (
                <ul
                    ref={listRef}
                    className="autocomplete-dropdown"
                    onScroll={handleScroll}
                >
                    {options.length === 0 && !loading && (
                        <li className="autocomplete-item" style={{ color: 'var(--color-text-muted, #666)' }}>
                            No se encontraron empresas.
                        </li>
                    )}
                    {options.map((emp) => (
                        <li
                            key={emp.id}
                            className={`autocomplete-item ${query === emp.nombre ? 'active' : ''}`}
                            onClick={() => handleSelect(emp)}
                        >
                            {emp.nombre}
                        </li>
                    ))}
                    {loading && (
                        <li className="autocomplete-item" style={{ color: 'var(--color-text-muted, #666)', textAlign: 'center' }}>
                            Cargando...
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
