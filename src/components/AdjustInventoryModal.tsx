import React, { useState, useEffect, useRef } from 'react';
import { Location, Product } from '../types';
import { api } from '../services/api';

interface AdjustInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  products: Product[];
  selectedLocationId?: string;
  preselectedProduct?: Product | null;
  onSuccess: () => void;
}

export const AdjustInventoryModal: React.FC<AdjustInventoryModalProps> = ({
  isOpen,
  onClose,
  locations,
  products,
  selectedLocationId,
  preselectedProduct,
  onSuccess,
}) => {
  const [locationId, setLocationId] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [mode, setMode] = useState<'delta' | 'physical'>('delta');
  const [adjustmentValue, setAdjustmentValue] = useState<number | ''>('');
  const [physicalCount, setPhysicalCount] = useState<number | ''>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [fetchingStock, setFetchingStock] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const physicalProducts = products.filter(
    (p) => p.saleType !== 'KIT' && p.active && p.tracksInventory,
  );

  useEffect(() => {
    if (isOpen) {
      const activeLocations = locations.filter((l) => l.active);
      const defaultLoc =
        selectedLocationId && selectedLocationId !== 'all'
          ? selectedLocationId
          : activeLocations[0]?.id || '';
      setLocationId(defaultLoc);

      if (preselectedProduct) {
        setSelectedProductId(preselectedProduct.id);
        setBarcodeInput(preselectedProduct.barcode || preselectedProduct.sku);
      } else {
        setSelectedProductId('');
        setBarcodeInput('');
      }

      setMode('delta');
      setAdjustmentValue('');
      setPhysicalCount('');
      setReason('');
      setNotes('');
      setError(null);

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, selectedLocationId, preselectedProduct, locations]);

  // Fetch current stock
  useEffect(() => {
    if (!locationId || !selectedProductId) {
      setCurrentStock(null);
      return;
    }

    let isMounted = true;
    setFetchingStock(true);
    api
      .getInventoryStock({ locationId, q: '' })
      .then((stocks) => {
        if (!isMounted) return;
        const found = stocks.find((s) => s.productId === selectedProductId);
        setCurrentStock(found ? found.quantity : 0);
      })
      .catch(() => {
        if (isMounted) setCurrentStock(0);
      })
      .finally(() => {
        if (isMounted) setFetchingStock(false);
      });

    return () => {
      isMounted = false;
    };
  }, [locationId, selectedProductId]);

  if (!isOpen) return null;

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim().toLowerCase();
      if (!code) return;

      const matched = physicalProducts.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === code) ||
          p.sku.toLowerCase() === code,
      );

      if (matched) {
        setSelectedProductId(matched.id);
        setError(null);
        setTimeout(() => {
          valueInputRef.current?.focus();
          valueInputRef.current?.select();
        }, 50);
      } else {
        setError(`No se encontró ningún producto con código: "${barcodeInput}"`);
      }
    }
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setError(null);
    const prod = physicalProducts.find((p) => p.id === productId);
    if (prod) {
      setBarcodeInput(prod.barcode || prod.sku);
      setTimeout(() => {
        valueInputRef.current?.focus();
      }, 50);
    }
  };

  const prevStock = currentStock ?? 0;

  // Calculate delta depending on mode
  let computedDelta = 0;
  if (mode === 'delta') {
    computedDelta =
      typeof adjustmentValue === 'number'
        ? adjustmentValue
        : Number(adjustmentValue || '0') || 0;
  } else {
    const phys =
      typeof physicalCount === 'number'
        ? physicalCount
        : Number(physicalCount || '0') || 0;
    computedDelta = phys - prevStock;
  }

  const resultingStock = prevStock + computedDelta;
  const isNegativeResult = resultingStock < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!locationId) {
      setError('Selecciona una tienda o almacén');
      return;
    }
    if (!selectedProductId) {
      setError('Selecciona un producto');
      return;
    }
    if (computedDelta === 0) {
      setError('El ajuste debe ser distinto de 0 para generar un cambio');
      return;
    }
    if (!Number.isInteger(computedDelta)) {
      setError('La cantidad de inventario debe ser un número entero.');
      return;
    }
    if (!reason.trim()) {
      setError('Debes especificar el motivo del ajuste');
      return;
    }

    setLoading(true);
    try {
      await api.adjustInventory({
        locationId,
        productId: selectedProductId,
        adjustmentQuantity: computedDelta,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al procesar el ajuste de inventario');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = physicalProducts.find((p) => p.id === selectedProductId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-600/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">tune</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                Ajustar Inventario
              </h3>
              <p className="text-xs text-slate-500">
                Corrección por conteo físico, mermas o diferencias de stock.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Location Selector */}
          <div>
            <label htmlFor="adjust-inventory-location" className="block text-xs font-bold text-slate-700 mb-1">
              Tienda / Almacén *
            </label>
            <select
              id="adjust-inventory-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            >
              <option value="">Seleccionar ubicación...</option>
              {locations
                .filter((l) => l.active)
                .map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type === 'STORE' ? 'Tienda' : 'Almacén'})
                  </option>
                ))}
            </select>
          </div>

          {/* Barcode Fast Scanner */}
          <div>
            <label htmlFor="adjust-inventory-barcode" className="block text-xs font-bold text-slate-700 mb-1">
              Código de Barra o SKU (Lector / Rápido)
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                barcode_scanner
              </span>
              <input
                id="adjust-inventory-barcode"
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Escanea o escribe código y presiona Enter..."
                className="w-full pl-9 pr-16 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                ENTER ↵
              </span>
            </div>
          </div>

          {/* Manual Product Selector */}
          <div>
            <label htmlFor="adjust-inventory-product" className="block text-xs font-bold text-slate-700 mb-1">
              Seleccionar Producto *
            </label>
            <select
              id="adjust-inventory-product"
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            >
              <option value="">Selecciona un producto del catálogo...</option>
              {physicalProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.sku}]
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Snapshot Card */}
          {selectedProduct && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">{selectedProduct.name}</p>
                <p className="text-[11px] font-mono text-slate-500">SKU: {selectedProduct.sku}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock Sistema</span>
                <span className="text-xs font-bold font-mono text-slate-800">
                  {fetchingStock ? '...' : `${prevStock} unidades`}
                </span>
              </div>
            </div>
          )}

          {/* Mode Switcher */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tipo de Cálculo de Ajuste
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('delta')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                  mode === 'delta'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Ajuste Directo (+ / -)
              </button>
              <button
                type="button"
                onClick={() => setMode('physical')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                  mode === 'physical'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Conteo Físico Real
              </button>
            </div>
          </div>

          {/* Value Input */}
          {mode === 'delta' ? (
            <div>
              <label htmlFor="adjust-inventory-value" className="block text-xs font-bold text-slate-700 mb-1">
                Cantidad de Ajuste (+ positivo / - negativo) *
              </label>
              <input
                id="adjust-inventory-value"
                ref={valueInputRef}
                type="number"
                step="1"
                value={adjustmentValue}
                onChange={(e) =>
                  setAdjustmentValue(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Ej. +5 o -3"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          ) : (
            <div>
              <label htmlFor="adjust-inventory-value" className="block text-xs font-bold text-slate-700 mb-1">
                Conteo Físico Encontrado (Unidades Reales) *
              </label>
              <input
                id="adjust-inventory-value"
                ref={valueInputRef}
                type="number"
                step="1"
                value={physicalCount}
                onChange={(e) =>
                  setPhysicalCount(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder={`Stock sistema: ${prevStock}. Escribe conteo físico...`}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          )}

          {/* Reason Input (Obligatorio) */}
          <div>
            <label htmlFor="adjust-inventory-reason" className="block text-xs font-bold text-slate-700 mb-1">
              Motivo del Ajuste *
            </label>
            <input
              id="adjust-inventory-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Conteo físico mensual, merma por rotura, vencimiento..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            />
          </div>

          {/* Notes Optional */}
          <div>
            <label htmlFor="adjust-inventory-notes" className="block text-xs font-bold text-slate-700 mb-1">
              Notas Adicionales (Opcional)
            </label>
            <input
              id="adjust-inventory-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales para la auditoría..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Preview Panel */}
          {selectedProduct && computedDelta !== 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-700">
                <span>Stock Anterior: <strong>{prevStock}</strong></span>
                <span>
                  Ajuste:{' '}
                  <strong className={computedDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {computedDelta > 0 ? `+${computedDelta}` : computedDelta}
                  </strong>
                </span>
                <span>
                  Stock Resultante:{' '}
                  <strong
                    className={`text-sm font-black ${
                      isNegativeResult
                        ? 'text-rose-600'
                        : resultingStock === 0
                        ? 'text-slate-600'
                        : 'text-indigo-600'
                    }`}
                  >
                    {resultingStock}
                  </strong>
                </span>
              </div>

              {/* Negative Stock Warning Banner (Non-blocking) */}
              {isNegativeResult && (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">
                    warning
                  </span>
                  <div>
                    <span className="font-bold">Advertencia de Stock Negativo:</span> Este ajuste
                    dejará el inventario en{' '}
                    <span className="font-mono font-bold text-rose-700">{resultingStock}</span>{' '}
                    unidades. El sistema permite stock negativo para reflejar faltantes físicos y no
                    bloquea la operación.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedProductId || computedDelta === 0 || !reason.trim()}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>Confirmar Ajuste</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
