export default function CampaignCard({ campaign, onEdit, onDelete }) {
    // Determine badge color based on status
    let statusBadgeClass = 'badge-muted'
    if (campaign.estado === 'Activa') statusBadgeClass = 'badge-success'
    if (campaign.estado === 'Planeada') statusBadgeClass = 'badge-primary'
    if (campaign.estado === 'Cancelada') statusBadgeClass = 'badge-danger'
    if (campaign.estado === 'Finalizada') statusBadgeClass = 'badge-muted'

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{campaign.nombre}</h3>
                    <span className={`badge ${statusBadgeClass}`}>{campaign.estado}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onEdit(campaign)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(campaign)}>Eliminar</button>
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {campaign.tipo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <strong>Tipo:</strong> 
                        {campaign.tipo.split(',').map(t => (
                            <span key={t.trim()} className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{t.trim()}</span>
                        ))}
                    </div>
                )}
                <div><strong>Inicio:</strong> {new Date(campaign.fecha_inicio).toLocaleDateString()}</div>
                {campaign.fecha_fin && <div><strong>Fin:</strong> {new Date(campaign.fecha_fin).toLocaleDateString()}</div>}
                {campaign.presupuesto != null && <div><strong>Presupuesto:</strong> {campaign.presupuesto} €</div>}
                {campaign.canal && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <strong>Canal:</strong> 
                        {campaign.canal.split(',').map(c => (
                            <span key={c.trim()} className="badge badge-muted" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{c.trim()}</span>
                        ))}
                    </div>
                )}
                {campaign.responsable && <div><strong>Responsable:</strong> {campaign.responsable}</div>}
            </div>

            {campaign.objetivo && (
                <div style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                    <strong>Objetivo:</strong> {campaign.objetivo}
                </div>
            )}
        </div>
    )
}
