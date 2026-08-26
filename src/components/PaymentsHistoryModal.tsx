import React, { useState, useEffect } from 'react';
import { PaymentWithClient, Client } from '../types';
import { api } from '../services/api';

interface PaymentsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewClientStatement?: (clientId: string) => void;
  clients?: Client[];
}

export const PaymentsHistoryModal: React.FC<PaymentsHistoryModalProps> = ({
  isOpen,
  onClose,
  onViewClientStatement,
}) => {
  const [payments, setPayments] = useState<PaymentWithClient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<string>('today'); // 'today', 'yesterday', 'last7', 'thismonth', 'all', 'custom'
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('todos');

  // Summary state
  const [summary, setSummary] = useState<{ count: number; totalAmount: number }>({
    count: 0,
    totalAmount: 0,
  });

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPaymentsHistory({
        dateFilter,
        startDate: customStartDate,
        endDate: customEndDate,
        query: searchQuery,
      });

      let filtered = data.payments;
      if (methodFilter !== 'todos') {
        filtered = filtered.filter((p) => p.paymentMethod === methodFilter);
      }

      setPayments(filtered);

      const activeList = filtered.filter((p) => p.status === 'Activo');
      setSummary({
        count: activeList.length,
        totalAmount: activeList.reduce((sum, p) => sum + p.amount, 0),
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar el historial de abonos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPayments();
    }
  }, [isOpen, dateFilter, customStartDate, customEndDate, searchQuery, methodFilter]);

  if (!isOpen) return null;

  // Format date helper: Date and Time
  const formatDateTime = (isoString: string) => {
    if (!isoString) return { dateStr: '-', timeStr: '-', fullFormatted: '-' };
    try {
      const dateObj = new Date(isoString);
      // Format date: DD/MM/YYYY
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      
      // Format time: hh:mm:ss AM/PM
      let hours = dateObj.getHours();
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour '0' should be '12'
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

  // Payment breakdown by method
  const efectivoTotal = payments
    .filter((p) => p.status === 'Activo' && p.paymentMethod === 'Efectivo')
    .reduce((sum, p) => sum + p.amount, 0);

  const tarjetaTotal = payments
    .filter((p) => p.status === 'Activo' && p.paymentMethod === 'Tarjeta')
    .reduce((sum, p) => sum + p.amount, 0);

  const transfTotal = payments
    .filter((p) => p.status === 'Activo' && p.paymentMethod === 'Transferencia')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 md:p-6 flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[26px]">payments</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Historial de Abonos Recibidos</h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                  Fechas y Horas
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Registro detallado de pagos con identificación de cliente, hora exacta y método de pago
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 space-y-4">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>Periodo:</span>
              </span>
              <button
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'today'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Hoy
              </button>

              <button
                onClick={() => setDateFilter('yesterday')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'yesterday'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Ayer
              </button>

              <button
                onClick={() => setDateFilter('last7')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'last7'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Últimos 7 Días
              </button>

              <button
                onClick={() => setDateFilter('thismonth')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'thismonth'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Este Mes
              </button>

              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todos
              </button>

              <button
                onClick={() => setDateFilter('custom')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-indigo-200 shadow-xs text-xs">
                <label className="font-semibold text-slate-600">Desde:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <label className="font-semibold text-slate-600">Hasta:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Search bar + Payment Method filter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, N° cliente, cajero o notas..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Método:</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="todos">Todos los métodos</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>

          {/* Metrics Summary Cards inside Modal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="bg-white rounded-xl p-3 border border-emerald-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recaudado</p>
                <p className="text-lg font-black text-emerald-600">
                  S/ {summary.totalAmount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">payments</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transacciones</p>
                <p className="text-lg font-black text-slate-800">{summary.count} abonos</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">En Efectivo</p>
                <p className="text-sm font-extrabold text-slate-700">
                  S/ {efectivoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">payments</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bancos / Tarjetas</p>
                <p className="text-sm font-extrabold text-slate-700">
                  S/ {(tarjetaTotal + transfTotal).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">credit_card</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center text-slate-500 space-y-3">
              <span className="material-symbols-outlined text-4xl animate-spin text-emerald-600">
                progress_activity
              </span>
              <p className="text-sm font-medium">Cargando abonos recibidos...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-center font-medium">
              {error}
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center space-y-3 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">event_busy</span>
              </div>
              <h3 className="text-base font-bold text-slate-800">No se encontraron abonos en este periodo</h3>
              <p className="text-xs text-slate-500">
                {dateFilter === 'today'
                  ? 'No hay transacciones registradas hoy. Prueba cambiando el filtro de fecha a "Ayer", "Últimos 7 Días" o "Todos" arriba.'
                  : 'Intenta modificar los filtros de búsqueda o fecha para visualizar más registros.'}
              </p>
              {dateFilter === 'today' && (
                <button
                  onClick={() => setDateFilter('last7')}
                  className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                  <span>Ver Últimos 7 Días</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4 text-right">Importe Abono</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4">Evolución Saldo</th>
                    <th className="py-3 px-4">Registrado Por</th>
                    <th className="py-3 px-4">Notas</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {payments.map((p) => {
                    const dt = formatDateTime(p.date);
                    const isAnulado = p.status === 'Anulado';

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isAnulado ? 'bg-rose-50/40 text-slate-400' : 'text-slate-800'
                        }`}
                      >
                        {/* Fecha y Hora */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[15px]">schedule</span>
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900">{dt.dateStr}</div>
                              <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">access_time</span>
                                <span>{dt.timeStr}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900 text-sm">
                            {p.clientName}
                          </div>
                        </td>

                        {/* Importe Abono */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div
                            className={`text-sm font-black ${
                              isAnulado ? 'line-through text-rose-500' : 'text-emerald-600'
                            }`}
                          >
                            S/ {p.amount.toFixed(2)}
                          </div>
                          {p.cardSurcharge && p.cardSurcharge > 0 ? (
                            <span className="text-[10px] text-slate-500 font-semibold block">
                              + S/ {p.cardSurcharge.toFixed(2)} recargo
                            </span>
                          ) : null}
                        </td>

                        {/* Método */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                              p.paymentMethod === 'Efectivo'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : p.paymentMethod === 'Transferencia'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-purple-100 text-purple-900 border border-purple-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {p.paymentMethod === 'Efectivo'
                                ? 'payments'
                                : p.paymentMethod === 'Transferencia'
                                ? 'account_balance'
                                : 'credit_card'}
                            </span>
                            <span>{p.paymentMethod}</span>
                          </span>
                        </td>

                        {/* Evolución Saldo */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-[11px] font-medium text-slate-500">
                            Anterior: S/ {p.previousBalance.toFixed(2)}
                          </div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <span>Resultante:</span>
                            <span
                              className={
                                p.resultingBalance < 0
                                  ? 'text-indigo-600'
                                  : p.resultingBalance === 0
                                  ? 'text-emerald-600 font-extrabold'
                                  : 'text-slate-800'
                              }
                            >
                              S/ {p.resultingBalance.toFixed(2)}
                            </span>
                          </div>
                        </td>

                        {/* Registrado Por */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-700 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                            <span>{p.registeredBy}</span>
                          </div>
                        </td>

                        {/* Notas */}
                        <td className="py-3 px-4 max-w-[180px]">
                          <p className="truncate text-slate-600 text-[11px]" title={p.notes || ''}>
                            {p.notes || '-'}
                          </p>
                          {isAnulado && (
                            <span className="mt-1 inline-block bg-rose-100 text-rose-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                              Anulado ({p.annulmentReason || 'Anulación'})
                            </span>
                          )}
                        </td>

                        {/* Acción */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {onViewClientStatement && (
                            <button
                              onClick={() => onViewClientStatement(p.clientId)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Ver estado de cuenta del cliente"
                            >
                              <span className="material-symbols-outlined text-[14px]">receipt_long</span>
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
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <strong className="text-slate-800">{payments.length}</strong> abonos registrados
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
};
