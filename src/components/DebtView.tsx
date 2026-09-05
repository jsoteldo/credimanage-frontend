import React, { useState, useEffect, useMemo } from 'react';
import { Client, CreditPurchase, Payment, User } from '../types';
import { api } from '../services/api';
import { formatCurrency } from '../utils/loanCalculations';
import { CurrentDebtAdminModal } from './CurrentDebtAdminModal';
import { PageHeader } from './PageHeader';
import { KpiGrid, KpiCard } from './KpiCard';
import { FilterPills } from './FilterPills';

interface DebtViewProps {
  clients: Client[];
  currentUser?: User | null;
  onViewStatement: (client: Client) => void;
  onPayClient: (client: Client) => void;
  onAddDebtClient: (client: Client | null) => void;
  onRefreshData: () => void;
}

export const DebtView: React.FC<DebtViewProps> = ({
  clients,
  currentUser = null,
  onViewStatement,
  onPayClient,
  onAddDebtClient,
  onRefreshData,
}) => {
  // Main view tabs: 'clients' (Cartera de Deudores) or 'movements' (Kardex Global de Deuda Corriente)
  const [activeMainTab, setActiveMainTab] = useState<'clients' | 'movements'>('clients');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubtype, setFilterSubtype] = useState<'all' | 'near_limit' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'debt_desc' | 'debt_asc' | 'name_asc'>('debt_desc');

  // Client Debt Admin Modal state
  const [clientForDebtAdmin, setClientForDebtAdmin] = useState<Client | null>(null);

  // Sync clientForDebtAdmin with fresh clients prop to avoid stale selection
  const currentClientForDebtAdmin = useMemo(() => {
    if (!clientForDebtAdmin) return null;
    return clients.find((c) => c.id === clientForDebtAdmin.id) || clientForDebtAdmin;
  }, [clients, clientForDebtAdmin]);

  // Global Movements state
  const [globalMovementsLoading, setGlobalMovementsLoading] = useState(false);
  const [allPurchases, setAllPurchases] = useState<CreditPurchase[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [movementsDateFilter, setMovementsDateFilter] = useState<'today' | 'last7' | 'thismonth' | 'all'>('thismonth');
  const [movementsTypeFilter, setMovementsTypeFilter] = useState<'all' | 'charges' | 'payments'>('all');
  const [movementsSearch, setMovementsSearch] = useState('');

  // Load global movements when switching to movements tab
  const loadGlobalMovements = async () => {
    setGlobalMovementsLoading(true);
    try {
      const dateParam = movementsDateFilter === 'all' ? undefined : movementsDateFilter;
      const [purchasesRes, paymentsRes] = await Promise.all([
        api.getPurchasesHistory({ dateFilter: dateParam }),
        api.getPaymentsHistory({ dateFilter: dateParam }),
      ]);
      // Exclude purchases that are bank loans with installments
      const filteredPurchases = (purchasesRes.purchases || []).filter(
        (p) => !p.loanId && p.debtType !== 'credit'
      );
      setAllPurchases(filteredPurchases);
      setAllPayments(paymentsRes.payments || []);
    } catch (err) {
      console.error('Error al cargar movimientos de deuda corriente:', err);
    } finally {
      setGlobalMovementsLoading(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'movements') {
      loadGlobalMovements();
    }
  }, [activeMainTab, movementsDateFilter]);

  // Filter: clients who currently have pending daily debt (> 0, including S/ 0.01)
  const clientsWithDailyDebt = useMemo(() => {
    return clients.filter((client) => (client.dailyDebtBalance ?? 0) > 0);
  }, [clients]);

  // Apply search query, subtype filter, and sorting
  const displayedClients = useMemo(() => {
    let list = [...clientsWithDailyDebt];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.clientNumber.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
      );
    }

    // Subtype filter
    if (filterSubtype === 'near_limit') {
      list = list.filter((c) => {
        const dailyDebt = c.dailyDebtBalance ?? 0;
        return c.creditLimit > 0 && dailyDebt >= c.creditLimit * 0.9;
      });
    } else if (filterSubtype === 'overdue') {
      const today = new Date().toISOString().split('T')[0];
      list = list.filter((c) => c.nextDueDate && c.nextDueDate < today);
    }

    // Sorting
    list.sort((a, b) => {
      const debtA = a.dailyDebtBalance ?? 0;
      const debtB = b.dailyDebtBalance ?? 0;
      if (sortBy === 'debt_desc') return debtB - debtA;
      if (sortBy === 'debt_asc') return debtA - debtB;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });

    return list;
  }, [clientsWithDailyDebt, searchQuery, filterSubtype, sortBy]);

  // Aggregate Metrics
  const totalDailyDebtAmount = useMemo(() => {
    return clientsWithDailyDebt.reduce((sum, c) => sum + (c.dailyDebtBalance ?? 0), 0);
  }, [clientsWithDailyDebt]);

  const averageDailyDebt = useMemo(() => {
    if (clientsWithDailyDebt.length === 0) return 0;
    return totalDailyDebtAmount / clientsWithDailyDebt.length;
  }, [clientsWithDailyDebt, totalDailyDebtAmount]);

  const nearLimitCount = useMemo(() => {
    return clientsWithDailyDebt.filter((c) => {
      const dailyDebt = c.dailyDebtBalance ?? 0;
      return c.creditLimit > 0 && dailyDebt >= c.creditLimit * 0.9;
    }).length;
  }, [clientsWithDailyDebt]);

  // Unified list of global movements for current debt
  const unifiedGlobalMovements = useMemo(() => {
    const list: {
      id: string;
      date: string;
      clientId: string;
      clientName: string;
      clientNumber: string;
      type: 'cargo' | 'abono';
      concept: string;
      ticket?: string;
      amount: number;
      registeredBy: string;
      status: string;
    }[] = [];

    // Add purchases / charges
    if (movementsTypeFilter === 'all' || movementsTypeFilter === 'charges') {
      allPurchases.forEach((p: any) => {
        list.push({
          id: p.id,
          date: p.date,
          clientId: p.clientId,
          clientName: p.clientName || 'Cliente',
          clientNumber: p.clientNumber || '',
          type: 'cargo',
          concept: p.product,
          ticket: p.ticketNumber,
          amount: p.amount,
          registeredBy: p.registeredBy,
          status: p.status,
        });
      });
    }

    // Add payments / abonos
    if (movementsTypeFilter === 'all' || movementsTypeFilter === 'payments') {
      allPayments.forEach((pay: any) => {
        list.push({
          id: pay.id,
          date: pay.date,
          clientId: pay.clientId,
          clientName: pay.clientName || 'Cliente',
          clientNumber: pay.clientNumber || '',
          type: 'abono',
          concept: `Abono (${pay.paymentMethod})${pay.notes ? ` - ${pay.notes}` : ''}`,
          ticket: pay.id.slice(-6).toUpperCase(),
          amount: pay.amount,
          registeredBy: pay.registeredBy,
          status: pay.status,
        });
      });
    }

    // Filter by search
    let filtered = list;
    if (movementsSearch.trim()) {
      const q = movementsSearch.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          m.clientName.toLowerCase().includes(q) ||
          m.clientNumber.toLowerCase().includes(q) ||
          m.concept.toLowerCase().includes(q) ||
          (m.ticket && m.ticket.toLowerCase().includes(q))
      );
    }

    // Sort descending by date
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return filtered;
  }, [allPurchases, allPayments, movementsTypeFilter, movementsSearch]);

  // Total metrics for movements in the selected period
  const totalChargesPeriod = useMemo(() => {
    return allPurchases
      .filter((p) => p.status === 'Activo')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [allPurchases]);

  const totalPaymentsPeriod = useMemo(() => {
    return allPayments
      .filter((p) => p.status === 'Activo')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [allPayments]);

  const netBalancePeriod = totalChargesPeriod - totalPaymentsPeriod;


  return (
    <div className="space-y-6">
      {/* Top Header with Primary Action Button */}
      <PageHeader
        icon="shopping_bag"
        iconBgClass="bg-rose-600"
        title="Deuda • Consumos y Compras a Crédito"
        subtitle="Gestión exclusiva de deudas corrientes, compras en tienda, cargos y abonos de clientes."
        actions={
          <button
            onClick={() => onAddDebtClient(null)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
            title="Cargar una nueva deuda o consumo a cualquier cliente registrado, tenga o no deuda actual"
          >
            <span className="material-symbols-outlined text-[20px]">post_add</span>
            <span>+ Cargar Nueva Deuda</span>
          </button>
        }
      />

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1 shadow-2xs">
        <button
          onClick={() => setActiveMainTab('clients')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'clients'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">group</span>
          <span>Cartera de Clientes con Deuda ({clientsWithDailyDebt.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('movements')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'movements'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          <span>Kardex y Movimientos de Deuda Corriente</span>
        </button>
      </div>

      {/* TAB 1: LISTADO DE CLIENTES CON DEUDA PENDIENTE */}
      {activeMainTab === 'clients' && (
        <>
          {/* KPI Cards Grid */}
          <KpiGrid>
            <KpiCard
              title="Clientes con Deuda"
              value={clientsWithDailyDebt.length}
              subtitle="Clientes con saldo pendiente por consumos"
              icon="group"
              iconBgClass="bg-rose-50"
              iconColorClass="text-rose-600"
            />

            <KpiCard
              title="Cartera Total Diaria"
              value={formatCurrency(totalDailyDebtAmount)}
              subtitle="Total adeudado en compras y consumos"
              icon="payments"
              iconBgClass="bg-rose-50"
              iconColorClass="text-rose-600"
              valueColorClass="text-rose-600"
              subtitleColorClass="text-rose-600"
              isMono
            />

            <KpiCard
              title="Promedio por Cliente"
              value={formatCurrency(averageDailyDebt)}
              subtitle="Ticket promedio de deuda corriente"
              icon="analytics"
              iconBgClass="bg-amber-50"
              iconColorClass="text-amber-600"
              isMono
            />

            <KpiCard
              title="Cerca del Límite (≥90%)"
              value={nearLimitCount}
              subtitle="Clientes que rozan o superan su crédito"
              icon="warning"
              iconBgClass="bg-purple-50"
              iconColorClass="text-purple-600"
              valueColorClass="text-purple-700"
              subtitleColorClass="text-purple-600"
            />
          </KpiGrid>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Controls and Filter Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              {/* Quick Filters */}
              <FilterPills
                options={[
                  { key: 'all', label: 'Todos', count: clientsWithDailyDebt.length },
                  { key: 'near_limit', label: 'Cerca del Límite', count: nearLimitCount },
                  { key: 'overdue', label: 'Cobro Vencido' },
                ]}
                activeKey={filterSubtype}
                onSelect={(key) => setFilterSubtype(key as any)}
                activeColor="rose"
              />

              {/* Search & Sort Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar cliente por nombre o código..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-xs text-slate-800 placeholder:text-slate-400 outline-none"
                  />
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="debt_desc">Mayor Deuda</option>
                  <option value="debt_asc">Menor Deuda</option>
                  <option value="name_asc">Nombre A-Z</option>
                </select>
              </div>
            </div>

            {/* Content Table */}
            {clientsWithDailyDebt.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[28px]">payments</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  No hay clientes con deuda corriente pendiente.
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Puedes cargar una nueva deuda a cualquier cliente activo.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => onAddDebtClient(null)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">post_add</span>
                    <span>+ Cargar Nueva Deuda</span>
                  </button>
                </div>
              </div>
            ) : displayedClients.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[28px]">search_off</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  No se encontraron clientes con deuda que coincidan con los filtros aplicados.
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Prueba modificando el texto de búsqueda o restableciendo los filtros de cartera.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                      <span>Limpiar búsqueda</span>
                    </button>
                  )}
                  {filterSubtype !== 'all' && (
                    <button
                      onClick={() => setFilterSubtype('all')}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
                      <span>Restaurar filtros</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-5">Cliente</th>
                        <th className="py-3 px-5 text-right">Deuda Diaria Pendiente</th>
                        <th className="py-3 px-5 text-right">Límite / Disponible</th>
                        <th className="py-3 px-5 text-center">Periodo de Cobro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {displayedClients.map((client) => {
                        const dailyDebt = client.dailyDebtBalance ?? 0;
                        const creditLimit = client.creditLimit;
                        const isOverLimit = creditLimit > 0 && dailyDebt > creditLimit;
                        const available = client.availableCredit != null ? client.availableCredit : (creditLimit > 0 ? Math.max(0, creditLimit - dailyDebt) : null);
                        const percentUsed = creditLimit > 0 ? Math.min(100, Math.round((dailyDebt / creditLimit) * 100)) : 0;

                        return (
                          <tr
                            key={client.id}
                            onClick={() => setClientForDebtAdmin(client)}
                            className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                            title="Clic para Administrar Deuda"
                          >
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">{client.name}</span>
                                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                                  {client.clientNumber}
                                </span>
                              </div>
                              {client.phone && (
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{client.phone}</p>
                              )}
                            </td>

                            <td className="py-3.5 px-5 text-right font-mono font-extrabold text-rose-600 text-sm whitespace-nowrap">
                              {formatCurrency(dailyDebt)}
                              {isOverLimit && (
                                <span className="block text-[10px] font-bold text-rose-600">⚠️ Límite Excedido</span>
                              )}
                            </td>

                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <div className="font-mono text-slate-700 font-semibold">
                                {creditLimit > 0 ? formatCurrency(creditLimit) : 'Sin límite'}
                              </div>
                              {creditLimit > 0 && (
                                <div className="mt-1 flex items-center justify-end gap-1.5">
                                  <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        percentUsed >= 90 ? 'bg-rose-600' : 'bg-indigo-600'
                                      }`}
                                      style={{ width: `${percentUsed}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400">{percentUsed}%</span>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-5 text-center text-slate-600 font-medium whitespace-nowrap">
                              <div>{client.paymentPeriod || 'Mensual'}</div>
                              {client.paymentDay && (
                                <span className="text-[10px] text-slate-400 font-mono">({client.paymentDay})</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {displayedClients.map((client) => {
                    const dailyDebt = client.dailyDebtBalance ?? 0;

                    return (
                      <div
                        key={client.id}
                        onClick={() => setClientForDebtAdmin(client)}
                        className="p-4 space-y-3 cursor-pointer hover:bg-slate-50/90 active:bg-slate-100 transition-colors"
                        title="Toca para Administrar Deuda"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                              {client.clientNumber}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 mt-0.5">{client.name}</h4>
                            {client.phone && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{client.phone}</p>
                            )}
                          </div>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                            Deuda Corriente
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Deuda Diaria
                            </span>
                            <span className="font-mono font-extrabold text-rose-600 text-sm">
                              {formatCurrency(dailyDebt)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Límite Crédito
                            </span>
                            <span className="font-mono font-medium text-slate-700">
                              {client.creditLimit > 0 ? formatCurrency(client.creditLimit) : 'Sin límite'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* TAB 2: KARDEX Y MOVIMIENTOS GLOBALES DE DEUDA CORRIENTE */}
      {activeMainTab === 'movements' && (
        <div className="space-y-4">
          {/* Movement Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Total Cargos y Compras (+)
              </span>
              <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">
                +{formatCurrency(totalChargesPeriod)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Compras a crédito y cargos registrados en el período
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Total Abonos Cobrados (-)
              </span>
              <div className="text-2xl font-black text-emerald-600 font-mono tracking-tight">
                -{formatCurrency(totalPaymentsPeriod)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Recaudación y cobranza aplicada a cuenta corriente
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Flujo Neto del Período
              </span>
              <div
                className={`text-2xl font-black font-mono tracking-tight ${
                  netBalancePeriod > 0 ? 'text-rose-600' : 'text-indigo-600'
                }`}
              >
                {netBalancePeriod >= 0 ? `+${formatCurrency(netBalancePeriod)}` : formatCurrency(netBalancePeriod)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Variación neta en la cartera de deuda corriente
              </p>
            </div>
          </div>

          {/* Movements Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              {/* Date Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setMovementsDateFilter('today')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    movementsDateFilter === 'today'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setMovementsDateFilter('last7')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    movementsDateFilter === 'last7'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Últimos 7 Días
                </button>
                <button
                  onClick={() => setMovementsDateFilter('thismonth')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    movementsDateFilter === 'thismonth'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Este Mes
                </button>
                <button
                  onClick={() => setMovementsDateFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    movementsDateFilter === 'all'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Todo el Historial
                </button>
              </div>

              {/* Search & Type filter */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={movementsTypeFilter}
                  onChange={(e) => setMovementsTypeFilter(e.target.value as any)}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">Todos los Movimientos</option>
                  <option value="charges">Solo Cargos / Compras (+)</option>
                  <option value="payments">Solo Abonos (-)</option>
                </select>

                <div className="relative flex-1 md:w-56">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={movementsSearch}
                    onChange={(e) => setMovementsSearch(e.target.value)}
                    placeholder="Filtrar movimientos..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Movements Table */}
            {globalMovementsLoading ? (
              <div className="p-12 text-center text-slate-400">
                <span className="material-symbols-outlined animate-spin text-[32px] text-rose-600">sync</span>
                <p className="mt-2 text-xs font-medium">Cargando kardex de deuda corriente...</p>
              </div>
            ) : unifiedGlobalMovements.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-[36px] text-slate-300">history</span>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  No se registraron movimientos de deuda corriente para el período seleccionado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-4">Fecha y Hora</th>
                      <th className="py-2.5 px-4">Cliente</th>
                      <th className="py-2.5 px-4">Tipo Movimiento</th>
                      <th className="py-2.5 px-4">Concepto / Detalle</th>
                      <th className="py-2.5 px-4 text-right">Importe</th>
                      <th className="py-2.5 px-4">Registrado Por</th>
                      <th className="py-2.5 px-4 text-center">Estado</th>
                      <th className="py-2.5 px-4 text-right">Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {unifiedGlobalMovements.map((m) => {
                      const isCharge = m.type === 'cargo';
                      return (
                        <tr
                          key={`${m.type}-${m.id}`}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            m.status === 'Anulado' ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800">
                              {new Date(m.date).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {new Date(m.date).toLocaleTimeString('es-PE', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{m.clientName}</div>
                            <span className="font-mono text-[10px] text-slate-400">{m.clientNumber}</span>
                          </td>

                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isCharge
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {isCharge ? 'arrow_upward' : 'arrow_downward'}
                              </span>
                              {isCharge ? 'Cargo / Compra' : 'Abono'}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-slate-800">
                            <div>{m.concept}</div>
                            {m.ticket && (
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                {m.ticket}
                              </span>
                            )}
                          </td>

                          <td
                            className={`py-2.5 px-4 text-right font-mono font-extrabold whitespace-nowrap ${
                              isCharge ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {isCharge ? `+${formatCurrency(m.amount)}` : `-${formatCurrency(m.amount)}`}
                          </td>

                          <td className="py-2.5 px-4 text-slate-500 font-medium whitespace-nowrap">
                            {m.registeredBy}
                          </td>

                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                m.status === 'Activo'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-rose-50 text-rose-600 line-through'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                const found = clients.find((c) => c.id === m.clientId);
                                if (found) setClientForDebtAdmin(found);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Abrir kardex exclusivo de este cliente"
                            >
                              Kardex
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Client Current Debt Administration Modal */}
      {currentClientForDebtAdmin && (
        <CurrentDebtAdminModal
          isOpen={Boolean(currentClientForDebtAdmin)}
          onClose={() => setClientForDebtAdmin(null)}
          client={currentClientForDebtAdmin}
          currentUser={currentUser}
          onOpenAddDebt={(c) => {
            setClientForDebtAdmin(null);
            onAddDebtClient(c);
          }}
          onOpenPayment={(c) => {
            setClientForDebtAdmin(null);
            onPayClient(c);
          }}
          onRefreshData={onRefreshData}
        />
      )}
    </div>
  );
};
