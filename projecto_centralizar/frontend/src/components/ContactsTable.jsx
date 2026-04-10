import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CONTACT_COLUMNS } from '../config/fields'

import RowMenu from './RowMenu'
import Checkbox from './Checkbox'

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
                            <Checkbox
                                checked={allSelected}
                                onChange={(e) => onSelectAll(e.target.checked)}
                            />
                        </th>
                        {CONTACT_COLUMNS.filter(col => !col.modalOnly).map(col => <th key={col.key}>{col.label}</th>)}
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {contacts.map((c) => (
                        <tr key={c.id}>
                            <td className="td-checkbox">
                                <Checkbox
                                    checked={selectedIds.includes(c.id)}
                                    onChange={(e) => onSelect(c.id, e.target.checked)}
                                />
                            </td>
                            {CONTACT_COLUMNS.filter(col => !col.modalOnly).map(col => {
                                if (col.type === 'string') {
                                    return <td key={col.key}>
                                        {col.key === 'company' ? (
                                            <><strong>{c.company}</strong><div className="td-muted">#{c.id}</div></>
                                        ) : col.key.includes('email') ? (
                                            c[col.key] ? c[col.key] : <span className="td-muted">—</span>
                                        ) : c[col.key] ? c[col.key] : <span className="td-muted">—</span>}
                                    </td>
                                } else if (col.type === 'link') {
                                    return <td key={col.key}>
                                        {c[col.key]
                                            ? <a href={c[col.key]} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', fontSize: '0.8rem' }}>{col.key === 'web' ? c[col.key].replace(/^https?:\/\//, '') : 'Link'}</a>
                                            : <span className="td-muted">—</span>}
                                    </td>
                                } else if (col.type === 'm2m') {
                                    return <td key={col.key}>
                                        {c[col.key]?.length
                                            ? c[col.key].map((item, idx) => (
                                                <span key={item.id || idx} className="badge badge-muted" style={{ marginRight: 4, display: 'inline-block', marginBottom: 4 }}>{item.name || item.nombre}</span>
                                            ))
                                            : <span className="td-muted">—</span>}
                                    </td>
                                }
                                return <td key={col.key}>—</td>
                            })}
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
