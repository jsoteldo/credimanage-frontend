import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Client, CreditPurchase, Payment, LoanCredit, User } from '../types';
import { api } from '../services/api';
import { formatCurrency, formatSpanishDate } from '../utils/loanCalculations';

interface StatementOfAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  currentUser: User | null;
  onOpenPaymentModal: (
    client: Client,
    isFullPayoff: boolean,
    options?: { mode: 'dailyDebt' | 'bankLoan'; targetLoan?: LoanCredit }
  ) => void;
  onOpenAddDebtModal?: (client: Client) => void;
  onRefreshData: () => void;
}

export const StatementOfAccountModal: React.FC<StatementOfAccountModalProps> = ({
  isOpen,
  onClose,
  client,
  currentUser,
  onOpenPaymentModal,
  onOpenAddDebtModal,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'purchases' | 'loans' | 'payments'>('purchases');
  const [statementData, setStatementData] = useState<{
    client: Client;
    availableCredit: number | string;
    purchases: CreditPurchase[];
    payments: Payment[];
    loans?: LoanCredit[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Credit Purchase Modal state
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [unitPrice, setUnitPrice] = useState<number | string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [ticketNumber, setTicketNumber] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const purchaseSubmittingRef = useRef(false);

  // Annul payment state
  const [annulPaymentId, setAnnulPaymentId] = useState<string | null>(null);
  const [annulReason, setAnnulReason] = useState('');
  const [annulLoading, setAnnulLoading] = useState(false);
  const annulSubmittingRef = useRef(false);

  const loadStatement = async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStatementOfAccount(client.id);
      setStatementData(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar el estado de cuenta');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && client) {
      loadStatement();
    } else {
      setStatementData(null);
    }
  }, [isOpen, client]);

  const activeLoans = useMemo(() => {
    return (statementData?.loans || []).filter(
      (l) => l.status === 'Activo' || l.status === 'Vencido' || (l.pendingAmount ?? 0) > 0.01
    );
  }, [statementData?.loans]);

  if (!isOpen || !client) return null;

  const currentClient = client || statementData?.client;
  const availableCredit =
    currentClient.availableCredit != null
      ? currentClient.availableCredit
      : currentClient.creditLimit > 0
      ? Math.max(0, currentClient.creditLimit - (currentClient.creditExposure ?? currentClient.currentBalance))
      : 'Sin límite';

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseSubmittingRef.current || !productName.trim() || !unitPrice) return;

    purchaseSubmittingRef.current = true;
    setPurchaseLoading(true);
    try {
      await api.addCreditPurchase(client.id, {
        product: productName.trim(),
        unitPrice: parseFloat(String(unitPrice)),
        quantity,
        ticketNumber: ticketNumber.trim() || undefined,
      });
      setShowAddPurchaseModal(false);
      setProductName('');
      setUnitPrice('');
      setQuantity(1);
      setTicketNumber('');
      await loadStatement();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al registrar la compra a crédito');
    } finally {
      purchaseSubmittingRef.current = false;
      setPurchaseLoading(false);
    }
  };

  const handleAnnulPayment = async () => {
    if (annulSubmittingRef.current || !annulPaymentId || !annulReason.trim()) return;

    annulSubmittingRef.current = true;
    setAnnulLoading(true);
    try {
      await api.annulPayment(annulPaymentId, annulReason.trim());
      setAnnulPaymentId(null);
      setAnnulReason('');
      await loadStatement();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al anular abono');
    } finally {
      annulSubmittingRef.current = false;
      setAnnulLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200/80 shadow-2xl my-4 max-h-[92vh] flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Estado de Cuenta
                </h2>
                <span className="font-mono text-xs bg-slate-200/80 px-2 py-0.5 rounded-md text-slate-700 font-bold">
                  {currentClient.clientNumber}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Historial integral de compras, créditos con intereses y abonos realizados.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="Cerrar modal"
              aria-label="Cerrar modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Client KPI & Actions Banner */}
          <div className="p-6 bg-slate-50/50 border-b border-slate-100 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {/* Client Info */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  NOMBRE DEL CLIENTE
                </p>
                <p className="text-sm font-bold text-slate-900 truncate">{currentClient.name}</p>
                <p className="text-[11px] text-slate-500 font-medium">{currentClient.phone || 'Sin teléfono'}</p>
              </div>

              {/* Current Daily Debt */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  DEUDA CORRIENTE (TIENDA)
                </p>
                <p
                  className={`font-mono font-extrabold text-base ${
                    (currentClient.dailyDebtBalance ?? 0) > 0
                      ? 'text-rose-600'
                      : (currentClient.dailyDebtBalance ?? 0) < 0
                      ? 'text-blue-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {(currentClient.dailyDebtBalance ?? 0) < 0
                    ? `-S/ ${Math.abs(currentClient.dailyDebtBalance).toFixed(2)} (A favor)`
                    : formatCurrency(currentClient.dailyDebtBalance ?? 0)}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Consumos directos en cuenta
                </span>
              </div>

              {/* Bank Debt Aggregate */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  DEUDA BANCARIA (PRÉSTAMOS)
                </p>
                <p
                  className={`font-mono font-extrabold text-base ${
                    (currentClient.bankDebtBalance ?? 0) > 0 ? 'text-indigo-600' : 'text-slate-700'
                  }`}
                >
                  {formatCurrency(currentClient.bankDebtBalance ?? 0)}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {activeLoans.length} {activeLoans.length === 1 ? 'préstamo activo' : 'préstamos activos'}
                </span>
              </div>

              {/* Total Consolidated Balance */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  SALDO TOTAL CONSOLIDADO
                </p>
                <p
                  className={`font-mono font-extrabold text-base ${
                    currentClient.currentBalance > 0
                      ? 'text-rose-600'
                      : currentClient.currentBalance < 0
                      ? 'text-blue-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {currentClient.currentBalance < 0
                    ? `-S/ ${Math.abs(currentClient.currentBalance).toFixed(2)} (A favor)`
                    : formatCurrency(currentClient.currentBalance)}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Disp: {typeof availableCredit === 'number' ? formatCurrency(availableCredit) : availableCredit}
                </span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onOpenPaymentModal(currentClient, false, { mode: 'dailyDebt' })}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  Abonar Deuda Corriente
                </button>

                {onOpenAddDebtModal && (
                  <button
                    onClick={() => onOpenAddDebtModal(currentClient)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">post_add</span>
                    Añadir Deuda / Crédito
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowAddPurchaseModal(true)}
                className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
              >
                <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                Nueva Compra a Crédito
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 bg-white border-b border-slate-100 flex gap-4 overflow-x-auto shrink-0">
            <button
              onClick={() => setActiveTab('purchases')}
              className={`py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'purchases'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
              Historial de Compras / Cargos ({statementData?.purchases.length || 0})
            </button>

            <button
              onClick={() => setActiveTab('loans')}
              className={`py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'loans'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
              Préstamos Bancarios ({statementData?.loans?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'payments'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              Detalle de Abonos / Pagos ({statementData?.payments.length || 0})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <span className="material-symbols-outlined animate-spin text-[32px] text-indigo-600">sync</span>
                <p className="mt-2 text-xs font-medium">Cargando estado de cuenta...</p>
              </div>
            ) : activeTab === 'purchases' ? (
              /* Tab 1: Compras a Crédito / Cargos */
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Fecha</th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Ticket / Folio
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Producto / Concepto
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        P. Unitario
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                        Cant.
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        Importe
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Registrado Por
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {statementData?.purchases.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-sm font-medium">
                          No hay compras a crédito registradas para este cliente.
                        </td>
                      </tr>
                    ) : (
                      statementData?.purchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="font-extrabold text-slate-900">
                              {new Date(purchase.date).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">access_time</span>
                              <span>
                                {new Date(purchase.date).toLocaleTimeString('es-PE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: true,
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-900 font-bold">
                            {purchase.ticketNumber || 'N/A'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-800 font-semibold">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{purchase.product}</span>
                              {purchase.debtType === 'credit' && (
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                                  Crédito con Intereses
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-right text-slate-700 font-medium">
                            S/ {purchase.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-center text-slate-700 font-medium">
                            {purchase.quantity}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-right font-extrabold text-slate-900">
                            S/ {purchase.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-medium">{purchase.registeredBy}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] ${
                                purchase.status === 'Activo'
                                  ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                                  : 'bg-slate-100 text-slate-400 line-through'
                              }`}
                            >
                              {purchase.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === 'loans' ? (
              /* Tab 2: Préstamos Bancarios Activos e Históricos */
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Código</th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Fecha</th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        Monto Total
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        Saldo Pendiente
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                        Estado
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        Acciones de Abono
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {!statementData?.loans || statementData.loans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-sm font-medium">
                          No hay préstamos bancarios registrados para este cliente.
                        </td>
                      </tr>
                    ) : (
                      statementData.loans.map((loan) => {
                        const isPayable = (loan.status === 'Activo' || loan.status === 'Vencido') && (loan.pendingAmount ?? 0) > 0.01;
                        return (
                          <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-indigo-700 whitespace-nowrap">
                              {loan.code}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-semibold text-slate-800">
                                {formatSpanishDate(loan.date)}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-right text-slate-700 whitespace-nowrap">
                              {formatCurrency(loan.totalAmount)}
                              <span className="block text-[10px] text-slate-400">
                                {loan.installmentsCount} cuotas ({loan.frequency})
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-right font-extrabold text-rose-600 whitespace-nowrap">
                              {formatCurrency(loan.pendingAmount)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  loan.status === 'Activo'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : loan.status === 'Pagado'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : loan.status === 'Vencido'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-slate-100 text-slate-400 line-through'
                                }`}
                              >
                                {loan.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {isPayable ? (
                                <div className="flex justify-end items-center gap-2">
                                  <button
                                    onClick={() =>
                                      onOpenPaymentModal(currentClient, false, {
                                        mode: 'bankLoan',
                                        targetLoan: loan,
                                      })
                                    }
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                  >
                                    Abonar
                                  </button>
                                  <button
                                    onClick={() =>
                                      onOpenPaymentModal(currentClient, true, {
                                        mode: 'bankLoan',
                                        targetLoan: loan,
                                      })
                                    }
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                    title={`Liquidar préstamo por S/ ${loan.pendingAmount.toFixed(2)}`}
                                  >
                                    Liquidar
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">Cerrado</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Tab 3: Abonos / Pagos */
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Fecha</th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        Importe Abonado
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        Saldo Anterior
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                        Saldo Resultante
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Método</th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Registrado Por
                      </th>
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                        Estado
                      </th>
                      {currentUser?.role === 'Administrador' && (
                        <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                          Acciones
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {statementData?.payments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                          No hay abonos registrados en el historial de este cliente.
                        </td>
                      </tr>
                    ) : (
                      statementData?.payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="font-extrabold text-slate-900">
                              {new Date(payment.date).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">access_time</span>
                              <span>
                                {new Date(payment.date).toLocaleTimeString('es-PE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: true,
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-right font-extrabold text-emerald-600">
                            +S/ {payment.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-right text-slate-500 font-medium">
                            S/ {payment.previousBalance.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-right font-bold text-slate-900">
                            S/ {payment.resultingBalance.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">
                            <div>{payment.paymentMethod}</div>
                            {payment.cardSurcharge && payment.cardSurcharge > 0 ? (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                                +5% recargo (S/ {payment.cardSurcharge.toFixed(2)})
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-medium">{payment.registeredBy}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] ${
                                payment.status === 'Activo'
                                  ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                                  : 'bg-slate-100 text-slate-400 line-through'
                              }`}
                            >
                              {payment.status}
                            </span>
                          </td>
                          {currentUser?.role === 'Administrador' && (
                            <td className="py-2.5 px-4 text-right">
                              {payment.status === 'Activo' && (
                                <button
                                  onClick={() => setAnnulPaymentId(payment.id)}
                                  className="text-rose-600 hover:underline text-xs font-bold cursor-pointer"
                                >
                                  Anular
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center rounded-b-3xl shrink-0">
            <span className="text-slate-400 text-xs font-medium">
              CrediManage POS • Trazabilidad Contable Registrada
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>

        {/* Add Credit Purchase Modal */}
        {showAddPurchaseModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-extrabold text-slate-900 mb-1">Registrar Compra a Crédito</h3>
              <p className="text-xs text-slate-500 mb-4 font-medium">
                Añadir una nueva nota de venta a crédito para {currentClient.name}.
              </p>

              <form onSubmit={handleCreatePurchase} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Producto / Concepto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Bulto de Harina 25kg"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Precio Unitario (S/) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-mono text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 font-mono text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Número de Ticket / Folio</label>
                  <input
                    type="text"
                    placeholder="Ej. TCK-9902 (Opcional)"
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Monto Total:</span>
                  <span className="font-mono font-extrabold text-slate-900 text-sm">
                    S/ {((parseFloat(String(unitPrice)) || 0) * (quantity || 1)).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPurchaseModal(false)}
                    className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={purchaseLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {purchaseLoading ? 'Registrando...' : 'Registrar Compra'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Annul Payment Modal */}
        {annulPaymentId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-2.5 text-rose-600 font-bold mb-2">
                <span className="material-symbols-outlined text-[24px]">warning</span>
                <h3 className="text-base font-black text-slate-900">Anular Abono Realizado</h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Al anular este abono, el saldo pendiente del cliente se incrementará nuevamente por el valor del importe
                original y el registro quedará marcado como <strong>Anulado</strong> para fines de auditoría.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Motivo de Anulación *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Ej. Error de digitación en caja, ticket duplicado..."
                    value={annulReason}
                    onChange={(e) => setAnnulReason(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAnnulPaymentId(null);
                      setAnnulReason('');
                    }}
                    className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAnnulPayment}
                    disabled={annulLoading || !annulReason.trim()}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {annulLoading ? 'Anulando...' : 'Confirmar Anulación'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
