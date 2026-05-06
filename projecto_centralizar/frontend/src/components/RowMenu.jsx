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
                className="row-menu-trigger w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 transition-colors"
                onClick={handleToggle}
                title="Acciones"
            >
                <span className="material-symbols-outlined text-stone-500 text-lg">more_vert</span>
            </button>
            {open && createPortal(
                <div className="row-menu-dropdown animate-in fade-in zoom-in-95 duration-200" ref={menuRef} style={{ top: coords.top, left: coords.left - 60, position: 'absolute' }}>
                    <button onClick={() => { setOpen(false); onEdit() }}>
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Editar
                    </button>
                    <button className="danger" onClick={() => { setOpen(false); onDelete() }}>
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Eliminar
                    </button>
                </div>,
                document.body
            )}
        </div>
    )
}
