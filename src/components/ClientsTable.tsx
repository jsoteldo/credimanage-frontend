import React from 'react';
import { Client } from '../types';

interface ClientsTableProps {
  clients: Client[];
  onViewStatement: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onPayClient: (client: Client) => void;
  onAddDebtClient: (client: Client) => void;
  onDeactivateClient: (client: Client) => void;
  onReactivateClient: (client: Client) => void;
  onDeleteClient: (client: Client) => void;
  onOpenRemindersModal?: () => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export const ClientsTable: React.FC<ClientsTableProps> = ({
  clients,
  onViewStatement,
  onEditClient,
  onPayClient,
  onAddDebtClient,
  onDeactivateClient,
  onReactivateClient,
  onDeleteClient,
  onOpenRemindersModal,
  statusFilter,
  setStatusFilter,
  searchQuery = '',
  setSearchQuery,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Dynamic counts for filter chips
  const totalCount = clients.length;
  const conDeudaCount = clients.filter((c) => c.status === 'Activo' && c.currentBalance > 0).length;
  const alDiaCount = clients.filter((c) => c.status === 'Activo' && c.currentBalance <= 0).length;
  const desactivadosCount = clients.filter((c) => c.status === 'Desactivado').length;

  // Filtered clients list
  const displayedClients = clients.filter((client) => {
    if (statusFilter === 'con_deuda') {
      return client.status === 'Activo' && client.currentBalance > 0;
    }
    if (statusFilter === 'al_dia') {
      return client.status === 'Activo' && client.currentBalance <= 0;
    }
    if (statusFilter === 'desactivados' || statusFilter === 'Desactivado') {
      return client.status === 'Desactivado';
    }
    if (statusFilter === 'activos' || statusFilter === 'Activo') {
      return client.status === 'Activo';
    }
    return true; // 'todos'
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base">
                Clientes Recientes / Relevantes
              </h3>
              {onOpenRemindersModal && (
                <button
                  onClick={onOpenRemindersModal}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  title="Ver calendario y recordatorios de fechas de pago"
                >
                  <span className="material-symbols-outlined text-[16px] text-amber-600">notifications_active</span>
                  <span>Recordatorios de Cobro</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoreo de crédito y cartera de deudores.
            </p>
          </div>

          {/* Search bar next to Recordatorios de Cobro */}
          {setSearchQuery && (
            <div className="relative min-w-[220px] sm:w-64 md:w-72 shrink-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar clientes por nombre..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-xs text-slate-800 placeholder:text-slate-400 transition-all outline-none shadow-2xs"
              />
            </div>
          )}
        </div>

        {/* Filter Dropdown Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="statusFilterSelect" className="text-xs font-bold text-slate-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px] text-slate-500">filter_list</span>
            <span>Filtrar por:</span>
          </label>
          <select
            id="statusFilterSelect"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3.5 pr-8 rounded-xl border border-slate-200 bg-white font-extrabold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer transition-all"
          >
            <option value="todos">Todos ({totalCount})</option>
            <option value="con_deuda">Con Deuda ({conDeudaCount})</option>
            <option value="al_dia">Al Día ({alDiaCount})</option>
            <option value="desactivados">Desactivados ({desactivadosCount})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</th>
              <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Saldo Pendiente</th>
              <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Límite Crédito</th>
              <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Estado</th>
              <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedClients.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 text-sm font-medium">
                  No se encontraron clientes que coincidan con la búsqueda o el filtro seleccionado.
                </td>
              </tr>
            ) : (
              displayedClients.map((client) => {
                const isOverLimit =
                  client.creditLimit > 0 &&
                  client.currentBalance >= client.creditLimit * 0.9 &&
                  client.currentBalance > 0;
                const hasDebt = client.currentBalance > 0;
                const hasFavor = client.currentBalance < 0;

                return (
                  <tr
                    key={client.id}
                    className={`hover:bg-slate-50/80 transition-colors group ${
                      client.status === 'Desactivado' ? 'opacity-60 bg-slate-50/30' : ''
                    }`}
                  >
                    {/* Name ONLY (hidden code & address as requested) */}
                    <td className="py-3.5 px-5">
                      <span className="text-sm font-bold text-slate-900">
                        {client.name}
                      </span>
                    </td>

                    {/* Current Balance (Saldo Pendiente) FIRST */}
                    <td
                      className={`py-3.5 px-5 font-mono text-xs text-right font-extrabold ${
                        hasDebt
                          ? 'text-rose-600'
                          : hasFavor
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {hasFavor
                        ? `-S/ ${Math.abs(client.currentBalance).toLocaleString('es-PE', { minimumFractionDigits: 2 })} (A favor)`
                        : `S/ ${client.currentBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                    </td>

                    {/* Credit Limit (Límite Crédito) SECOND */}
                    <td className="py-3.5 px-5 font-mono text-xs text-slate-700 text-right font-medium">
                      {client.creditLimit > 0
                        ? `S/ ${client.creditLimit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                        : 'Sin límite'}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-5 text-center">
                      {client.status === 'Desactivado' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold text-[10px] border border-slate-200">
                          Desactivado
                        </span>
                      ) : isOverLimit ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                          Límite
                        </span>
                      ) : hasDebt ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                          Deuda
                        </span>
                      ) : hasFavor ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                          Saldo a Favor
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                          Al Día
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex justify-end items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                        {/* Statement of account */}
                        <button
                          onClick={() => onViewStatement(client)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Ver Estado de Cuenta / Historial"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>

                        {/* Pay / Abono button shortcut */}
                        {client.status === 'Activo' && (
                          <button
                            onClick={() => onPayClient(client)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Registrar Abono o Liquidar"
                          >
                            <span className="material-symbols-outlined text-[18px]">payments</span>
                          </button>
                        )}

                        {/* Add Debt / Cargo shortcut */}
                        {client.status === 'Activo' && (
                          <button
                            onClick={() => onAddDebtClient(client)}
                            className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Añadir Deuda / Editar Saldo Deudor"
                          >
                            <span className="material-symbols-outlined text-[18px]">post_add</span>
                          </button>
                        )}

                        {/* Edit Client */}
                        <button
                          onClick={() => onEditClient(client)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar Datos del Cliente"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>

                        {/* Deactivate / Reactivate */}
                        {client.status === 'Activo' ? (
                          <button
                            onClick={() => onDeactivateClient(client)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Desactivar Cliente (Regla de negocio)"
                          >
                            <span className="material-symbols-outlined text-[18px]">block</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onReactivateClient(client)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Reactivar Cliente"
                          >
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </button>
                        )}

                        {/* Delete Client button hidden by request while preserving underlying function */}
                        {/* <button
                          onClick={() => onDeleteClient(client)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar Cliente (Valida saldo = S/ 0 y sin historial)"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button> */}
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
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-500 font-medium">
        <span>Mostrando {clients.length} clientes</span>
        <div className="flex gap-2">
          <button className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer text-xs font-semibold">
            Anterior
          </button>
          <button className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer text-xs font-semibold">
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
};
