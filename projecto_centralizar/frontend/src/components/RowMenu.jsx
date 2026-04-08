import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function RowMenu({ onEdit, onDelete }) {
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
