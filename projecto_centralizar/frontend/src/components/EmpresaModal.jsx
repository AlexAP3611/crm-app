import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import MultiSelect from './MultiSelect'
import CustomSelect from './CustomSelect'

function DynamicM2MEditor({ empresaId, type, items, availableOptions, onSuccess }) {
    const [selectedToAssign, setSelectedToAssign] = useState("");
    const [loading, setLoading] = useState(false);

    const handleAssign = async () => {
        if (!selectedToAssign) return;
        setLoading(true);
        try {
            const updated = await api.assignEmpresaRelation(empresaId, type, selectedToAssign);
            onSuccess(updated);
            setSelectedToAssign("");
        } catch (e) {
            alert("Error al asignar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUnassign = async (itemId) => {
        if (!window.confirm("¿Seguro que deseas desasignar este elemento?")) return;
        setLoading(true);
        try {
            const updated = await api.unassignEmpresaRelation(empresaId, type, itemId);
            onSuccess(updated);
        } catch (e) {
            alert("Error al desasignar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const unassignedOptions = availableOptions.filter(o => !items.includes(o.id));

    return (
        <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-4">
                {items.length === 0 && <span className="text-stone-400 text-sm">Ninguno asignado.</span>}
                {items.map(itemId => {
                    const opt = availableOptions.find(o => o.id === itemId);
                    return (
                        <span key={itemId} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-[#006877] text-[10px] font-bold rounded-xl uppercase tracking-wider border border-cyan-100 shadow-sm">
                            {opt ? (opt.name || opt.nombre) : itemId}
                            <span onClick={() => !loading && handleUnassign(itemId)} className="text-cyan-600/50 hover:text-error transition-colors material-symbols-outlined text-[16px] leading-none cursor-pointer" title="Desasignar">close</span>
                        </span>
                    );
                })}
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <CustomSelect 
                        options={unassignedOptions}
                        value={selectedToAssign}
                        onChange={(val) => setSelectedToAssign(val)}
                        placeholder={unassignedOptions.length === 0 ? "Todos asignados" : "Seleccionar para asignar..."}
                    />
                </div>
                <button type="button" className="px-6 py-2.5 font-bold text-white btn-primary-gradient rounded-xl text-sm shadow-md shadow-primary/20 disabled:opacity-50 active:scale-95 flex items-center justify-center whitespace-nowrap transition-all border-0 outline-none" onClick={handleAssign} disabled={!selectedToAssign || loading}>
                    {loading ? <div className="spinner-white w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Asignar'}
                </button>
            </div>
        </div>
    );
}

const EMPTY_FORM = {
    nombre: '', cif: '', email: '', phone: '', web: '',
    sector_ids: [], vertical_ids: [], product_ids: [],
    numero_empleados: '', facturacion: '', cnae: '',
    facebook: '',
    competidores: [
        { posicion: 1, web: '', facebook: '' },
        { posicion: 2, web: '', facebook: '' },
        { posicion: 3, web: '', facebook: '' }
    ],
    provincia_id: '', pais_id: ''
}

export default function EmpresaModal({ mode, data, sectors, verticals, products, paises, provincias, onClose, onSaved }) {
    const [form, setForm] = useState(() => {
        if (!data || Object.keys(data).length === 0) return { ...EMPTY_FORM };
        // Asegurar estructura de competidores incluso si data viene de un listado parcial
        const comps = [1, 2, 3].map(pos => {
            const existing = data.competidores?.find(c => c.posicion === pos);
            return existing ? { ...existing } : { posicion: pos, web: '', facebook: '' };
        });
        return { ...data, competidores: comps };
    })
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState(null)

    // Sync form if data changes (though usually the modal is unmounted/remounted)
    useEffect(() => {
        if (data) {
            // Asegurar que siempre hay 3 competidores (posiciones 1, 2, 3)
            const comps = [1, 2, 3].map(pos => {
                const existing = data.competidores?.find(c => c.posicion === pos);
                return existing ? { ...existing } : { posicion: pos, web: '', facebook: '' };
            });
            setForm({ ...data, competidores: comps });
        }
    }, [data])

    // Limpiar provincia si cambia el país
    useEffect(() => {
        if (form.provincia_id) {
            const prov = provincias.find(p => p.id === Number(form.provincia_id));
            if (prov && prov.pais_id !== Number(form.pais_id)) {
                setForm(prev => ({ ...prev, provincia_id: '' }));
            }
        }
    }, [form.pais_id, provincias])

    const handleChange = (e) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        if (e) e.preventDefault()
        setSaving(true)
        setFormError(null)

        try {
            const payload = {
                nombre: form.nombre,
                cif: form.cif || null,
                email: form.email || null,
                phone: form.phone || null,
                web: form.web || null,
                sector_ids: form.sector_ids || [],
                vertical_ids: form.vertical_ids || [],
                product_ids: form.product_ids || [],
                numero_empleados: (form.numero_empleados !== '' && form.numero_empleados !== null) ? parseInt(form.numero_empleados, 10) : null,
                facturacion: (form.facturacion !== '' && form.facturacion !== null) ? parseFloat(form.facturacion) : null,
                cnae: form.cnae || null,
                facebook: form.facebook || null,
                competidores: form.competidores.filter(c => c.web || c.facebook).map(c => ({
                    posicion: c.posicion,
                    web: c.web || null,
                    facebook: c.facebook || null
                })),
                provincia_id: form.provincia_id ? Number(form.provincia_id) : null,
                pais_id: form.pais_id ? Number(form.pais_id) : null,
            }

            if (mode === 'create') {
                await api.createEmpresa(payload)
            } else {
                await api.updateEmpresa(form.id, payload)
            }

            onSaved()
        } catch (err) {
            setFormError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDynamicM2MSuccess = (updatedEmpresa) => {
        setForm(prev => ({
            ...prev,
            sector_ids: updatedEmpresa.sectors?.map(s => s.id) || [],
            vertical_ids: updatedEmpresa.verticals?.map(v => v.id) || [],
            product_ids: updatedEmpresa.products_rel?.map(p => p.id) || [],
        }))
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md animate-in fade-in duration-300"></div>

            <div className="relative w-full max-w-4xl bg-surface-container-lowest rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-8 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low/50">
                    <div>
                        <h2 className="font-headline text-2xl font-bold text-on-surface">
                            {mode === 'create' ? 'Registrar Nueva Empresa' : 'Editar Perfil de Empresa'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                        <span className="material-symbols-outlined text-on-surface">close</span>
                    </button>
                </div>

                {/* Modal Content - Scrollable */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-12">
                    {formError && <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm font-bold border border-error/20">{formError}</div>}

                    {/* Section: Basic Information */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary">info</span>
                            <h3 className="font-headline font-bold text-lg">Información Básica</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Nombre de Empresa *</label>
                                <input required name="nombre" value={form.nombre || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="ej. Acme Corp" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CIF</label>
                                <input name="cif" value={form.cif || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="B12345678" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Correo Electrónico</label>
                                <input type="email" name="email" value={form.email || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="oficina@empresa.com" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Teléfono</label>
                                <input type="tel" name="phone" value={form.phone || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="+34 900 000 000" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Web</label>
                                <input name="web" value={form.web || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://..." />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Número de Empleados</label>
                                <input type="number" name="numero_empleados" value={form.numero_empleados ?? ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Facturación Anual (€)</label>
                                <input type="number" step="0.01" name="facturacion" value={form.facturacion ?? ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CNAE</label>
                                <input name="cnae" value={form.cnae || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="ej. 6201" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">País</label>
                                <div className="relative">
                                    <select 
                                        name="pais_id" 
                                        value={form.pais_id || ''} 
                                        onChange={handleChange} 
                                        className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
                                    >
                                        <option value="">Seleccionar país...</option>
                                        {paises.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">expand_more</span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={`text-[10px] font-bold uppercase tracking-wider ${!form.pais_id ? 'text-on-surface-variant/30' : 'text-on-surface-variant'}`}>Provincia</label>
                                <div className="relative">
                                    <select 
                                        name="provincia_id" 
                                        value={form.provincia_id || ''} 
                                        onChange={handleChange} 
                                        disabled={!form.pais_id}
                                        className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none appearance-none disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Seleccionar provincia...</option>
                                        {provincias
                                            .filter(p => p.pais_id === Number(form.pais_id))
                                            .map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">expand_more</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <hr className="border-outline-variant/30" />

                    {/* Section: Social & Competitors */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary">hub</span>
                            <h3 className="font-headline font-bold text-lg">Social y Competencia</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Facebook URL Empresa</label>
                                <input name="facebook" value={form.facebook || ''} onChange={handleChange} className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" placeholder="https://facebook.com/..." />
                            </div>
                            
                            {form.competidores?.map((comp, idx) => (
                                <React.Fragment key={comp.posicion}>
                                    <div className="md:col-span-2 mt-2">
                                        <h4 className="text-[11px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">{comp.posicion}</span>
                                            Competidor {comp.posicion}
                                        </h4>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Web</label>
                                        <input 
                                            value={comp.web || ''} 
                                            onChange={(e) => {
                                                const newComps = [...form.competidores];
                                                newComps[idx] = { ...newComps[idx], web: e.target.value };
                                                setForm(prev => ({ ...prev, competidores: newComps }));
                                            }} 
                                            className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
                                            placeholder="https://..." 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Facebook</label>
                                        <input 
                                            value={comp.facebook || ''} 
                                            onChange={(e) => {
                                                const newComps = [...form.competidores];
                                                newComps[idx] = { ...newComps[idx], facebook: e.target.value };
                                                setForm(prev => ({ ...prev, competidores: newComps }));
                                            }} 
                                            className="w-full bg-surface-container-low border-none text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
                                            placeholder="https://facebook.com/..." 
                                        />
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    </section>

                    <hr className="border-outline-variant/30" />

                    {/* Section: Industry Taxonomy */}
                    <div className="space-y-12">
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-stone-500">category</span>
                                <h3 className="font-headline font-bold text-lg text-on-surface">Sectores</h3>
                            </div>
                            <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                {mode === 'create' ? (
                                    <MultiSelect
                                        options={sectors}
                                        selectedIds={form.sector_ids || []}
                                        onChange={(ids) => handleChange({ target: { name: 'sector_ids', value: ids } })}
                                        placeholder="Asignar sectores..."
                                    />
                                ) : (
                                    <DynamicM2MEditor
                                        empresaId={form.id}
                                        type="sectors"
                                        items={form.sector_ids || []}
                                        availableOptions={sectors}
                                        onSuccess={handleDynamicM2MSuccess}
                                    />
                                )}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-stone-500">account_tree</span>
                                <h3 className="font-headline font-bold text-lg text-on-surface">Verticales de Negocio</h3>
                            </div>
                            <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                {mode === 'create' ? (
                                    <MultiSelect
                                        options={verticals}
                                        selectedIds={form.vertical_ids || []}
                                        onChange={(ids) => handleChange({ target: { name: 'vertical_ids', value: ids } })}
                                        placeholder="Asignar verticales..."
                                    />
                                ) : (
                                    <DynamicM2MEditor
                                        empresaId={form.id}
                                        type="verticals"
                                        items={form.vertical_ids || []}
                                        availableOptions={verticals}
                                        onSuccess={handleDynamicM2MSuccess}
                                    />
                                )}
                            </div>
                        </section>

                        <section className="space-y-4 pb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-stone-500">inventory_2</span>
                                <h3 className="font-headline font-bold text-lg text-on-surface">Productos</h3>
                            </div>
                            <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/20 min-h-[140px]">
                                {mode === 'create' ? (
                                    <MultiSelect
                                        options={products}
                                        selectedIds={form.product_ids || []}
                                        onChange={(ids) => handleChange({ target: { name: 'product_ids', value: ids } })}
                                        placeholder="Asignar productos..."
                                    />
                                ) : (
                                    <DynamicM2MEditor
                                        empresaId={form.id}
                                        type="products"
                                        items={form.product_ids || []}
                                        availableOptions={products}
                                        onSuccess={handleDynamicM2MSuccess}
                                    />
                                )}
                            </div>
                        </section>
                    </div>
                </form>

                {/* Modal Footer */}
                <div className="p-8 bg-surface-container-low border-t border-outline-variant/30 flex justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={saving} className="px-6 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-8 py-3 btn-primary-gradient text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all border-0 outline-none focus:outline-none focus:ring-2 focus:ring-primary/50 hover:brightness-110"
                    >
                        {saving ? 'Guardando...' : (mode === 'create' ? 'Crear Empresa' : 'Guardar Cambios')}
                    </button>
                </div>
            </div>
        </div>
    )
}
