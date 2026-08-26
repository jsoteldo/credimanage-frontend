import React, { useState, useEffect } from 'react';
import { Client } from '../types';
import { api } from '../services/api';

interface BalanceReportViewProps {
  onViewStatement: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onPayClient: (client: Client) => void;
}

export const BalanceReportView: React.FC<BalanceReportViewProps> = ({
  onViewStatement,
  onEditClient,
  onPayClient,
}) => {
  const [filter, setFilter] = useState<'Todos' | 'Con Deuda' | 'Al Límite' | 'Sin Deuda' | 'Saldo a Favor'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState({ totalClientsDebt: 0, totalPortfolioAmount: 0 });
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await api.getBalanceReport(filter, searchQuery);
      setClients(data.report);
      setSummary(data.summary);
    } catch (err: any) {
      console.error('Error cargando reporte de saldos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [filter, searchQuery]);

  const exportPDF = () => {
    const content = clients
      .map(
        (c) =>
          `${c.clientNumber} | ${c.name} | Tel: ${c.phone} | Límite: S/ ${c.creditLimit.toFixed(2)} | Saldo: S/ ${c.currentBalance.toFixed(2)}`
      )
      .join('\n');
    const blob = new Blob([`REPORTE DE SALDOS CREDIMANAGE POS (SOLES PERUANOS)\nGenerado: ${new Date().toLocaleString('es-PE')}\n\n` + content], {
      type: 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_saldos_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const exportExcel = () => {
    const csvHeader = 'Codigo,Nombre,Telefono,Direccion,LimiteCredito,SaldoActual,Estado\n';
    const csvRows = clients
      .map(
        (c) =>
          `"${c.clientNumber}","${c.name}","${c.phone}","${c.address}",${c.creditLimit},${c.currentBalance},"${c.status}"`
      )
      .join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_saldos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-8 max-w-[1440px] mx-auto w-full flex flex-col gap-6">
      {/* Header & KPIs */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1">
            Reporte de Saldos General
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Vista detallada de cartera de clientes, límites y saldos pendientes.
          </p>
        </div>

        <div className="flex gap-4 w-full lg:w-auto">
          {/* KPI Card 1 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex-1 lg:w-52 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">TOTAL CLIENTES DEUDA</p>
            <p className="text-xl font-black text-slate-900">
              {summary.totalClientsDebt}
            </p>
          </div>

          {/* KPI Card 2 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex-1 lg:w-64 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">MONTO TOTAL CARTERA</p>
            <p className="text-xl font-black text-slate-900">
              S/ {summary.totalPortfolioAmount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
        {/* Search inside report */}
        <div className="w-full md:w-64 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por nombre o código..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 outline-none"
          />
        </div>

        {/* Filter Dropdown Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <label htmlFor="balanceStatusFilter" className="text-xs font-bold text-slate-600 flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-[18px] text-indigo-600">filter_list</span>
            <span>Filtrar por Estado:</span>
          </label>
          <select
            id="balanceStatusFilter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="h-9 px-3.5 pr-8 rounded-xl border border-slate-200 bg-white font-extrabold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer transition-all w-full md:w-auto"
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Con Deuda">Con Deuda</option>
            <option value="Al Límite">Al Límite de Crédito</option>
            <option value="Sin Deuda">Sin Deuda / Al Día</option>
            <option value="Saldo a Favor">Saldo a Favor</option>
          </select>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={exportPDF}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Descargar Resumen
          </button>
          <button
            onClick={exportExcel}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">NOMBRE DEL CLIENTE</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">TELÉFONO</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">LÍMITE CRÉDITO</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">SALDO PENDIENTE</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">CRÉDITO DISP.</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">ESTADO</th>
                <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined animate-spin text-[28px] text-indigo-600">sync</span>
                    <p className="mt-1 text-xs font-medium">Cargando reporte...</p>
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                    No hay datos registrados para este filtro.
                  </td>
                </tr>
              ) : (
                clients.map((client) => {
                  const isOverLimit =
                    client.creditLimit > 0 &&
                    client.currentBalance >= client.creditLimit * 0.9 &&
                    client.currentBalance > 0;
                  const hasDebt = client.currentBalance > 0;
                  const hasFavor = client.currentBalance < 0;
                  const availableCredit = client.creditLimit > 0 ? Math.max(0, client.creditLimit - client.currentBalance) : 'Sin límite';

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold text-slate-900">{client.name}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{client.clientNumber}</span>
                      </td>

                      <td className="px-5 py-3 font-mono text-xs text-slate-500 font-medium">
                        {client.phone || 'N/A'}
                      </td>

                      <td className="px-5 py-3 font-mono text-xs text-slate-700 text-right font-medium">
                        {client.creditLimit > 0 ? `S/ ${client.creditLimit.toFixed(2)}` : 'Sin límite'}
                      </td>

                      <td
                        className={`px-5 py-3 font-mono text-xs font-extrabold text-right ${
                          hasDebt ? 'text-rose-600' : hasFavor ? 'text-emerald-600' : 'text-slate-700'
                        }`}
                      >
                        {hasFavor
                          ? `-S/ ${Math.abs(client.currentBalance).toFixed(2)}`
                          : `S/ ${client.currentBalance.toFixed(2)}`}
                      </td>

                      <td className="px-5 py-3 font-mono text-xs text-slate-700 text-right font-medium">
                        {typeof availableCredit === 'number' ? `S/ ${availableCredit.toFixed(2)}` : availableCredit}
                      </td>

                      <td className="px-5 py-3 text-center">
                        {isOverLimit ? (
                          <span className="inline-block px-2.5 py-0.5 bg-amber-50 text-amber-700 font-bold text-[10px] rounded-full border border-amber-200">
                            Al Límite
                          </span>
                        ) : hasDebt ? (
                          <span className="inline-block px-2.5 py-0.5 bg-rose-50 text-rose-700 font-bold text-[10px] rounded-full border border-rose-200">
                            Con Deuda
                          </span>
                        ) : hasFavor ? (
                          <span className="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded-full border border-indigo-200">
                            Saldo a Favor
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">
                            Pagado
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onViewStatement(client)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Ver Estado de Cuenta"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <button
                            onClick={() => onPayClient(client)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Abonar / Liquidar"
                          >
                            <span className="material-symbols-outlined text-[18px]">payments</span>
                          </button>
                          <button
                            onClick={() => onEditClient(client)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
          <span className="text-xs font-medium text-slate-500">
            Mostrando 1 - {clients.length} de {clients.length} clientes
          </span>
          <div className="flex gap-1.5">
            <button className="p-1 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button className="p-1 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
