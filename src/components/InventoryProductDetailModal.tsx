import React, { useState, useEffect } from 'react';
import { Product, ProductStockDetail, Location, User } from '../types';
import { api } from '../services/api';
import {
  canAddInventory,
  canAdjustInventory,
  canTransferInventory,
  canManageMinStock,
} from '../utils/permissions';

interface InventoryProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  locations: Location[];
  currentUser: User | null;
  onOpenAddInventory: (product: Product, locationId?: string) => void;
  onOpenAdjustInventory: (product: Product, locationId?: string) => void;
  onOpenTransferInventory: (product: Product, fromLocationId?: string) => void;
  onOpenSetMinStock: (product: Product, locationId: string, currentMin: number, currentStock: number) => void;
}

export const InventoryProductDetailModal: React.FC<InventoryProductDetailModalProps> = ({
  isOpen,
  onClose,
  productId,
  locations,
  currentUser,
  onOpenAddInventory,
  onOpenAdjustInventory,
  onOpenTransferInventory,
  onOpenSetMinStock,
}) => {
  const [detail, setDetail] = useState<ProductStockDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const allowAdd = canAddInventory(currentUser);
  const allowAdjust = canAdjustInventory(currentUser);
  const allowTransfer = canTransferInventory(currentUser);
  const allowMinStock = canManageMinStock(currentUser);

  useEffect(() => {
    if (isOpen && productId) {
      setLoading(true);
      setError(null);
      api
        .getProductStockDetails(productId)
        .then((data) => {
          setDetail(data);
        })
        .catch((err) => {
          setError(err?.message || 'Error al cargar detalle de inventario');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, productId]);

  if (!isOpen || !productId) return null;

  const productForAction: Product | null = detail
    ? ({
        id: detail.product.id,
        name: detail.product.name,
        sku: detail.product.sku,
        barcode: detail.product.barcode,
        saleType: detail.product.saleType,
        tracksInventory: true,
        costPrice: detail.product.costPrice || 0,
        salePrice: detail.product.salePrice,
        defaultMinStock: detail.product.defaultMinStock || 0,
        active: true,
        businessId: 'default',
      } as Product)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">inventory</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                  {detail?.product.name || 'Detalle de Inventario'}
                </h3>
                {detail?.isKit && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Kit / Combo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono">
                SKU: {detail?.product.sku || '...'} | Barcode:{' '}
                {detail?.product.barcode || 'Sin código de barra'}
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

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading && (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-[28px] text-indigo-600">
                progress_activity
              </span>
              <p className="text-xs font-medium">Cargando inventario del producto...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {!loading && detail && (
            <>
              {/* Quick Action Buttons for Physical Products */}
              {!detail.isKit && productForAction && (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-500 mr-2">Acciones Rápidas:</span>
                  {allowAdd && (
                    <button
                      onClick={() => onOpenAddInventory(productForAction)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_box</span>
                      <span>+ Agregar</span>
                    </button>
                  )}

                  {allowAdjust && (
                    <button
                      onClick={() => onOpenAdjustInventory(productForAction)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">tune</span>
                      <span>Ajustar</span>
                    </button>
                  )}

                  {allowTransfer && (
                    <button
                      onClick={() => onOpenTransferInventory(productForAction)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                      <span>Transferir</span>
                    </button>
                  )}
                </div>
              )}

              {/* Kit View Mode: Derivation and Component Explosion */}
              {detail.isKit && (
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl text-xs text-indigo-950">
                    <p className="font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-indigo-600">info</span>
                      Regla de negocio de Kits / Combos:
                    </p>
                    <p className="text-slate-600 mt-1">
                      Los combos no manejan inventario físico directo. Su disponibilidad se calcula en
                      tiempo real basada en el stock disponible de sus componentes en cada ubicación.
                    </p>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Disponibilidad de Combo por Ubicación
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detail.locationsAvailability?.map((loc) => (
                      <div
                        key={loc.locationId}
                        className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">{loc.locationName}</span>
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {loc.locationType === 'STORE' ? 'Tienda' : 'Almacén'}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black font-mono text-indigo-600">
                            {loc.availableKits}
                          </span>
                          <span className="text-xs text-slate-500">combos armables</span>
                        </div>
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                          {loc.components.map((c) => (
                            <div key={c.componentProductId} className="flex justify-between">
                              <span className="truncate pr-2">
                                {c.name} ({c.quantityPerKit} un/kit)
                              </span>
                              <span className="font-mono text-slate-700 shrink-0">
                                Stock: {c.availableStock} ({c.kitsPossible} kits)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standard Physical Product: Stock Per Location Table */}
              {!detail.isKit && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Existencias Físicas por Tienda / Almacén
                  </h4>
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200/80">
                        <tr>
                          <th className="px-4 py-3">Ubicación</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3 text-right">Stock Actual</th>
                          <th className="px-4 py-3 text-right">Stock Mínimo</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          {allowMinStock && <th className="px-4 py-3 text-right">Configurar</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.locationStocks?.map((loc) => {
                          const isNegative = loc.quantity < 0;
                          const isOutOfStock = loc.quantity === 0;
                          const isLow = loc.quantity > 0 && loc.quantity <= loc.minimumStock;

                          return (
                            <tr key={loc.locationId} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-900">{loc.locationName}</td>
                              <td className="px-4 py-3 text-slate-500 text-[11px]">
                                {loc.locationType === 'STORE' ? 'Tienda' : 'Almacén'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold">
                                <span
                                  className={
                                    isNegative
                                      ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200'
                                      : 'text-slate-900'
                                  }
                                >
                                  {loc.quantity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-slate-600">
                                {loc.minimumStock}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isNegative ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 ring-1 ring-rose-200">
                                    Stock Negativo
                                  </span>
                                ) : isOutOfStock ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    Sin Stock
                                  </span>
                                ) : isLow ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Stock Bajo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Stock Normal
                                  </span>
                                )}
                              </td>
                              {allowMinStock && (
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() =>
                                      productForAction &&
                                      onOpenSetMinStock(
                                        productForAction,
                                        loc.locationId,
                                        loc.minimumStock,
                                        loc.quantity,
                                      )
                                    }
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Modificar stock mínimo en esta tienda"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      edit_note
                                    </span>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Movements / Kardex */}
              {!detail.isKit && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Últimos Movimientos del Producto (Kardex)
                  </h4>
                  {detail.recentMovements.length === 0 ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                      No se registran movimientos históricos aún para este producto.
                    </div>
                  ) : (
                    <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200/80">
                          <tr>
                            <th className="px-4 py-2.5">Fecha</th>
                            <th className="px-4 py-2.5">Ubicación</th>
                            <th className="px-4 py-2.5">Tipo</th>
                            <th className="px-4 py-2.5 text-right">Cantidad</th>
                            <th className="px-4 py-2.5 text-right">Stock Resultante</th>
                            <th className="px-4 py-2.5">Motivo / Ref</th>
                            <th className="px-4 py-2.5">Usuario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detail.recentMovements.map((mov) => {
                            const isPositive = mov.quantity > 0;
                            return (
                              <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-[11px]">
                                  {new Date(mov.createdAt).toLocaleDateString('es-PE', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="px-4 py-2 font-medium text-slate-800">
                                  {mov.locationName}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                                    {mov.type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold">
                                  <span
                                    className={
                                      isPositive
                                        ? 'text-emerald-600'
                                        : 'text-rose-600'
                                    }
                                  >
                                    {isPositive ? `+${mov.quantity}` : mov.quantity}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">
                                  {mov.newStock}
                                </td>
                                <td className="px-4 py-2 text-slate-600 text-[11px] max-w-[200px] truncate">
                                  {mov.reason || mov.notes || mov.referenceId || '-'}
                                </td>
                                <td className="px-4 py-2 text-slate-500 text-[11px]">
                                  {mov.createdBy}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
