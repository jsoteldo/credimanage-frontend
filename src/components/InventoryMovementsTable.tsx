import React, { useState, useEffect } from 'react';
import { Location, Product, InventoryMovement, InventoryMovementType } from '../types';
import { api } from '../services/api';

interface InventoryMovementsTableProps {
  locations: Location[];
  products: Product[];
  selectedLocationId?: string;
}

export const InventoryMovementsTable: React.FC<InventoryMovementsTableProps> = ({
  locations,
  products,
  selectedLocationId: initialLocationId,
}) => {
  const [locationId, setLocationId] = useState<string>(initialLocationId || 'all');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeLocations = locations.filter((l) => l.active);

  useEffect(() => {
    if (initialLocationId && initialLocationId !== locationId) {
      setLocationId(initialLocationId);
    }
  }, [initialLocationId]);

  const loadMovements = () => {
    setLoading(true);
    setError(null);
    api
      .getInventoryMovements({
        locationId: locationId !== 'all' ? locationId : undefined,
        productId: selectedProductId || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 30,
      })
      .then((res) => {
        setMovements(res.movements);
        setTotalCount(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => {
        setError(err?.message || 'Error al cargar historial de movimientos');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMovements();
  }, [locationId, selectedProductId, typeFilter, startDate, endDate, page]);

  const movementTypeLabels: Record<InventoryMovementType, { label: string; color: string }> = {
    INITIAL: { label: 'Inventario Inicial', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    ENTRY: { label: 'Entrada', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    ADJUSTMENT_POSITIVE: { label: 'Ajuste (+)', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    ADJUSTMENT_NEGATIVE: { label: 'Ajuste (-)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    TRANSFER_OUT: { label: 'Transf. Salida', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    TRANSFER_IN: { label: 'Transf. Entrada', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    SALE: { label: 'Venta', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    SALE_REVERSAL: { label: 'Anulación Venta', color: 'bg-pink-50 text-pink-700 border-pink-200' },
    RETURN: { label: 'Devolución', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  return (
    <div className="space-y-4">
      {/* Kardex Multi-Variable Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-slate-400">filter_alt</span>
            <span className="text-xs font-bold text-slate-800">Filtros de Auditoría Kardex</span>
          </div>
          <button
            onClick={() => {
              setLocationId('all');
              setSelectedProductId('');
              setTypeFilter('all');
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            Limpiar Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Store Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Tienda / Almacén</label>
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Todas las ubicaciones</option>
              {activeLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Producto</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Todos los productos</option>
              {products
                .filter((p) => p.saleType !== 'KIT')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.sku}]
                  </option>
                ))}
            </select>
          </div>

          {/* Movement Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Tipo de Movimiento</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Todos los tipos</option>
              <option value="ENTRY">Entrada (+)</option>
              <option value="ADJUSTMENT_POSITIVE">Ajuste Positivo (+)</option>
              <option value="ADJUSTMENT_NEGATIVE">Ajuste Negativo (-)</option>
              <option value="TRANSFER_OUT">Transferencia Salida (-)</option>
              <option value="TRANSFER_IN">Transferencia Entrada (+)</option>
              <option value="INITIAL">Inventario Inicial</option>
              <option value="SALE">Venta (-)</option>
              <option value="RETURN">Devolución (+)</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Desde Fecha</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Hasta Fecha</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-600">
          Mostrando {movements.length} de {totalCount} movimientos
        </span>
        <button
          onClick={loadMovements}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          <span>Actualizar</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center gap-2">
          <span className="material-symbols-outlined animate-spin text-[28px] text-indigo-600">
            progress_activity
          </span>
          <p className="text-xs font-medium">Cargando movimientos Kardex...</p>
        </div>
      )}

      {!loading && movements.length === 0 && (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-[36px] text-slate-300">receipt_long</span>
          <p className="text-xs font-bold text-slate-600">No se encontraron movimientos</p>
          <p className="text-[11px] text-slate-400 max-w-sm">
            No existen registros de entradas, salidas o transferencias con los filtros aplicados.
          </p>
        </div>
      )}

      {/* Desktop Table View (>= md) */}
      {!loading && movements.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200/80">
                <tr>
                  <th className="px-4 py-3">Fecha y Hora</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Anterior</th>
                  <th className="px-4 py-3 text-right">Resultante</th>
                  <th className="px-4 py-3">Referencia / Motivo</th>
                  <th className="px-4 py-3">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((mov) => {
                  const badge =
                    movementTypeLabels[mov.type] || {
                      label: mov.type,
                      color: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                  const isPositive = mov.quantity > 0;

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px] font-mono">
                        {new Date(mov.createdAt).toLocaleDateString('es-PE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block truncate max-w-[200px]">
                          {mov.productName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          SKU: {mov.sku}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                        {mov.locationName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                          {isPositive ? `+${mov.quantity}` : mov.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {mov.previousStock}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            mov.newStock < 0
                              ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200'
                              : 'text-slate-900'
                          }
                        >
                          {mov.newStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[11px] max-w-[220px]">
                        <span className="block truncate font-medium text-slate-800">
                          {mov.reason || mov.notes || '-'}
                        </span>
                        {mov.referenceId && (
                          <span className="text-[10px] font-mono text-indigo-600 block truncate">
                            Ref: {mov.referenceId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {mov.createdBy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< md) */}
          <div className="md:hidden space-y-3">
            {movements.map((mov) => {
              const badge =
                movementTypeLabels[mov.type] || {
                  label: mov.type,
                  color: 'bg-slate-100 text-slate-700 border-slate-200',
                };
              const isPositive = mov.quantity > 0;

              return (
                <div
                  key={mov.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{mov.productName}</h4>
                      <p className="text-[10px] font-mono text-slate-400">SKU: {mov.sku}</p>
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Ubicación
                      </span>
                      <span className="font-medium text-slate-800">{mov.locationName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Cantidad Movida
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          isPositive ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isPositive ? `+${mov.quantity}` : mov.quantity}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 font-mono">
                    <span className="text-slate-500 text-[11px]">
                      Stock: {mov.previousStock} ➔{' '}
                      <strong className={mov.newStock < 0 ? 'text-rose-600' : 'text-slate-900'}>
                        {mov.newStock}
                      </strong>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(mov.createdAt).toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {(mov.reason || mov.notes || mov.referenceId) && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl">
                      {mov.reason && <p className="font-medium">{mov.reason}</p>}
                      {mov.notes && <p className="text-slate-500">{mov.notes}</p>}
                      {mov.referenceId && (
                        <p className="text-[10px] font-mono text-indigo-600 mt-0.5">
                          Ref: {mov.referenceId}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
