import React from 'react'

/**
 * Custom Checkbox component following the 'Architectural Ledger' design system.
 * Uses the checked prop directly for visual state (not Tailwind peer-checked:)
 * to ensure reliable rendering in all contexts (tables, modals, dropdowns).
 *
 * Minimalist design with primary color accent on checked state and smooth transitions.
 */
export default function Checkbox({ checked, onChange, label, id, className = "", ...props }) {
    return (
        <label className={`relative inline-flex items-center cursor-pointer select-none group ${className}`}>
            <input 
                type="checkbox"
                id={id}
                className="sr-only"
                checked={checked}
                onChange={onChange}
                {...props}
            />
            {/* Custom Visual Box */}
            <span
                className="checkbox-visual"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: '5px',
                    border: checked ? '2px solid #006877' : '2px solid #9ca3af',
                    background: checked ? '#006877' : 'transparent',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    flexShrink: 0,
                    boxShadow: checked ? '0 1px 3px rgba(0,104,119,0.3)' : 'none',
                }}
            >
                <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none"
                    stroke="white"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                        opacity: checked ? 1 : 0,
                        transform: checked ? 'scale(1)' : 'scale(0.5)',
                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    <path d="M5 13l4 4L19 7" />
                </svg>
            </span>
            {label && <span className="ml-2 text-sm font-medium text-on-surface">{label}</span>}
        </label>
    )
}
