import { useState, useEffect } from 'react'
import { api } from '../api/client'
import CampaignCard from '../components/CampaignCard'
import CampaignModal from '../components/CampaignModal'

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [modal, setModal] = useState(null) // null | 'create' | object

    const fetchCampaigns = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await api.listCampaigns()
            setCampaigns(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCampaigns()
    }, [])

    const handleDelete = async (campaign) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar la campaña "${campaign.nombre}"?`)) return
        try {
            await api.deleteCampaign(campaign.id)
            await fetchCampaigns()
        } catch (err) {
            alert(err.message)
        }
    }

    const handleSave = async (data) => {
        try {
            if (modal === 'create') {
                await api.createCampaign(data)
            } else {
                await api.updateCampaign(modal.id, data)
            }
            setModal(null)
            await fetchCampaigns()
        } catch (err) {
            throw err
        }
    }

    if (loading && campaigns.length === 0) {
        return <div style={{ padding: '24px', textAlign: 'center' }}><div className="spinner" /></div>
    }

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Campañas</h2>
                    <p className="text-on-surface-variant font-medium">
                        Gestiona las campañas de marketing y ventas, presupuestos y responsables.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-primary-gradient text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-transform" onClick={() => setModal('create')}>
                        <span className="material-symbols-outlined">add_circle</span>
                        Nueva Campaña
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-error" style={{ margin: '0 24px 24px' }}>{error}</div>}

            <div style={{ padding: '0 24px 24px' }}>
                {campaigns.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📢</div>
                        <p>No hay campañas configuradas.</p>
                        <button className="btn btn-primary" onClick={() => setModal('create')} style={{ marginTop: '16px' }}>
                            Crear primera campaña
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                        {campaigns.map(c => (
                            <CampaignCard
                                key={c.id}
                                campaign={c}
                                onEdit={(camp) => setModal(camp)}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {modal && (
                <CampaignModal
                    payload={modal === 'create' ? null : modal}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                />
            )}
        </>
    )
}
