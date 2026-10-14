import React, { useState, useEffect, useMemo } from 'react';
import { Location, Client, User, SaleSummaryItem, Sale } from '../../types';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/loanCalculations';
import { SaleDetailModal } from './SaleDetailModal';

interface SalesHistoryTabProps {
  locations: Location[];
  clients: Client[];
  currentUser: User | null;
  onRefreshTrigger?: number;
}

export const SalesHistoryTab: React.FC<SalesHistoryTabProps> = ({
  locations,
  clients,
  currentUser,
  onRefreshTrigger,
}) => {
  const [sales, setSales] = useState<SaleSummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected sale for detail modal
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Fetch sales
  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSales({
        storeId: storeFilter !== 'all' ? storeFilter : undefined,
        clientId: clientFilter !== 'all' ? clientFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        q: searchQuery.trim() || undefined,
        limit: 100,
      });
      setSales(res.sales);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el historial de ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [storeFilter, clientFilter, statusFilter, startDate, endDate, onRefreshTrigger]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSales();
  };

  const handleOpenSaleDetail = async (saleId: string) => {
    setLoadingDetail(true);
    try {
      const sale = await api.getSaleById(saleId);
      setSelectedSaleDetail(sale);
    } catch (err: any) {
      alert(err.message || 'Error al obtener detalle de la venta');
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatMethodLabel = (m: string) => {
    switch (m) {
      case 'CASH':
        return 'Efectivo';
      case 'YAPE':
        return 'Yape';
      case 'PLIN':
        return 'Plin';
      case 'CARD':
        return 'Tarjeta';
      case 'TRANSFER':
        return 'Transferencia';
      case 'CREDIT':
        return 'Crédito';
      default:
        return m;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          {/* Search Query */}
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <span className="material-symbols-outlined text-[18px]">search</span>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por N° de venta, cliente o cajero..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Store Filter */}
          <div className="w-full md:w-44 shrink-0">
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Todas las tiendas</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client Filter */}
          <div className="w-full md:w-48 shrink-0">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Todos los clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.clientNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-36 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="COMPLETED">Completadas</option>
              <option value="ANULLED">Anuladas</option>
            </select>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">filter_alt</span>
            Filtrar
          </button>
        </form>

        {/* Date Range Sub-Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <span className="font-semibold text-slate-500">Rango de Fechas:</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
            />
          </div>
          {(startDate || endDate || searchQuery || storeFilter !== 'all' || clientFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
                setStoreFilter('all');
                setClientFilter('all');
                setStatusFilter('all');
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer ml-auto"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Sales List Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <span className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
            <span>Cargando historial de ventas...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 text-xs">{error}</div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">search_off</span>
            </div>
            <p className="text-sm font-semibold text-slate-700">No se encontraron ventas</p>
            <p className="text-xs text-slate-400">
              No hay ventas registradas que coincidan con los filtros aplicados.
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">N° Venta</th>
                    <th className="px-4 py-3">Fecha y Hora</th>
                    <th className="px-4 py-3">Tienda</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Método(s)</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3">Cajero</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((sale) => {
                    const isAnnulled = sale.status === 'ANULLED';

                    return (
                      <tr
                        key={sale.id}
                        onClick={() => handleOpenSaleDetail(sale.id)}
                        className="hover:bg-slate-50/90 transition-colors cursor-pointer select-none"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                          {sale.saleNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(sale.createdAt).toLocaleString('es-PE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {sale.storeName}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          <span className="font-semibold">{sale.clientName}</span>
                          {sale.clientNumber && (
                            <span className="text-slate-400 font-mono text-[11px] ml-1">
                              ({sale.clientNumber})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {sale.payments?.map((p, pIdx) => (
                              <span
                                key={pIdx}
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {formatMethodLabel(p.method)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isAnnulled
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isAnnulled ? 'Anulada' : 'Completada'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {sale.createdBy}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (Zero global horizontal scroll) */}
            <div className="md:hidden divide-y divide-slate-100">
              {sales.map((sale) => {
                const isAnnulled = sale.status === 'ANULLED';

                return (
                  <div
                    key={sale.id}
                    onClick={() => handleOpenSaleDetail(sale.id)}
                    className="p-4 hover:bg-slate-50 transition-colors cursor-pointer select-none space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-700 text-sm">
                        {sale.saleNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isAnnulled
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {isAnnulled ? 'Anulada' : 'Completada'}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">
                          {sale.clientName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sale.storeName} • {sale.createdBy}
                        </div>
                      </div>
                      <div className="font-mono font-black text-base text-slate-900 text-right">
                        {formatCurrency(sale.total)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-50">
                      <span>
                        {new Date(sale.createdAt).toLocaleString('es-PE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                      <div className="flex gap-1">
                        {sale.payments?.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600"
                          >
                            {formatMethodLabel(p.method)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSaleDetail && (
        <SaleDetailModal
          sale={selectedSaleDetail}
          currentUser={currentUser}
          onClose={() => setSelectedSaleDetail(null)}
          onSaleAnnulled={(updated) => {
            setSelectedSaleDetail(updated);
            fetchSales();
          }}
        />
      )}
    </div>
  );
};
