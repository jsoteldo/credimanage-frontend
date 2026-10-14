import React, { useState, useEffect } from 'react';
import { Location, Product } from '../types';
import { api } from '../services/api';

interface SetMinimumStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  product: Product | null;
  locationId?: string;
  initialMinStock?: number;
  currentStock?: number;
  onSuccess: () => void;
}

export const SetMinimumStockModal: React.FC<SetMinimumStockModalProps> = ({
  isOpen,
  onClose,
  locations,
  product,
  locationId: initialLocationId,
  initialMinStock = 0,
  currentStock = 0,
  onSuccess,
}) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [minimumStock, setMinimumStock] = useState<number | ''>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeLocations = locations.filter((l) => l.active);

  useEffect(() => {
    if (isOpen && product) {
      const locId =
        initialLocationId && initialLocationId !== 'all'
          ? initialLocationId
          : activeLocations[0]?.id || '';
      setSelectedLocationId(locId);
      setMinimumStock(initialMinStock);
      setError(null);
    }
  }, [isOpen, product, initialLocationId, initialMinStock, locations]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedLocationId) {
      setError('Selecciona una ubicación');
      return;
    }

    const numMin = typeof minimumStock === 'number' ? minimumStock : Number(minimumStock || '0');
    if (isNaN(numMin) || numMin < 0) {
      setError('El stock mínimo no puede ser negativo');
      return;
    }
    if (!Number.isInteger(numMin)) {
      setError('La cantidad de inventario debe ser un número entero.');
      return;
    }

    setLoading(true);
    try {
      await api.setMinimumStock({
        locationId: selectedLocationId,
        productId: product.id,
        minimumStock: numMin,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar el stock mínimo');
    } finally {
      setLoading(false);
    }
  };

  const numMin = typeof minimumStock === 'number' ? minimumStock : Number(minimumStock || '0') || 0;
  const isBelowMin = currentStock <= numMin && currentStock > 0;
  const isOutOfStock = currentStock === 0;
  const isNegative = currentStock < 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white shadow-md shadow-slate-800/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">low_priority</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                Stock Mínimo por Ubicación
              </h3>
              <p className="text-xs text-slate-500">
                Alerta de reposición personalizada para este punto.
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Product info card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-bold text-slate-900">{product.name}</p>
            <p className="text-[11px] font-mono text-slate-500">
              SKU: {product.sku} {product.barcode ? `| Código: ${product.barcode}` : ''}
            </p>
          </div>

          {/* Location Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tienda / Almacén *
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            >
              <option value="">Seleccionar ubicación...</option>
              {activeLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type === 'STORE' ? 'Tienda' : 'Almacén'})
                </option>
              ))}
            </select>
          </div>

          {/* Minimum Stock Input */}
          <div>
            <label htmlFor="min-stock-input" className="block text-xs font-bold text-slate-700 mb-1">
              Stock Mínimo en esta Ubicación *
            </label>
            <input
              id="min-stock-input"
              type="number"
              step="1"
              min="0"
              value={minimumStock}
              onChange={(e) =>
                setMinimumStock(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="Ej. 10"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Nota: Modificar el stock mínimo no altera las existencias actuales.
            </p>
          </div>

          {/* Live status check */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Stock Físico Actual</span>
              <span className="font-bold font-mono text-slate-900">{currentStock} un.</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Estado Resultante</span>
              {isNegative ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  Stock Negativo
                </span>
              ) : isOutOfStock ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  Sin Stock
                </span>
              ) : isBelowMin ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Stock Bajo
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Stock Normal
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
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
              disabled={loading || !selectedLocationId || numMin < 0}
              className="px-5 py-2 bg-slate-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Guardar Stock Mínimo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
