import React, { useState, useEffect, useRef } from 'react';
import { Location, Product } from '../types';
import { api } from '../services/api';

interface TransferInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  products: Product[];
  selectedLocationId?: string;
  preselectedProduct?: Product | null;
  onSuccess: () => void;
}

export const TransferInventoryModal: React.FC<TransferInventoryModalProps> = ({
  isOpen,
  onClose,
  locations,
  products,
  selectedLocationId,
  preselectedProduct,
  onSuccess,
}) => {
  const [fromLocationId, setFromLocationId] = useState<string>('');
  const [toLocationId, setToLocationId] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [confirmedNegative, setConfirmedNegative] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [fromStock, setFromStock] = useState<number | null>(null);
  const [toStock, setToStock] = useState<number | null>(null);
  const [fetchingStock, setFetchingStock] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const physicalProducts = products.filter(
    (p) => p.saleType !== 'KIT' && p.active && p.tracksInventory,
  );
  const activeLocations = locations.filter((l) => l.active);

  useEffect(() => {
    if (isOpen) {
      const defaultFrom =
        selectedLocationId && selectedLocationId !== 'all'
          ? selectedLocationId
          : activeLocations[0]?.id || '';
      setFromLocationId(defaultFrom);

      // Default destination to a different active location if available
      const defaultTo = activeLocations.find((l) => l.id !== defaultFrom)?.id || '';
      setToLocationId(defaultTo);

      if (preselectedProduct) {
        setSelectedProductId(preselectedProduct.id);
        setBarcodeInput(preselectedProduct.barcode || preselectedProduct.sku);
      } else {
        setSelectedProductId('');
        setBarcodeInput('');
      }

      setQuantity('');
      setNotes('');
      setConfirmedNegative(false);
      setError(null);

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, selectedLocationId, preselectedProduct, locations]);

  // Fetch stocks for both origin and destination
  useEffect(() => {
    if (!selectedProductId) {
      setFromStock(null);
      setToStock(null);
      return;
    }

    let isMounted = true;
    setFetchingStock(true);

    const promises: Promise<any>[] = [];
    if (fromLocationId) {
      promises.push(api.getInventoryStock({ locationId: fromLocationId, q: '' }));
    } else {
      promises.push(Promise.resolve([]));
    }

    if (toLocationId) {
      promises.push(api.getInventoryStock({ locationId: toLocationId, q: '' }));
    } else {
      promises.push(Promise.resolve([]));
    }

    Promise.all(promises)
      .then(([fromStocks, toStocks]) => {
        if (!isMounted) return;
        const sFrom = fromStocks.find((s: any) => s.productId === selectedProductId);
        const sTo = toStocks.find((s: any) => s.productId === selectedProductId);
        setFromStock(sFrom ? sFrom.quantity : 0);
        setToStock(sTo ? sTo.quantity : 0);
      })
      .catch(() => {
        if (isMounted) {
          setFromStock(0);
          setToStock(0);
        }
      })
      .finally(() => {
        if (isMounted) setFetchingStock(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fromLocationId, toLocationId, selectedProductId]);

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

  const numQty = typeof quantity === 'number' ? quantity : Number(quantity) || 0;
  const sourceCurrent = fromStock ?? 0;
  const targetCurrent = toStock ?? 0;
  const sourceResulting = sourceCurrent - numQty;
  const targetResulting = targetCurrent + numQty;

  const originWillBeNegative = fromStock !== null && numQty > 0 && sourceResulting < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fromLocationId) {
      setError('Selecciona la tienda/almacén de origen');
      return;
    }
    if (!toLocationId) {
      setError('Selecciona la tienda/almacén de destino');
      return;
    }
    if (fromLocationId === toLocationId) {
      setError('La ubicación de origen y destino no pueden ser iguales');
      return;
    }
    if (!selectedProductId) {
      setError('Selecciona un producto para transferir');
      return;
    }
    if (numQty <= 0) {
      setError('La cantidad a transferir debe ser mayor a 0');
      return;
    }
    if (!Number.isInteger(numQty)) {
      setError('La cantidad de inventario debe ser un número entero.');
      return;
    }

    if (originWillBeNegative && !confirmedNegative) {
      setError(
        `Esta operación dejará el inventario de origen en ${sourceResulting} unidades. Debes marcar la confirmación explícita para continuar.`,
      );
      return;
    }

    setLoading(true);
    try {
      await api.transferInventory({
        fromLocationId,
        toLocationId,
        productId: selectedProductId,
        quantity: numQty,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al ejecutar la transferencia');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = physicalProducts.find((p) => p.id === selectedProductId);
  const fromLocation = activeLocations.find((l) => l.id === fromLocationId);
  const toLocation = activeLocations.find((l) => l.id === toLocationId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                Transferir Inventario
              </h3>
              <p className="text-xs text-slate-500">
                Movimiento atómico de stock entre tiendas y almacenes.
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

          {/* Locations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="transfer-from-location" className="block text-xs font-bold text-slate-700 mb-1">
                Ubicación Origen *
              </label>
              <select
                id="transfer-from-location"
                value={fromLocationId}
                onChange={(e) => setFromLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              >
                <option value="">Seleccionar origen...</option>
                {activeLocations.map((loc) => (
                  <option key={loc.id} value={loc.id} disabled={loc.id === toLocationId}>
                    {loc.name} ({loc.type === 'STORE' ? 'Tienda' : 'Almacén'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="transfer-to-location" className="block text-xs font-bold text-slate-700 mb-1">
                Ubicación Destino *
              </label>
              <select
                id="transfer-to-location"
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              >
                <option value="">Seleccionar destino...</option>
                {activeLocations.map((loc) => (
                  <option key={loc.id} value={loc.id} disabled={loc.id === fromLocationId}>
                    {loc.name} ({loc.type === 'STORE' ? 'Tienda' : 'Almacén'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Barcode Fast Scanner */}
          <div>
            <label htmlFor="transfer-barcode" className="block text-xs font-bold text-slate-700 mb-1">
              Código de Barra o SKU (Lector / Rápido)
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                barcode_scanner
              </span>
              <input
                id="transfer-barcode"
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
            <label htmlFor="transfer-product" className="block text-xs font-bold text-slate-700 mb-1">
              Seleccionar Producto *
            </label>
            <select
              id="transfer-product"
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

          {/* Selected Product Stock Card */}
          {selectedProduct && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">{selectedProduct.name}</p>
                  <p className="text-[11px] font-mono text-slate-500">SKU: {selectedProduct.sku}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                    {fromLocation?.name || 'Origen'}
                  </span>
                  <span className="font-bold font-mono text-slate-800">
                    {fetchingStock ? '...' : `${sourceCurrent} un.`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
                    {toLocation?.name || 'Destino'}
                  </span>
                  <span className="font-bold font-mono text-slate-800">
                    {fetchingStock ? '...' : `${targetCurrent} un.`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quantity to Transfer */}
          <div>
            <label htmlFor="transfer-quantity" className="block text-xs font-bold text-slate-700 mb-1">
              Cantidad a Transferir *
            </label>
            <input
              id="transfer-quantity"
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

          {/* Notes Optional */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observación / Guía de Remisión (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Traslado para surtir tienda antes de fin de semana..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Transfer Preview Panel */}
          {selectedProduct && numQty > 0 && (
            <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-indigo-950 mb-1">Resultado de la Transferencia</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white rounded-lg border border-indigo-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold truncate">
                    Origen: {fromLocation?.name}
                  </span>
                  <div className="flex items-center gap-1 font-mono text-xs mt-0.5">
                    <span className="text-slate-500">{sourceCurrent}</span>
                    <span className="text-rose-500">-{numQty}</span>
                    <span className="text-slate-400">➔</span>
                    <span className={`font-bold ${sourceResulting < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {sourceResulting}
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-white rounded-lg border border-indigo-100">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold truncate">
                    Destino: {toLocation?.name}
                  </span>
                  <div className="flex items-center gap-1 font-mono text-xs mt-0.5">
                    <span className="text-slate-500">{targetCurrent}</span>
                    <span className="text-emerald-500">+{numQty}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="font-bold text-emerald-700">{targetResulting}</span>
                  </div>
                </div>
              </div>

              {/* Requirement Section 14: Negative Stock During Transfers */}
              {originWillBeNegative && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0 mt-0.5">
                      warning
                    </span>
                    <div>
                      <p className="font-bold">
                        Esta operación dejará el inventario de origen en{' '}
                        <span className="font-mono text-sm underline">{sourceResulting} unidades</span>.
                      </p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        El negocio permite transferencias con stock insuficiente para registrar
                        despachos físicos reales. Por favor confirma explícitamente para proceder.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 border-t border-rose-200/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmedNegative}
                      onChange={(e) => setConfirmedNegative(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-rose-300"
                    />
                    <span className="font-bold text-xs text-rose-900">
                      Entiendo y confirmo dejar el stock de origen en negativo ({sourceResulting})
                    </span>
                  </label>
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
              disabled={
                loading ||
                !selectedProductId ||
                !fromLocationId ||
                !toLocationId ||
                fromLocationId === toLocationId ||
                numQty <= 0 ||
                (originWillBeNegative && !confirmedNegative)
              }
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>Transfiriendo...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                  <span>Confirmar Transferencia</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
