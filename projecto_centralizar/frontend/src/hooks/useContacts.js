import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export function useContacts() {
    const [contacts, setContacts] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const [filters, setFilters] = useState({
        sector_id: '',
        vertical_id: '',
        campaign_id: '',
        product_id: '',
        cargo_id: '',
        search: '',
        page: 1,
        page_size: 6,
    })

    const fetch = useCallback(async (f = filters) => {
        setLoading(true)
        setError(null)
        try {
            const data = await api.listContacts(f)
            setContacts(data.items)
            setTotal(data.total)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetch(filters) }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

    const updateFilter = useCallback((key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: 1 }))
    }, [])

    const setPage = useCallback((page) => {
        setFilters((prev) => ({ ...prev, page }))
    }, [])

    const refresh = useCallback(() => fetch(filters), [filters, fetch])

    return { contacts, total, loading, error, filters, updateFilter, setPage, refresh }
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
