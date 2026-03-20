import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

function RowMenu({ onEdit, onDelete }) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef(null)
    const menuRef = useRef(null)
    const [coords, setCoords] = useState({ top: 0, left: 0 })

    useEffect(() => {
        function handleClickOutside(e) {
            const isClickTrigger = triggerRef.current?.contains(e.target)
            const isClickMenu = menuRef.current?.contains(e.target)
            if (!isClickTrigger && !isClickMenu) {
                setOpen(false)
            }
        }
        
        function handleScroll() {
            if (open) setOpen(false)
        }

        document.addEventListener('mousedown', handleClickOutside)
        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleScroll)
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleScroll)
        }
    }, [open])

    const handleToggle = (e) => {
        if (!open) {
            const rect = triggerRef.current.getBoundingClientRect()
            setCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX - 100 // Shift slightly left to align the menu nicely
            })
        }
        setOpen(!open)
    }

    return (
        <div style={{ display: 'inline-block' }}>
            <button
                ref={triggerRef}
                className="row-menu-trigger"
                onClick={handleToggle}
                title="Acciones"
            >
                ⋯
            </button>
            {open && createPortal(
                <div className="row-menu-dropdown" ref={menuRef} style={{ top: coords.top, left: coords.left, position: 'absolute' }}>
                    <button onClick={() => { setOpen(false); onEdit() }}>Editar</button>
                    <button className="danger" onClick={() => { setOpen(false); onDelete() }}>Eliminar</button>
                </div>,
                document.body
            )}
        </div>
    )
}

export default function ContactsTable({
    contacts,
    loading,
    onEdit,
    onDelete,
    selectedIds = [],
    onSelect,
    onSelectAll
}) {
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '60px' }}>
                <div className="spinner" />
            </div>
        )
    }

    if (!contacts.length) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <p>No se encontraron contactos. Ajusta los filtros o añade un nuevo contacto.</p>
            </div>
        )
    }

    const allSelected = contacts.length > 0 && selectedIds.length === contacts.length;

    return (
        <div className="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th className="th-checkbox">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={(e) => onSelectAll(e.target.checked)}
                            />
                        </th>
                        <th>Empresa</th>
                        <th>Nombre</th>
                        <th>Cargo</th>
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Dominio</th>
                        <th>LinkedIn</th>
                        <th>Sector</th>
                        <th>Vertical</th>
                        <th>Productos</th>
                        <th>Campañas</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {contacts.map((c) => (
                        <tr key={c.id}>
                            <td className="td-checkbox">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(c.id)}
                                    onChange={(e) => onSelect(c.id, e.target.checked)}
                                />
                            </td>
                            <td>
                                <strong>{c.company}</strong>
                                <div className="td-muted">#{c.id}</div>
                            </td>
                            <td>{c.first_name || c.last_name ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : <span className="text-muted">—</span>}</td>
                            <td>
                                {c.cargos?.length
                                    ? c.cargos.map((cargo) => (
                                        <span key={cargo.id} className="badge badge-muted" style={{ marginRight: 4 }}>{cargo.name}</span>
                                    ))
                                    : (c.job_title ?? <span className="td-muted">—</span>)}
                            </td>
                            <td>
                                {c.email_contact && <div>{c.email_contact}</div>}
                                {c.email_generic && <div className="td-muted">{c.email_generic}</div>}
                                {!c.email_contact && !c.email_generic && <span className="td-muted">—</span>}
                            </td>
                            <td>{c.phone ?? <span className="td-muted">—</span>}</td>
                            <td>
                                {c.dominio
                                    ? <a href={c.dominio} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', fontSize: '0.8rem' }}>{c.dominio.replace(/^https?:\/\//, '')}</a>
                                    : <span className="td-muted">—</span>}
                            </td>
                            <td>
                                {c.linkedin
                                    ? <a href={c.linkedin} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', fontSize: '0.8rem' }}>LinkedIn</a>
                                    : <span className="td-muted">—</span>}
                            </td>
                            <td>
                                {c.sectors?.length
                                    ? c.sectors.map((s) => (
                                        <span key={s.id} className="badge badge-primary" style={{ marginRight: 4, display: 'inline-block', marginBottom: 4 }}>{s.name}</span>
                                    ))
                                    : <span className="td-muted">—</span>}
                            </td>
                            <td>
                                {c.verticals?.length
                                    ? c.verticals.map((v) => (
                                        <span key={v.id} className="badge badge-accent" style={{ marginRight: 4, display: 'inline-block', marginBottom: 4 }}>{v.name}</span>
                                    ))
                                    : <span className="td-muted">—</span>}
                            </td>
                            <td>
                                {c.products_rel?.length
                                    ? c.products_rel.map((p) => (
                                        <span key={p.id} className="badge badge-muted" style={{ marginRight: 4, display: 'inline-block', marginBottom: 4 }}>{p.name}</span>
                                    ))
                                    : c.products?.length
                                        ? c.products.map((p, i) => (
                                            <span key={i} className="badge badge-muted" style={{ marginRight: 4, display: 'inline-block', marginBottom: 4 }}>{p}</span>
                                        ))
                                        : <span className="td-muted">—</span>}
                            </td>
                            <td>
                                {c.campaigns?.length
                                    ? c.campaigns.map((camp) => (
                                        <span key={camp.id} className="badge badge-muted" style={{ marginRight: 4 }}>{camp.nombre}</span>
                                    ))
                                    : <span className="td-muted">—</span>}
                            </td>
                            <td>
                                <RowMenu onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
