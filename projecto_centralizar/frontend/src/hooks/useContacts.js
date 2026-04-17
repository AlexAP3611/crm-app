import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client'
import { useDebounce } from './useDebounce'
import { useQueryParams } from './useQueryParams'

const BLANK_FILTERS = {
    sector_id: '',
    vertical_id: '',
    campaign_id: '',
    product_id: '',
    cargo_id: '',
    search: '',
    contacto_nombre: '',
    empresa_id: '',
    empresa_sector: '',
    empresa_numero_empleados_min: '',
    empresa_numero_empleados_max: '',
    cnae: '',
    email: '',
    page: 1,
    page_size: 50,
}

export function useContacts() {
    const { params, setQueryParams, clearQueryParams, removeQueryParam } = useQueryParams()
    
    // Parse page and page_size explicitly to numbers
    const initialFilters = { ...BLANK_FILTERS, ...params }
    if (initialFilters.page) initialFilters.page = Number(initialFilters.page)
    if (initialFilters.page_size) initialFilters.page_size = Number(initialFilters.page_size)
    
    const [filters, setFilters] = useState(initialFilters)
    const [contacts, setContacts] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const abortControllerRef = useRef(null)
    
    // Debounce the entire filters object
    const debouncedFilters = useDebounce(filters, 400)

    const fetch = useCallback(async (f) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        
        setLoading(true)
        setError(null)
        try {
            const data = await api.listContacts(f, abortControllerRef.current.signal)
            setContacts(data.items || [])
            setTotal(data.total || 0)
        } catch (e) {
            if (e.name === 'AbortError' || e.message === 'AbortError') return;
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])
    
    useEffect(() => {
        setQueryParams(debouncedFilters)
        fetch(debouncedFilters)
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort()
        }
    }, [debouncedFilters, fetch, setQueryParams])
    
    const updateFilter = useCallback((key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
    }, [])
    
    const removeFilter = useCallback((key, clearAll = false) => {
        if (clearAll) {
            setFilters({ ...BLANK_FILTERS })
            clearQueryParams()
        } else {
            updateFilter(key, '')
            removeQueryParam(key)
        }
    }, [updateFilter, clearQueryParams, removeQueryParam])

    const setPage = useCallback((page) => {
        setFilters((prev) => ({ ...prev, page }))
    }, [])

    const setPageSize = useCallback((size) => {
        setFilters((prev) => ({ ...prev, page_size: size, page: 1 }))
    }, [])

    const refresh = useCallback(() => fetch(debouncedFilters), [debouncedFilters, fetch])

    return { contacts, total, loading, error, filters, updateFilter, removeFilter, setPage, setPageSize, refresh }
}

export function useLookups() {
    const [sectors, setSectors] = useState([])
    const [verticals, setVerticals] = useState([])
    const [campaigns, setCampaigns] = useState([])
    const [products, setProducts] = useState([])
    const [cargos, setCargos] = useState([])

    useEffect(() => {
        api.listSectors().then(setSectors).catch(() => { })
        api.listVerticals().then(setVerticals).catch(() => { })
        api.listCampaigns().then(setCampaigns).catch(() => { })
        api.listProducts().then(setProducts).catch(() => { })
        api.listCargos().then(setCargos).catch(() => { })
    }, [])

    return { sectors, verticals, campaigns, products, cargos }
}
