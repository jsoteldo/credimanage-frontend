import React, { useState, useEffect } from 'react';
import { CreditPurchaseWithClient, Client } from '../types';
import { api } from '../services/api';

interface PurchasesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewClientStatement?: (clientId: string) => void;
  clients?: Client[];
}

export const PurchasesHistoryModal: React.FC<PurchasesHistoryModalProps> = ({
  isOpen,
  onClose,
  onViewClientStatement,
}) => {
  const [purchases, setPurchases] = useState<CreditPurchaseWithClient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<string>('today'); // 'today', 'yesterday', 'last7', 'thismonth', 'all', 'custom'
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchPurchases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPurchasesHistory({
        dateFilter,
        startDate: customStartDate,
        endDate: customEndDate,
        query: searchQuery,
      });

      setPurchases(data.purchases);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar el historial de cuentas y deudas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPurchases();
    }
  }, [isOpen, dateFilter, customStartDate, customEndDate, searchQuery]);

  if (!isOpen) return null;

  // Local filter strictly by client name
  const filteredPurchases = purchases.filter((pur) => {
    if (!searchQuery.trim()) return true;
    return pur.clientName.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  // Format date helper: Date and Time
  const formatDateTime = (isoString: string) => {
    if (!isoString) return { dateStr: '-', timeStr: '-', fullFormatted: '-' };
    try {
      const dateObj = new Date(isoString);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      
      let hours = dateObj.getHours();
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedHours = String(hours).padStart(2, '0');

      return {
        dateStr: `${day}/${month}/${year}`,
        timeStr: `${formattedHours}:${minutes}:${seconds} ${ampm}`,
        fullFormatted: `${day}/${month}/${year} a las ${formattedHours}:${minutes} ${ampm}`,
      };
    } catch {
      return { dateStr: isoString, timeStr: '', fullFormatted: isoString };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header - System Indigo Theme */}
        <div className="bg-indigo-600 text-white p-5 md:p-6 flex items-center justify-between relative shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 text-white border border-white/20 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[26px]">receipt_long</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Cuentas y Deudas Registradas</h2>
                <span className="bg-white/15 text-indigo-100 border border-white/20 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                  Historial Contable
                </span>
              </div>
              <p className="text-xs text-indigo-100/90 mt-0.5">
                Historial de cargos, compras a crédito y fiados ingresados diariamente por cliente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-indigo-700/80 hover:bg-indigo-800 text-indigo-100 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-indigo-600">calendar_today</span>
                <span>Periodo:</span>
              </span>
              <button
                onClick={() => setDateFilter('today')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'today'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Hoy
              </button>

              <button
                onClick={() => setDateFilter('yesterday')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'yesterday'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Ayer
              </button>

              <button
                onClick={() => setDateFilter('last7')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'last7'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Últimos 7 Días
              </button>

              <button
                onClick={() => setDateFilter('thismonth')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'thismonth'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Este Mes
              </button>

              <button
                onClick={() => setDateFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todos
              </button>

              <button
                onClick={() => setDateFilter('custom')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'custom'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Personalizado 📅
              </button>
            </div>

            {/* Custom Range Picker */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-indigo-200 shadow-2xs text-xs">
                <label className="font-bold text-slate-600">Desde:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <label className="font-bold text-slate-600">Hasta:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Content Table Container */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <span className="material-symbols-outlined text-4xl animate-spin text-indigo-600">
                progress_activity
              </span>
              <p className="text-sm font-medium">Cargando cuentas registradas...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-center font-medium">
              {error}
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="py-16 text-center space-y-3 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">event_busy</span>
              </div>
              <h3 className="text-base font-bold text-slate-800">No se encontraron cargos o deudas registradas</h3>
              <p className="text-xs text-slate-500">
                {searchQuery.trim()
                  ? `No hay coincidencias para el cliente "${searchQuery}".`
                  : 'Intenta cambiar el periodo de fecha arriba para consultar más registros.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xs">
              {/* Table Header Bar with Search Filter */}
              <div className="bg-slate-100/90 p-3.5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-[20px]">format_list_bulleted</span>
                  <span className="text-xs font-extrabold text-slate-800">
                    Historial de Cargos ({filteredPurchases.length})
                  </span>
                </div>

                {/* Search Filter only by client name in table header */}
                <div className="relative w-full sm:w-80">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre de cliente..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Fecha y Hora</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4 text-center">Monto del Movimiento</th>
                      <th className="py-3 px-4">Registrado Por</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredPurchases.map((pur) => {
                      const dt = formatDateTime(pur.date);
                      const isAnulado = pur.status === 'Anulado';

                      return (
                        <tr
                          key={pur.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isAnulado ? 'bg-rose-50/40 text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {/* 1. Fecha y Hora */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[15px]">schedule</span>
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900">{dt.dateStr}</div>
                                <div className="text-[11px] font-semibold text-indigo-600 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px]">access_time</span>
                                  <span>{dt.timeStr}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Cliente */}
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-slate-900 text-sm">
                              {pur.clientName}
                            </div>
                          </td>

                          {/* 3. Monto del Movimiento (Deuda / Cargo) */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-2 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                              <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                                Deuda
                              </span>
                              <span
                                className={`text-sm font-black ${
                                  isAnulado ? 'line-through text-rose-400' : 'text-rose-700'
                                }`}
                              >
                                +S/ {pur.amount.toFixed(2)}
                              </span>
                            </div>
                          </td>

                          {/* 4. Registrado Por */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[12px]">
                                <span className="material-symbols-outlined text-[14px]">person</span>
                              </div>
                              <span>{pur.registeredBy}</span>
                            </div>
                          </td>

                          {/* 5. Acción */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {onViewClientStatement && (
                              <button
                                onClick={() => onViewClientStatement(pur.clientId)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer border border-indigo-200/60"
                                title="Ver estado de cuenta del cliente"
                              >
                                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                                <span>Ver Cuenta</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <strong className="text-slate-800">{filteredPurchases.length}</strong> cuentas/cargos registrados
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
};

