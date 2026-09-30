import React, { useState, useEffect, useRef } from 'react';
import { Product, Department, ProductSaleType } from '../types';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: any) => Promise<void>;
  initialProduct?: Product | null;
  departments: Department[];
  availableComponentProducts: Product[];
  onDeactivateProduct?: (product: Product) => Promise<void>;
  onReactivateProduct?: (product: Product) => Promise<void>;
  zIndexClass?: string;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialProduct,
  departments,
  availableComponentProducts,
  onDeactivateProduct,
  onReactivateProduct,
  zIndexClass = 'z-50',
}) => {
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [saleType, setSaleType] = useState<ProductSaleType>('UNIT');
  const [costPrice, setCostPrice] = useState<number | string>('');
  const [salePrice, setSalePrice] = useState<number | string>('');
  const [wholesalePrice, setWholesalePrice] = useState<number | string>('');
  const [tracksInventory, setTracksInventory] = useState(true);
  const [defaultMinStock, setDefaultMinStock] = useState<number | string>('');
  const [active, setActive] = useState(true);

  // Kit components state
  const [components, setComponents] = useState<
    { componentProductId: string; quantity: number | string }[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const componentsListRef = useRef<HTMLDivElement>(null);

  // Filter products that can be components (strictly UNIT or WEIGHT, and cannot be self)
  const validComponentOptions = availableComponentProducts.filter(
    (p) => p.saleType !== 'KIT' && (!initialProduct || p.id !== initialProduct.id) && p.active,
  );

  useEffect(() => {
    if (initialProduct) {
      setSku(initialProduct.sku);
      setBarcode(initialProduct.barcode || '');
      setName(initialProduct.name);
      setDescription(initialProduct.description || '');
      setDepartmentId(initialProduct.departmentId || '');
      setSaleType(initialProduct.saleType);
      setCostPrice(initialProduct.costPrice || '');
      setSalePrice(initialProduct.salePrice || '');
      setWholesalePrice(initialProduct.wholesalePrice || '');
      setTracksInventory(initialProduct.tracksInventory);
      setDefaultMinStock(initialProduct.defaultMinStock || '');
      setActive(initialProduct.active);

      if (initialProduct.saleType === 'KIT' && initialProduct.components) {
        setComponents(
          initialProduct.components.map((c) => ({
            componentProductId: c.componentProductId,
            quantity: c.quantity,
          })),
        );
      } else {
        setComponents([]);
      }
    } else {
      // New product reset
      setSku(`PRD-${Math.floor(1000 + Math.random() * 9000)}`);
      setBarcode('');
      setName('');
      setDescription('');
      setDepartmentId(departments.length > 0 ? departments[0].id : '');
      setSaleType('UNIT');
      setCostPrice('');
      setSalePrice('');
      setWholesalePrice('');
      setTracksInventory(true);
      setDefaultMinStock(5);
      setActive(true);
      setComponents([]);
    }
    setError(null);
  }, [initialProduct, isOpen, departments]);

  if (!isOpen) return null;

  const handleAddComponent = () => {
    if (validComponentOptions.length === 0) return;
    const firstAvailable =
      validComponentOptions.find(
        (opt) => !components.some((c) => c.componentProductId === opt.id),
      ) || validComponentOptions[0];

    setComponents((prev) => [...prev, { componentProductId: firstAvailable.id, quantity: 1 }]);

    // Desplazar suavemente el contenedor interno hacia el nuevo elemento
    setTimeout(() => {
      if (componentsListRef.current) {
        if (typeof componentsListRef.current.scrollTo === 'function') {
          componentsListRef.current.scrollTo({
            top: componentsListRef.current.scrollHeight,
            behavior: 'smooth',
          });
        } else {
          componentsListRef.current.scrollTop = componentsListRef.current.scrollHeight;
        }
      }
    }, 50);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComponentChange = (
    index: number,
    field: 'componentProductId' | 'quantity',
    value: any,
  ) => {
    setComponents((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!sku.trim()) {
      setError('El código / SKU es obligatorio');
      return;
    }

    if (!name.trim()) {
      setError('La descripción o nombre del producto es obligatorio');
      return;
    }

    if (saleType === 'KIT') {
      if (components.length === 0) {
        setError('Un producto tipo KIT debe tener al menos un componente');
        return;
      }
      for (const comp of components) {
        if (!comp.componentProductId) {
          setError('Debe seleccionar el producto para cada componente');
          return;
        }
        const q = Number(comp.quantity);
        if (isNaN(q) || q <= 0) {
          setError('La cantidad de cada componente debe ser mayor a 0');
          return;
        }
      }
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);
      setError(null);

      const payload: any = {
        sku: sku.trim(),
        barcode: barcode.trim() || null,
        name: name.trim(),
        description: description.trim() || null,
        departmentId: departmentId || null,
        saleType,
        costPrice: costPrice !== '' ? Number(costPrice) : 0,
        salePrice: salePrice !== '' ? Number(salePrice) : 0,
        wholesalePrice: wholesalePrice !== '' ? Number(wholesalePrice) : undefined,
        tracksInventory: saleType === 'KIT' ? false : tracksInventory,
        defaultMinStock: saleType === 'KIT' ? 0 : (defaultMinStock !== '' ? Number(defaultMinStock) : 0),
        active,
      };

      if (saleType === 'KIT') {
        payload.components = components.map((c) => ({
          componentProductId: c.componentProductId,
          quantity: Number(c.quantity),
        }));
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el producto');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm ${zIndexClass}`}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">
                {initialProduct ? 'edit_square' : 'add_box'}
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                {initialProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {initialProduct
                  ? `Modificando catálogo: ${initialProduct.sku}`
                  : 'Registra un nuevo artículo, granel o combo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-3.5 custom-scrollbar">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Identificación y Clasificación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Código / SKU <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ej. REF-001"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Código de Barras (Scanner)
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Escanea o escribe código..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descripción / Nombre del Producto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Harina de Maíz Precocida 1kg"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Departamento / Categoría
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="">-- Sin departamento --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {!d.active ? '(Inactivo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tipo de Venta
                </label>
                <select
                  value={saleType}
                  onChange={(e) => setSaleType(e.target.value as ProductSaleType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="UNIT">Unidad (Entera)</option>
                  <option value="WEIGHT">A Granel / Por Peso (Decimal)</option>
                  <option value="KIT">Kit / Producto Compuesto (Combo)</option>
                </select>
              </div>
            </div>

            {/* Section 2: Precios */}
            <div className="p-3 sm:p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-600">payments</span>
                <span>Esquema de Precios</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Precio Costo ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                    Precio Venta ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Precio Mayoreo ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Control de Inventario (UNIT / WEIGHT only) */}
            {saleType !== 'KIT' && (
              <div className="p-3 sm:p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="tracksInventory"
                    checked={tracksInventory}
                    onChange={(e) => setTracksInventory(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="tracksInventory" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Controlar Existencias / Inventario
                    <p className="text-[11px] font-normal text-slate-500">
                      Desmarca para servicios, fletes o artículos sin control físico.
                    </p>
                  </label>
                </div>

                {tracksInventory && (
                  <div className="w-full sm:w-36">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Stock Mínimo
                    </label>
                    <input
                      type="number"
                      step={saleType === 'WEIGHT' ? '0.001' : '1'}
                      min="0"
                      value={defaultMinStock}
                      onChange={(e) => setDefaultMinStock(e.target.value)}
                      placeholder="Ej. 5"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Section 4: Editor de Componentes Dinámicos para KIT */}
            {saleType === 'KIT' && (
              <div className="p-3 sm:p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col">
                {/* Header de Componentes Siempre Visible */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-indigo-100/80 shrink-0">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-indigo-600">widgets</span>
                        <span>Componentes del Kit / Combo</span>
                      </h4>
                      <span
                        data-testid="kit-components-count"
                        className="px-2 py-0.5 bg-indigo-100/80 text-indigo-700 rounded-full text-[11px] font-bold tracking-tight border border-indigo-200/60 shadow-2xs"
                      >
                        {components.length} {components.length === 1 ? 'componente' : 'componentes'}
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-700/90 mt-0.5">
                      Este kit no tiene stock propio; se calculará a partir de los componentes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddComponent}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-colors shrink-0 self-start sm:self-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Agregar Componente</span>
                  </button>
                </div>

                {/* Contenedor con Altura Controlada (máximo 3 productos como mucho) y Scroll Discreto */}
                <div className="pt-2">
                  {components.length === 0 ? (
                    <div className="p-3 bg-white/70 rounded-xl border border-indigo-200/60 text-center text-xs text-indigo-800">
                      No has agregado componentes aún. Haz clic en <strong>+ Agregar Componente</strong>.
                    </div>
                  ) : (
                    <div
                      ref={componentsListRef}
                      data-testid="kit-components-list-container"
                      className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1.5 overscroll-contain custom-scrollbar"
                    >
                      {components.map((comp, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 shadow-2xs hover:border-indigo-200 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <select
                              value={comp.componentProductId}
                              onChange={(e) =>
                                handleComponentChange(idx, 'componentProductId', e.target.value)
                              }
                              aria-label={`Producto componente ${idx + 1}`}
                              className="w-full h-8 px-2.5 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-400 cursor-pointer truncate"
                            >
                              <option value="">-- Selecciona producto --</option>
                              {validComponentOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  [{opt.sku}] {opt.name} ({opt.saleType === 'WEIGHT' ? 'Kg' : 'Ud'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center justify-between sm:justify-start gap-1.5 shrink-0">
                            <div className="flex items-center gap-1 w-28 sm:w-30">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Cant:</span>
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={comp.quantity}
                                onChange={(e) =>
                                  handleComponentChange(idx, 'quantity', e.target.value)
                                }
                                placeholder="1"
                                aria-label={`Cantidad componente ${idx + 1}`}
                                className="w-full h-8 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-400 font-mono text-center"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(idx)}
                              className="h-8 w-8 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Eliminar componente"
                              aria-label={`Eliminar componente ${idx + 1}`}
                            >
                              <span className="material-symbols-outlined text-[17px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 5: Estado Activo */}
            <div className="flex items-center gap-2.5 pt-0.5">
              <input
                type="checkbox"
                id="activeProduct"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="activeProduct" className="text-xs font-bold text-slate-700 cursor-pointer">
                Producto Activo para venta y catálogo
              </label>
            </div>
          </div>

          {/* Modal Actions Footer - Dedicated Fixed Footer Bar */}
          <div className="px-5 sm:px-6 py-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            {/* Left Action: Desactivar / Reactivar Producto */}
            <div className="shrink-0">
              {initialProduct && (
                initialProduct.active ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      if (onDeactivateProduct) {
                        try {
                          setLoading(true);
                          await onDeactivateProduct(initialProduct);
                          onClose();
                        } catch (err: any) {
                          setError(err.message || 'Error al desactivar el producto');
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Desactivar este producto"
                  >
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    <span>Desactivar Producto</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      if (onReactivateProduct) {
                        try {
                          setLoading(true);
                          await onReactivateProduct(initialProduct);
                          onClose();
                        } catch (err: any) {
                          setError(err.message || 'Error al reactivar el producto');
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Reactivar este producto"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Reactivar Producto</span>
                  </button>
                )
              )}
            </div>

            {/* Right Actions: Cancelar and Guardar/Actualizar */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {loading ? 'hourglass_top' : 'save'}
                </span>
                <span>{loading ? 'Guardando...' : initialProduct ? 'Actualizar Producto' : 'Crear Producto'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
