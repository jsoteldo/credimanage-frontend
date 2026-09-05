import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, LoanCredit, User } from '../types';
import { api } from '../services/api';
import { formatCurrency, formatSpanishDate } from '../utils/loanCalculations';
import { PageHeader } from './PageHeader';
import { KpiGrid, KpiCard } from './KpiCard';
import { LoanScheduleModal } from './LoanScheduleModal';
import { GrantLoanModal } from './GrantLoanModal';

interface BankViewProps {
  clients: Client[];
  currentUser: User | null;
  onPayClient: (
    client: Client,
    options?: { mode: 'bankLoan'; targetLoan: LoanCredit }
  ) => void;
  onRefreshData: () => void;
}

export const BankView: React.FC<BankViewProps> = ({
  clients,
  currentUser,
  onPayClient,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [loans, setLoans] = useState<LoanCredit[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showGrantLoanModal, setShowGrantLoanModal] = useState(false);
  const [preselectedClientId, setPreselectedClientId] = useState<string | null>(null);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<LoanCredit | null>(null);

  // Annul loan state (admin only)
  const [annulLoanId, setAnnulLoanId] = useState<string | null>(null);
  const [annulReason, setAnnulReason] = useState('');
  const [annulLoading, setAnnulLoading] = useState(false);
  const annulSubmittingRef = useRef(false);

  // Load all loans
  const loadLoans = async () => {
    setLoading(true);
    try {
      const data = await api.getAllLoans();
      setLoans(data);
    } catch (err) {
      console.error('Error al cargar créditos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  // Filter Active vs Historical
  const activeLoans = useMemo(() => {
    return loans.filter((l) => (l.status === 'Activo' || l.status === 'Vencido') && l.pendingAmount > 0.01);
  }, [loans]);

  const historyLoans = useMemo(() => {
    return loans.filter((l) => l.status === 'Pagado' || l.status === 'Anulado' || l.pendingAmount <= 0.01);
  }, [loans]);

  // Apply search query
  const filteredActiveLoans = useMemo(() => {
    if (!searchQuery.trim()) return activeLoans;
    const q = searchQuery.toLowerCase().trim();
    return activeLoans.filter(
      (l) =>
        (l.clientName && l.clientName.toLowerCase().includes(q)) ||
        (l.clientNumber && l.clientNumber.toLowerCase().includes(q)) ||
        (l.code && l.code.toLowerCase().includes(q)) ||
        (l.ticketNumber && l.ticketNumber.toLowerCase().includes(q))
    );
  }, [activeLoans, searchQuery]);

  const filteredHistoryLoans = useMemo(() => {
    if (!searchQuery.trim()) return historyLoans;
    const q = searchQuery.toLowerCase().trim();
    return historyLoans.filter(
      (l) =>
        (l.clientName && l.clientName.toLowerCase().includes(q)) ||
        (l.clientNumber && l.clientNumber.toLowerCase().includes(q)) ||
        (l.code && l.code.toLowerCase().includes(q)) ||
        (l.ticketNumber && l.ticketNumber.toLowerCase().includes(q))
    );
  }, [historyLoans, searchQuery]);

  // Financial KPIs for Banco
  const totalActiveCapital = useMemo(() => {
    return activeLoans.reduce((sum, l) => sum + (l.capital || 0), 0);
  }, [activeLoans]);

  const totalActivePending = useMemo(() => {
    return activeLoans.reduce((sum, l) => sum + (l.pendingAmount || 0), 0);
  }, [activeLoans]);

  const totalFinishedCount = historyLoans.length;

  const handleOpenGrantLoan = (clientId?: string) => {
    setPreselectedClientId(clientId || null);
    setShowGrantLoanModal(true);
  };

  const handleGrantLoanSubmit = async (clientId: string, loanData: any) => {
    await api.createLoanCredit(clientId, loanData);
    await loadLoans();
    onRefreshData();
  };

  const handleAnnulLoan = async () => {
    if (!annulLoanId || !annulReason.trim()) return;
    if (annulSubmittingRef.current) return;

    annulSubmittingRef.current = true;
    setAnnulLoading(true);
    try {
      await api.annulLoan(annulLoanId, annulReason.trim());
      setAnnulLoanId(null);
      setAnnulReason('');
      await loadLoans();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al anular el crédito');
    } finally {
      annulSubmittingRef.current = false;
      setAnnulLoading(false);
    }
  };

  const handlePayLoan = (loan: LoanCredit) => {
    const client = clients.find((c) => c.id === loan.clientId);
    if (client) {
      onPayClient(client, { mode: 'bankLoan', targetLoan: loan });
    } else {
      alert('Cliente no encontrado');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        icon="account_balance"
        title="Banco • Créditos con Intereses"
        subtitle="Gestión especializada de préstamos con interés, cuotas, cronogramas y cobranzas."
        actions={
          <button
            onClick={() => handleOpenGrantLoan()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-xs shadow-indigo-600/30 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Otorgar Crédito con Intereses</span>
          </button>
        }
      />

      {/* KPI Cards Grid */}
      <KpiGrid>
        <KpiCard
          title="Créditos Activos"
          value={activeLoans.length}
          subtitle="Operaciones vigentes con cuotas pendientes"
          icon="finance_mode"
          iconBgClass="bg-indigo-50"
          iconColorClass="text-indigo-600"
        />

        <KpiCard
          title="Capital Colocado Activo"
          value={formatCurrency(totalActiveCapital)}
          subtitle="Monto principal prestado a clientes"
          icon="payments"
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-600"
          subtitleColorClass="text-emerald-600"
          isMono
        />

        <KpiCard
          title="Total por Cobrar"
          value={formatCurrency(totalActivePending)}
          subtitle="Capital e intereses pendientes en cuotas"
          icon="hourglass_top"
          iconBgClass="bg-rose-50"
          iconColorClass="text-rose-600"
          valueColorClass="text-rose-600"
          subtitleColorClass="text-rose-600"
          isMono
        />

        <KpiCard
          title="Créditos Finalizados"
          value={totalFinishedCount}
          subtitle="Histórico de créditos cerrados y pagados"
          icon="history"
          iconBgClass="bg-slate-100"
          iconColorClass="text-slate-600"
        />
      </KpiGrid>

      {/* Main Content Box with Two Distinct Views */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Navigation Tabs and Search Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-200/60 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">finance_mode</span>
              <span>Créditos Activos ({activeLoans.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span>Historial de Créditos ({historyLoans.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72 shrink-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, código o ticket..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-xs text-slate-800 placeholder:text-slate-400 transition-all outline-none"
            />
          </div>
        </div>

        {/* TAB 1: CRÉDITOS ACTIVOS (VISTA PRINCIPAL) */}
        {activeTab === 'active' && (
          <div>
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <span className="material-symbols-outlined animate-spin text-[32px] text-indigo-600">sync</span>
                <p className="mt-2 text-xs font-medium">Cargando créditos activos...</p>
              </div>
            ) : activeLoans.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[28px]">finance_mode</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  No hay créditos con intereses activos.
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Registra un préstamo con amortización en cuotas para comenzar la gestión de cartera bancaria.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => handleOpenGrantLoan()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    <span>Otorgar Crédito con Intereses</span>
                  </button>
                </div>
              </div>
            ) : filteredActiveLoans.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[28px]">search_off</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  No se encontraron créditos que coincidan con la búsqueda.
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Prueba modificando el texto de búsqueda por cliente, código o folio.
                </p>
                {searchQuery && (
                  <div className="mt-4">
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                      <span>Limpiar búsqueda</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Código / Fecha
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Cliente
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                          Capital
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                          Interés (%)
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                          Total Crédito
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                          Cuotas
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                          Saldo Pendiente
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                          Estado
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredActiveLoans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-5 whitespace-nowrap">
                            <span className="font-mono font-extrabold text-indigo-700 block">
                              {loan.code}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatSpanishDate(loan.date)}
                            </span>
                          </td>

                          <td className="py-3.5 px-5">
                            <span className="text-sm font-bold text-slate-900 block">
                              {loan.clientName || 'Cliente'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {loan.clientNumber}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(loan.capital)}
                          </td>

                          <td className="py-3.5 px-5 text-right font-mono text-indigo-600 font-semibold whitespace-nowrap">
                            +{formatCurrency(loan.interestAmount)} ({loan.interestRate}%)
                          </td>

                          <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(loan.totalAmount)}
                          </td>

                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <span className="font-semibold text-slate-800">
                              {loan.installmentsCount} ({loan.frequency})
                            </span>
                            <div className="text-[10px] text-emerald-600 font-bold">
                              {loan.paidInstallmentsCount || 0}/{loan.installmentsCount} pagadas
                            </div>
                          </td>

                          <td className="py-3.5 px-5 text-right font-mono font-extrabold text-rose-600 text-sm whitespace-nowrap">
                            {formatCurrency(loan.pendingAmount)}
                          </td>

                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                loan.status === 'Activo'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {loan.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Cronograma */}
                              <button
                                onClick={() => setSelectedLoanForSchedule(loan)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Ver cronograma detallado de cuotas"
                              >
                                <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                                <span>Cronograma</span>
                              </button>

                              {/* Registrar Pago */}
                              <button
                                onClick={() => handlePayLoan(loan)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Registrar abono o pago para este crédito"
                              >
                                <span className="material-symbols-outlined text-[14px]">payments</span>
                                <span>Pagar</span>
                              </button>

                              {/* Anular (Admin only) */}
                              {currentUser?.role === 'Administrador' && loan.paidAmount === 0 && (
                                <button
                                  onClick={() => setAnnulLoanId(loan.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                  title="Anular crédito sin pagos"
                                >
                                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredActiveLoans.map((loan) => (
                    <div key={loan.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-extrabold text-indigo-700 text-xs">
                              {loan.code}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              • {formatSpanishDate(loan.date)}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                            {loan.clientName}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-mono">{loan.clientNumber}</p>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            loan.status === 'Activo'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {loan.status}
                        </span>
                      </div>

                      {/* Financial details grid */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Capital / Interés
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {formatCurrency(loan.capital)} (+{loan.interestRate}%)
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Saldo Pendiente
                          </span>
                          <span className="font-mono font-extrabold text-rose-600 text-sm">
                            {formatCurrency(loan.pendingAmount)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Cuotas
                          </span>
                          <span className="font-medium text-slate-700">
                            {loan.paidInstallmentsCount || 0}/{loan.installmentsCount} ({loan.frequency})
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Valor por Cuota
                          </span>
                          <span className="font-mono font-semibold text-indigo-700">
                            {formatCurrency(loan.installmentAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap justify-end items-center gap-2 pt-1">
                        <button
                          onClick={() => setSelectedLoanForSchedule(loan)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                          <span>Cronograma</span>
                        </button>

                        <button
                          onClick={() => handlePayLoan(loan)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[14px]">payments</span>
                          <span>Pagar Cuota</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: HISTORIAL DE CRÉDITOS (VISTA DE CONSULTA REQ 9) */}
        {activeTab === 'history' && (
          <div>
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <span className="material-symbols-outlined animate-spin text-[32px] text-indigo-600">sync</span>
                <p className="mt-2 text-xs font-medium">Cargando historial de créditos...</p>
              </div>
            ) : historyLoans.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[28px]">history</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  No hay créditos finalizados en el historial.
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Los créditos totalmente saldados o finalizados se conservarán aquí permanentemente para consulta contable.
                </p>
              </div>
            ) : filteredHistoryLoans.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[28px]">search_off</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  No se encontraron créditos históricos que coincidan con la búsqueda o filtros.
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Prueba modificando el texto de búsqueda por cliente o código.
                </p>
                {searchQuery && (
                  <div className="mt-4">
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">close</span>
                      <span>Limpiar búsqueda</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Desktop History Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Crédito
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Cliente
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                          Monto Original
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                          Fecha Otorgamiento
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                          Fecha Finalización
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                          Estado
                        </th>
                        <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                          Consulta
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredHistoryLoans.map((loan) => {
                        const isAnulado = loan.status === 'Anulado';
                        const lastPaidDate = loan.installments
                          ?.filter((i) => i.paidDate)
                          ?.sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || ''))[0]?.paidDate;

                        return (
                          <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors opacity-80 hover:opacity-100">
                            <td className="py-3.5 px-5 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-800 block">
                                {loan.code}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {loan.installmentsCount} cuotas {loan.frequency}
                              </span>
                            </td>

                            <td className="py-3.5 px-5">
                              <span className="text-sm font-bold text-slate-900 block">
                                {loan.clientName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {loan.clientNumber}
                              </span>
                            </td>

                            <td className="py-3.5 px-5 text-right font-mono whitespace-nowrap">
                              <span className="font-bold text-slate-900 block">
                                {formatCurrency(loan.totalAmount)}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                (Cap: {formatCurrency(loan.capital)})
                              </span>
                            </td>

                            <td className="py-3.5 px-5 text-center whitespace-nowrap font-medium text-slate-700">
                              {formatSpanishDate(loan.date)}
                            </td>

                            <td className="py-3.5 px-5 text-center whitespace-nowrap font-medium text-slate-700">
                              {loan.annulledAt
                                ? formatSpanishDate(loan.annulledAt)
                                : lastPaidDate
                                ? formatSpanishDate(lastPaidDate)
                                : '-'}
                            </td>

                            <td className="py-3.5 px-5 text-center whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isAnulado
                                    ? 'bg-slate-100 text-slate-500 border border-slate-200 line-through'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {loan.status}
                              </span>
                            </td>

                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedLoanForSchedule(loan)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Ver cronograma histórico de este crédito"
                              >
                                <span className="material-symbols-outlined text-[14px]">visibility</span>
                                <span>Ver Detalle</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile History Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredHistoryLoans.map((loan) => (
                    <div key={loan.id} className="p-4 space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono font-bold text-slate-800 text-xs">
                            {loan.code}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                            {loan.clientName}
                          </h4>
                          <span className="font-mono text-[10px] text-slate-500">{loan.clientNumber}</span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            loan.status === 'Anulado'
                              ? 'bg-slate-100 text-slate-500 border border-slate-200 line-through'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {loan.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Monto Total
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrency(loan.totalAmount)}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Otorgamiento
                          </span>
                          <span className="font-medium text-slate-700">
                            {formatSpanishDate(loan.date)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => setSelectedLoanForSchedule(loan)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          <span>Ver Cronograma</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Reused GrantLoanModal */}
      {showGrantLoanModal && (
        <GrantLoanModal
          isOpen={showGrantLoanModal}
          onClose={() => setShowGrantLoanModal(false)}
          clients={clients}
          initialClientId={preselectedClientId}
          onSubmit={handleGrantLoanSubmit}
          onClientCreated={onRefreshData}
        />
      )}

      {/* Reused LoanScheduleModal */}
      {selectedLoanForSchedule && (
        <LoanScheduleModal
          isOpen={!!selectedLoanForSchedule}
          onClose={() => setSelectedLoanForSchedule(null)}
          clientName={selectedLoanForSchedule.clientName || 'Cliente'}
          capital={selectedLoanForSchedule.capital}
          interestRate={selectedLoanForSchedule.interestRate}
          interestAmount={selectedLoanForSchedule.interestAmount}
          totalAmount={selectedLoanForSchedule.totalAmount}
          installmentsCount={selectedLoanForSchedule.installmentsCount}
          frequency={selectedLoanForSchedule.frequency}
          installments={selectedLoanForSchedule.installments}
          title="Cronograma de Cuotas del Crédito"
          code={selectedLoanForSchedule.code}
        />
      )}

      {/* Annul Loan Confirmation Modal (Admin) */}
      {annulLoanId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Anular Crédito con Intereses</h3>
            <p className="text-xs text-slate-500 mb-3">
              Esta acción anulará el crédito y revertirá su saldo. Solo permitido en créditos sin abonos.
            </p>
            <textarea
              rows={3}
              required
              placeholder="Motivo de la anulación del crédito (obligatorio)..."
              value={annulReason}
              onChange={(e) => setAnnulReason(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAnnulLoanId(null);
                  setAnnulReason('');
                }}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!annulReason.trim() || annulLoading}
                onClick={handleAnnulLoan}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {annulLoading ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
