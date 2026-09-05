import React from 'react';
import { Client } from '../types';
import { PageHeader } from './PageHeader';
import { KpiGrid, KpiCard } from './KpiCard';
import { FilterPills } from './FilterPills';

interface ClientsTableProps {
  clients: Client[];
  onNewClient?: () => void;
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
  onNewClient,
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
  // Dynamic counts for filter chips and KPI cards
  const totalCount = clients.length;
  const conDeudaCount = clients.filter((c) => c.status === 'Activo' && c.currentBalance > 0).length;
  const alDiaCount = clients.filter((c) => c.status === 'Activo' && c.currentBalance <= 0).length;
  const desactivadosCount = clients.filter((c) => c.status === 'Desactivado').length;

  // Filtered clients list
  const displayedClients = clients.filter((client) => {
    // Status filter
    if (statusFilter === 'con_deuda') {
      if (!(client.status === 'Activo' && client.currentBalance > 0)) return false;
    } else if (statusFilter === 'al_dia') {
      if (!(client.status === 'Activo' && client.currentBalance <= 0)) return false;
    } else if (statusFilter === 'desactivados' || statusFilter === 'Desactivado') {
      if (client.status !== 'Desactivado') return false;
    } else if (statusFilter === 'activos' || statusFilter === 'Activo') {
      if (client.status !== 'Activo') return false;
    }

    // Local search filter for instant typing response
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matches =
        client.name.toLowerCase().includes(q) ||
        client.clientNumber.toLowerCase().includes(q) ||
        (client.phone && client.phone.includes(q));
      if (!matches) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header with Primary Action Button (Pattern from Deuda) */}
      <PageHeader
        icon="group"
        iconBgClass="bg-indigo-600"
        title="Clientes"
        subtitle="Gestión de clientes, límites de crédito y configuración de cobro."
        actions={
          <>
            {onOpenRemindersModal && (
              <button
                onClick={onOpenRemindersModal}
                className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Ver calendario y recordatorios de fechas de pago"
              >
                <span className="material-symbols-outlined text-[18px] text-amber-600">notifications_active</span>
                <span>Recordatorios de Cobro</span>
              </button>
            )}

            {onNewClient && (
              <button
                onClick={onNewClient}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
                title="Registrar un nuevo cliente en el sistema"
              >
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                <span>+ Nuevo Cliente</span>
              </button>
            )}
          </>
        }
      />

      {/* KPI Cards Grid (Pattern from Deuda) */}
      <KpiGrid>
        <KpiCard
          title="Total Clientes"
          value={totalCount}
          subtitle="Clientes registrados en la cartera"
          icon="group"
          iconBgClass="bg-indigo-50"
          iconColorClass="text-indigo-600"
          isActive={statusFilter === 'todos'}
          activeColor="indigo"
          onClick={() => setStatusFilter('todos')}
          titleTooltip="Filtrar por todos los clientes"
        />

        <KpiCard
          title="Con Deuda"
          value={conDeudaCount}
          subtitle="Clientes con saldo pendiente por cobrar"
          icon="warning"
          iconBgClass="bg-rose-50"
          iconColorClass="text-rose-600"
          valueColorClass="text-rose-600"
          subtitleColorClass="text-rose-600"
          isMono
          isActive={statusFilter === 'con_deuda'}
          activeColor="rose"
          onClick={() => setStatusFilter('con_deuda')}
          titleTooltip="Filtrar clientes con deuda pendiente"
        />

        <KpiCard
          title="Al Día"
          value={alDiaCount}
          subtitle="Clientes con balance sin deuda"
          icon="check_circle"
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-600"
          isMono
          isActive={statusFilter === 'al_dia'}
          activeColor="indigo"
          onClick={() => setStatusFilter('al_dia')}
          titleTooltip="Filtrar clientes al día"
        />

        <KpiCard
          title="Desactivados"
          value={desactivadosCount}
          subtitle="Clientes inactivos o dados de baja"
          icon="person_off"
          iconBgClass="bg-slate-100"
          iconColorClass="text-slate-600"
          valueColorClass="text-slate-700"
          isActive={statusFilter === 'desactivados' || statusFilter === 'Desactivado'}
          activeColor="indigo"
          onClick={() => setStatusFilter('desactivados')}
          titleTooltip="Filtrar clientes desactivados"
        />
      </KpiGrid>

      {/* Table Container (Pattern from Deuda) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls and Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Quick Filter Pills */}
          <FilterPills
            options={[
              { key: 'todos', label: 'Todos', count: totalCount },
              { key: 'con_deuda', label: 'Con Deuda', count: conDeudaCount },
              { key: 'al_dia', label: 'Al Día', count: alDiaCount },
              { key: 'desactivados', label: 'Desactivados', count: desactivadosCount },
            ]}
            activeKey={statusFilter === 'Desactivado' ? 'desactivados' : statusFilter}
            onSelect={(key) => setStatusFilter(key)}
            activeColor="indigo"
          />

          {/* Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {setSearchQuery && (
              <div className="relative flex-1 sm:w-64 md:w-72">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery || ''}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente por nombre o código..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-xs text-slate-800 placeholder:text-slate-400 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-5">Cliente</th>
                <th className="py-3 px-5 text-right">Saldo Pendiente</th>
                <th className="py-3 px-5 text-right">Límite Crédito</th>
                <th className="py-3 px-5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {totalCount === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-[28px]">person_add</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      No hay clientes registrados todavía.
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                      Comienza registrando tu primer cliente para habilitar créditos, consumos y cobranzas.
                    </p>
                    {onNewClient && (
                      <div className="mt-4">
                        <button
                          onClick={onNewClient}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">person_add</span>
                          <span>+ Nuevo Cliente</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : displayedClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <span className="material-symbols-outlined text-[28px]">search_off</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      No se encontraron clientes que coincidan con la búsqueda o los filtros aplicados.
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                      Prueba modificando los términos de búsqueda o restableciendo los filtros de estado.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {searchQuery && setSearchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[15px]">close</span>
                          <span>Limpiar búsqueda</span>
                        </button>
                      )}
                      {statusFilter !== 'todos' && (
                        <button
                          onClick={() => setStatusFilter('todos')}
                          className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
                          <span>Restaurar filtros</span>
                        </button>
                      )}
                    </div>
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
                      onClick={() => onEditClient(client)}
                      className={`hover:bg-slate-50/90 transition-colors cursor-pointer select-none ${
                        client.status === 'Desactivado' ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                      title="Clic para editar cliente"
                    >
                      {/* Name and Client Code */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {client.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                            {client.clientNumber}
                          </span>
                        </div>
                        {client.phone && (
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">{client.phone}</p>
                        )}
                      </td>

                      {/* Current Balance */}
                      <td
                        className={`py-3.5 px-5 font-mono font-extrabold text-sm text-right whitespace-nowrap ${
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

                      {/* Credit Limit */}
                      <td className="py-3.5 px-5 font-mono text-slate-700 font-semibold text-right whitespace-nowrap">
                        {client.creditLimit > 0
                          ? `S/ ${client.creditLimit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                          : 'Sin límite'}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100">
          {totalCount === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[28px]">person_add</span>
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                No hay clientes registrados todavía.
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                Comienza registrando tu primer cliente para habilitar créditos, consumos y cobranzas.
              </p>
              {onNewClient && (
                <div className="mt-4">
                  <button
                    onClick={onNewClient}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    <span>+ Nuevo Cliente</span>
                  </button>
                </div>
              )}
            </div>
          ) : displayedClients.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[28px]">search_off</span>
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                No se encontraron clientes que coincidan con la búsqueda o los filtros aplicados.
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                Prueba modificando los términos de búsqueda o restableciendo los filtros de estado.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {searchQuery && setSearchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                    <span>Limpiar búsqueda</span>
                  </button>
                )}
                {statusFilter !== 'todos' && (
                  <button
                    onClick={() => setStatusFilter('todos')}
                    className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
                    <span>Restaurar filtros</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            displayedClients.map((client) => {
              const isOverLimit =
                client.creditLimit > 0 &&
                client.currentBalance >= client.creditLimit * 0.9 &&
                client.currentBalance > 0;
              const hasDebt = client.currentBalance > 0;
              const hasFavor = client.currentBalance < 0;

              return (
                <div
                  key={client.id}
                  onClick={() => onEditClient(client)}
                  className={`p-4 space-y-3 cursor-pointer hover:bg-slate-50/90 active:bg-slate-100 transition-colors ${
                    client.status === 'Desactivado' ? 'opacity-60 bg-slate-50/40' : ''
                  }`}
                  title="Toca para editar cliente"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                        {client.clientNumber}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{client.name}</h4>
                      {client.phone && (
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <span>{client.phone}</span>
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
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
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Saldo Pendiente
                      </span>
                      <span
                        className={`font-mono font-extrabold text-sm ${
                          hasDebt
                            ? 'text-rose-600'
                            : hasFavor
                            ? 'text-emerald-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {hasFavor
                          ? `-S/ ${Math.abs(client.currentBalance).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                          : `S/ ${client.currentBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Límite Crédito
                      </span>
                      <span className="font-mono font-medium text-slate-700 text-sm">
                        {client.creditLimit > 0
                          ? `S/ ${client.creditLimit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                          : 'Sin límite'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination / Count Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Mostrando {displayedClients.length} de {totalCount} clientes</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={true}
              aria-disabled={true}
              onClick={(e) => e.preventDefault()}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-100/80 text-slate-400 opacity-60 cursor-not-allowed select-none text-xs font-semibold"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={true}
              aria-disabled={true}
              onClick={(e) => e.preventDefault()}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-100/80 text-slate-400 opacity-60 cursor-not-allowed select-none text-xs font-semibold"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
