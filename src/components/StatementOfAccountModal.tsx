import React, { useState, useEffect } from 'react';
import { Client, CreditPurchase, Payment, User, LoanCredit } from '../types';
import { api } from '../services/api';
import { LoanScheduleModal } from './LoanScheduleModal';
import { formatCurrency, formatSpanishDate } from '../utils/loanCalculations';

interface StatementOfAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  currentUser: User | null;
  onOpenPaymentModal: (client: Client, isFullPayoff: boolean) => void;
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

  // Selected loan for viewing schedule
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<LoanCredit | null>(null);

  // New Credit Purchase Modal state
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [unitPrice, setUnitPrice] = useState<number | string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [ticketNumber, setTicketNumber] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // Annul payment state
  const [annulPaymentId, setAnnulPaymentId] = useState<string | null>(null);
  const [annulReason, setAnnulReason] = useState('');

  // Annul loan state
  const [annulLoanId, setAnnulLoanId] = useState<string | null>(null);
  const [annulLoanReason, setAnnulLoanReason] = useState('');

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
      setSelectedLoanForSchedule(null);
    }
  }, [isOpen, client]);

  if (!isOpen || !client) return null;

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !unitPrice) return;

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
      setPurchaseLoading(false);
    }
  };

  const handleAnnulPayment = async () => {
    if (!annulPaymentId || !annulReason.trim()) return;

    try {
      await api.annulPayment(annulPaymentId, annulReason.trim());
      setAnnulPaymentId(null);
      setAnnulReason('');
      await loadStatement();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al anular abono');
    }
  };

  const handleAnnulLoan = async () => {
    if (!annulLoanId || !annulLoanReason.trim()) return;

    try {
      await api.annulLoan(annulLoanId, annulLoanReason.trim());
      setAnnulLoanId(null);
      setAnnulLoanReason('');
      await loadStatement();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al anular crédito');
    }
  };

  const currentClient = statementData?.client || client;
  const availableCredit = statementData?.availableCredit ?? (currentClient.creditLimit - currentClient.currentBalance);
  const clientLoans = statementData?.loans || [];

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

              {/* Current Balance */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  SALDO ACTUAL PENDIENTE
                </p>
                <p
                  className={`font-mono font-extrabold text-base ${
                    currentClient.currentBalance > 0 ? 'text-rose-600' : 'text-indigo-600'
                  }`}
                >
                  S/ {currentClient.currentBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Credit Limit */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  LÍMITE DE CRÉDITO
                </p>
                <p className="font-mono font-bold text-base text-slate-900">
                  {currentClient.creditLimit > 0
                    ? `S/ ${currentClient.creditLimit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                    : 'Sin Límite'}
                </p>
              </div>

              {/* Available Credit */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  CRÉDITO DISPONIBLE
                </p>
                <p className="font-mono font-bold text-base text-indigo-600">
                  {typeof availableCredit === 'number'
                    ? `S/ ${availableCredit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                    : availableCredit}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onOpenPaymentModal(currentClient, false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  Registrar Abono
                </button>

                <button
                  onClick={() => onOpenPaymentModal(currentClient, true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">done_all</span>
                  Liquidar Adeudo
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
              <span className="material-symbols-outlined text-[18px]">finance_mode</span>
              Créditos con Intereses ({clientLoans.length})
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
                          <td className="py-2.5 px-4 font-mono text-right font-extrabold text-rose-600">
                            S/ {purchase.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-medium">{purchase.registeredBy}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                purchase.status === 'Activo'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
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
              /* Tab 2: Créditos con Intereses */
              <div className="space-y-4">
                {clientLoans.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 border border-slate-200/80 rounded-2xl">
                    <span className="material-symbols-outlined text-[36px] text-slate-300">finance_mode</span>
                    <p className="mt-2 text-xs font-semibold text-slate-600">
                      No hay créditos con intereses registrados para este cliente.
                    </p>
                    {onOpenAddDebtModal && (
                      <button
                        onClick={() => onOpenAddDebtModal(currentClient)}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">percent</span>
                        <span>Otorgar Crédito con Intereses</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Código / Fecha
                          </th>
                          <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                            Capital
                          </th>
                          <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                            Interés
                          </th>
                          <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                            Total Crédito
                          </th>
                          <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                            Plan Cuotas
                          </th>
                          <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                            Valor Cuota
                          </th>
                          <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                            Estado
                          </th>
                          <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {clientLoans.map((loan) => (
                          <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-mono font-extrabold text-indigo-700">{loan.code}</div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {formatSpanishDate(loan.date)}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-900 font-bold whitespace-nowrap">
                              {formatCurrency(loan.capital)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-indigo-600 font-semibold whitespace-nowrap">
                              +{formatCurrency(loan.interestAmount)} ({loan.interestRate}%)
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-extrabold text-rose-600 text-sm whitespace-nowrap">
                              {formatCurrency(loan.totalAmount)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span className="font-semibold text-slate-800">
                                {loan.installmentsCount} cuotas ({loan.frequency})
                              </span>
                              {loan.paidInstallmentsCount !== undefined && loan.paidInstallmentsCount > 0 && (
                                <div className="text-[10px] text-emerald-600 font-bold">
                                  {loan.paidInstallmentsCount}/{loan.installmentsCount} pagadas
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                              {formatCurrency(loan.installmentAmount)}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setSelectedLoanForSchedule(loan)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  title="Ver cronograma detallado de cuotas"
                                >
                                  <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                                  <span>Cronograma</span>
                                </button>

                                {currentUser?.role === 'Administrador' && loan.status === 'Activo' && (
                                  <button
                                    onClick={() => setAnnulLoanId(loan.id)}
                                    className="text-rose-600 hover:text-rose-700 hover:underline text-xs font-bold cursor-pointer"
                                  >
                                    Anular
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* Tab 3: Detalle de Abonos */
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                        Fecha y Hora
                      </th>
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
                      className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ticket / Folio (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. TKT-9912"
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPurchaseModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={purchaseLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    {purchaseLoading ? 'Guardando...' : 'Guardar Compra'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Annul Payment Reason Modal */}
        {annulPaymentId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-sm w-full p-6">
              <h3 className="text-base font-extrabold text-slate-900 mb-1">Anular Abono</h3>
              <p className="text-xs text-slate-500 mb-3">
                Esta acción revertirá el saldo del cliente y quedará registrada en la auditoría del sistema.
              </p>
              <textarea
                rows={3}
                required
                placeholder="Motivo de la anulación (obligatorio)..."
                value={annulReason}
                onChange={(e) => setAnnulReason(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAnnulPaymentId(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!annulReason.trim()}
                  onClick={handleAnnulPayment}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Confirmar Anulación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Annul Loan Reason Modal */}
        {annulLoanId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-sm w-full p-6">
              <h3 className="text-base font-extrabold text-slate-900 mb-1">Anular Crédito con Intereses</h3>
              <p className="text-xs text-slate-500 mb-3">
                Esta acción anulará el crédito, cancelará sus cuotas y revertirá el saldo pendiente del cliente.
              </p>
              <textarea
                rows={3}
                required
                placeholder="Motivo de la anulación del crédito (obligatorio)..."
                value={annulLoanReason}
                onChange={(e) => setAnnulLoanReason(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all mb-4"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAnnulLoanId(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!annulLoanReason.trim()}
                  onClick={handleAnnulLoan}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Confirmar Anulación
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loan Schedule Details Modal */}
      {selectedLoanForSchedule && (
        <LoanScheduleModal
          isOpen={!!selectedLoanForSchedule}
          onClose={() => setSelectedLoanForSchedule(null)}
          clientName={currentClient.name}
          capital={selectedLoanForSchedule.capital}
          interestRate={selectedLoanForSchedule.interestRate}
          interestAmount={selectedLoanForSchedule.interestAmount}
          totalAmount={selectedLoanForSchedule.totalAmount}
          installmentsCount={selectedLoanForSchedule.installmentsCount}
          frequency={selectedLoanForSchedule.frequency}
          installments={selectedLoanForSchedule.installments}
          title="Cronograma Detallado del Crédito"
          code={selectedLoanForSchedule.code}
        />
      )}
    </>
  );
};
