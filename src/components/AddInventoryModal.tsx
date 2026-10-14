import React, { useState, useEffect, useRef } from 'react';
import { Location, Product } from '../types';
import { api } from '../services/api';

interface AddInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  products: Product[];
  selectedLocationId?: string;
  preselectedProduct?: Product | null;
  onSuccess: () => void;
}

export const AddInventoryModal: React.FC<AddInventoryModalProps> = ({
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
  const [quantity, setQuantity] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [fetchingStock, setFetchingStock] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Filter out kits since kits derive stock from components
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

      setQuantity('');
      setNotes('');
      setError(null);

      // Auto-focus barcode input
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, selectedLocationId, preselectedProduct, locations]);

  // Fetch current stock when location or product changes
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

  // Barcode / Fast scanner Enter key handler
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
        // Focus quantity input immediately
        setTimeout(() => {
          quantityInputRef.current?.focus();
          quantityInputRef.current?.select();
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
        quantityInputRef.current?.focus();
      }, 50);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!locationId) {
      setError('Selecciona una tienda o almacén de destino');
      return;
    }
    if (!selectedProductId) {
      setError('Selecciona o escanea un producto');
      return;
    }
    const numQty = typeof quantity === 'number' ? quantity : Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('La cantidad a agregar debe ser mayor a 0');
      return;
    }
    if (!Number.isInteger(numQty)) {
      setError('La cantidad de inventario debe ser un número entero.');
      return;
    }

    setLoading(true);
    try {
      await api.addInventory({
        locationId,
        productId: selectedProductId,
        quantity: numQty,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al agregar inventario');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = physicalProducts.find((p) => p.id === selectedProductId);
  const numQty = typeof quantity === 'number' ? quantity : Number(quantity) || 0;
  const prevStock = currentStock ?? 0;
  const resultingStock = prevStock + numQty;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">add_box</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                Agregar Inventario
              </h3>
              <p className="text-xs text-slate-500">
                Registra una entrada manual de stock físico con trazabilidad completa.
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
            <label htmlFor="add-inventory-location" className="block text-xs font-bold text-slate-700 mb-1">
              Tienda / Almacén Destino *
            </label>
            <select
              id="add-inventory-location"
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

          {/* Barcode Fast Scanner Field */}
          <div>
            <label htmlFor="add-inventory-barcode" className="block text-xs font-bold text-slate-700 mb-1">
              Código de Barra o SKU (Lector / Rápido)
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                barcode_scanner
              </span>
              <input
                id="add-inventory-barcode"
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Escribe o escanea código y presiona Enter..."
                className="w-full pl-9 pr-16 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                ENTER ↵
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Compatible con pistolas lectoras USB estándar y teclados.
            </p>
          </div>

          {/* Manual Product Selector */}
          <div>
            <label htmlFor="add-inventory-product" className="block text-xs font-bold text-slate-700 mb-1">
              Seleccionar Producto *
            </label>
            <select
              id="add-inventory-product"
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            >
              <option value="">Selecciona un producto del catálogo...</option>
              {physicalProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.sku}] {p.barcode ? `(${p.barcode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Product Stock Card */}
          {selectedProduct && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">{selectedProduct.name}</p>
                <p className="text-[11px] font-mono text-slate-500">
                  SKU: {selectedProduct.sku} {selectedProduct.barcode ? `| Barcode: ${selectedProduct.barcode}` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock Actual</span>
                <span className="text-xs font-bold font-mono text-slate-700">
                  {fetchingStock ? '...' : `${prevStock} unidades`}
                </span>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <label htmlFor="add-inventory-quantity" className="block text-xs font-bold text-slate-700 mb-1">
              Cantidad a Agregar *
            </label>
            <input
              id="add-inventory-quantity"
              ref={quantityInputRef}
              type="number"
              step="1"
              min="1"
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="Ej. 10"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            />
          </div>

          {/* Notes Input */}
          <div>
            <label htmlFor="add-inventory-notes" className="block text-xs font-bold text-slate-700 mb-1">
              Observación / Referencia (Opcional)
            </label>
            <input
              id="add-inventory-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Factura F001-492, reposición de proveedor..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Calculation Preview */}
          {selectedProduct && numQty > 0 && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-between text-xs text-emerald-900">
                <span>Stock Actual: <strong>{prevStock}</strong></span>
                <span>+ Entrada: <strong>{numQty}</strong></span>
                <span>Stock Resultante: <strong className="text-sm font-black text-emerald-700">{resultingStock}</strong></span>
              </div>
            </div>
          )}

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
              disabled={loading || !selectedProductId || numQty <= 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>Confirmar Entrada</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
