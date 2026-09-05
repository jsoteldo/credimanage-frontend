import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, CreditPurchase, Payment, User } from '../types';
import { api } from '../services/api';
import { formatCurrency, formatSpanishDate } from '../utils/loanCalculations';

interface CurrentDebtAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  currentUser: User | null;
  onOpenAddDebt: (client: Client) => void;
  onOpenPayment: (client: Client) => void;
  onRefreshData: () => void;
}

interface KardexMovement {
  id: string;
  date: string;
  type: 'cargo' | 'abono';
  concept: string;
  ticket?: string;
  debit: number; // + amount (charges/purchases)
  credit: number; // - amount (payments/abonos)
  balance: number; // progressive resulting balance
  status: string;
  registeredBy: string;
  rawPurchase?: CreditPurchase;
  rawPayment?: Payment;
}

export const CurrentDebtAdminModal: React.FC<CurrentDebtAdminModalProps> = ({
  isOpen,
  onClose,
  client,
  currentUser,
  onOpenAddDebt,
  onOpenPayment,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'kardex' | 'purchases' | 'payments'>('kardex');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Statement data
  const [statementData, setStatementData] = useState<{
    client: Client;
    availableCredit: number | string;
    purchases: CreditPurchase[];
    payments: Payment[];
  } | null>(null);

  // Quick purchase inline state
  const [showQuickPurchase, setShowQuickPurchase] = useState(false);
  const [quickProduct, setQuickProduct] = useState('');
  const [quickUnitPrice, setQuickUnitPrice] = useState<number | string>('');
  const [quickQuantity, setQuickQuantity] = useState<number>(1);
  const [quickTicket, setQuickTicket] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const quickSubmittingRef = useRef(false);

  // Annul states
  const [annulItem, setAnnulItem] = useState<{ type: 'purchase' | 'payment'; id: string; title: string } | null>(null);
  const [annulReason, setAnnulReason] = useState('');
  const [annulLoading, setAnnulLoading] = useState(false);
  const annulSubmittingRef = useRef(false);

  // Load client's statement
  const loadClientStatement = async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStatementOfAccount(client.id);
      setStatementData(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los movimientos de deuda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && client) {
      loadClientStatement();
      setShowQuickPurchase(false);
      setAnnulItem(null);
      setAnnulReason('');
    } else {
      setStatementData(null);
    }
  }, [isOpen, client]);

  // Filter EXCLUSIVELY current debt purchases (exclude bank loans / cuotas)
  const currentPurchases = useMemo(() => {
    if (!statementData) return [];
    return statementData.purchases.filter((p) => !p.loanId && p.debtType !== 'credit');
  }, [statementData]);

  // Payments corresponding to current debt
  const currentPayments = useMemo(() => {
    if (!statementData) return [];
    return statementData.payments;
  }, [statementData]);

  // Build unified chronological Kardex with running balance
  const kardexMovements = useMemo<KardexMovement[]>(() => {
    if (!currentPurchases.length && !currentPayments.length) return [];

    const rawList: {
      id: string;
      date: string;
      type: 'cargo' | 'abono';
      concept: string;
      ticket?: string;
      debit: number;
      credit: number;
      status: string;
      registeredBy: string;
      rawPurchase?: CreditPurchase;
      rawPayment?: Payment;
    }[] = [];

    // Add purchases / charges
    currentPurchases.forEach((p) => {
      rawList.push({
        id: p.id,
        date: p.date,
        type: 'cargo',
        concept: p.product,
        ticket: p.ticketNumber,
        debit: p.status === 'Activo' ? p.amount : 0,
        credit: 0,
        status: p.status,
        registeredBy: p.registeredBy,
        rawPurchase: p,
      });
    });

    // Add payments / abonos
    currentPayments.forEach((pay) => {
      rawList.push({
        id: pay.id,
        date: pay.date,
        type: 'abono',
        concept: `Abono a cuenta (${pay.paymentMethod})${pay.notes ? ` - ${pay.notes}` : ''}`,
        ticket: pay.id.slice(-6).toUpperCase(),
        debit: 0,
        credit: pay.status === 'Activo' ? pay.amount : 0,
        status: pay.status,
        registeredBy: pay.registeredBy,
        rawPayment: pay,
      });
    });

    // Sort ascending by date to compute progressive balance
    rawList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const computed = rawList.map((item) => {
      if (item.status === 'Activo') {
        running = Math.round((running + item.debit - item.credit) * 100) / 100;
      }
      return {
        ...item,
        balance: running,
      };
    });

    // Return descending for reading (newest first)
    return computed.reverse();
  }, [currentPurchases, currentPayments]);

  const currentClient = client || statementData?.client;
  const currentBalance = currentClient.currentBalance;
  const dailyDebtBalance = currentClient.dailyDebtBalance ?? 0;
  const creditLimit = currentClient.creditLimit;
  const availableCredit =
    currentClient.availableCredit != null
      ? currentClient.availableCredit
      : creditLimit > 0
      ? Math.max(0, creditLimit - (currentClient.creditExposure ?? currentBalance))
      : 'Sin límite';

  // Handle inline quick purchase
  const handleCreateQuickPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSubmittingRef.current) return;
    const price = parseFloat(String(quickUnitPrice)) || 0;
    const qty = Math.max(1, quickQuantity || 1);
    const total = price * qty;

    if (!quickProduct.trim() || total <= 0) return;

    quickSubmittingRef.current = true;
    setQuickLoading(true);
    try {
      await api.addCreditPurchase(currentClient.id, {
        product: quickProduct.trim(),
        unitPrice: price,
        quantity: qty,
        ticketNumber: quickTicket.trim() || undefined,
        date: new Date().toISOString().split('T')[0],
      });
      setShowQuickPurchase(false);
      setQuickProduct('');
      setQuickUnitPrice('');
      setQuickQuantity(1);
      setQuickTicket('');
      await loadClientStatement();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al registrar la compra');
    } finally {
      quickSubmittingRef.current = false;
      setQuickLoading(false);
    }
  };

  // Handle Annul confirmation
  const handleConfirmAnnul = async () => {
    if (!annulItem || !annulReason.trim()) return;
    if (annulSubmittingRef.current) return;

    annulSubmittingRef.current = true;
    setAnnulLoading(true);
    try {
      if (annulItem.type === 'purchase') {
        await api.annulCreditPurchase(annulItem.id, annulReason.trim());
      } else {
        await api.annulPayment(annulItem.id, annulReason.trim());
      }
      setAnnulItem(null);
      setAnnulReason('');
      await loadClientStatement();
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al anular la operación');
    } finally {
      annulSubmittingRef.current = false;
      setAnnulLoading(false);
    }
  };

  // Print Kardex Statement
  const handlePrintKardex = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl my-4 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
              <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Administración de Deuda Corriente
                </h2>
                <span className="font-mono text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                  {currentClient.clientNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Kardex, compras a crédito, cargos y abonos correspondientes exclusivamente a la cuenta corriente.
              </p>
            </div>
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

        {/* Client KPI & Quick Actions Banner */}
        <div className="p-6 bg-slate-50/60 border-b border-slate-100 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {/* Client Info */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Cliente
              </span>
              <p className="text-sm font-bold text-slate-900 truncate">{currentClient.name}</p>
              <p className="text-[11px] text-slate-400 font-medium">{currentClient.phone || 'Sin teléfono'}</p>
            </div>

            {/* Current Debt Balance */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Deuda Corriente Pendiente
              </span>
              <p
                className={`font-mono font-black text-lg ${
                  dailyDebtBalance > 0
                    ? 'text-rose-600'
                    : dailyDebtBalance < 0
                    ? 'text-blue-600'
                    : 'text-emerald-600'
                }`}
              >
                {dailyDebtBalance < 0
                  ? `-S/ ${Math.abs(dailyDebtBalance).toFixed(2)} (A favor)`
                  : formatCurrency(dailyDebtBalance)}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Saldo total: <strong className="font-mono text-slate-700">{formatCurrency(currentBalance)}</strong>
              </span>
            </div>

            {/* Credit Limit */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Límite de Crédito
              </span>
              <p className="font-mono font-bold text-base text-slate-900">
                {creditLimit > 0 ? formatCurrency(creditLimit) : 'Sin límite'}
              </p>
            </div>

            {/* Available Credit */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Crédito Disponible
              </span>
              <p className="font-mono font-bold text-base text-indigo-600">
                {typeof availableCredit === 'number' ? formatCurrency(availableCredit) : availableCredit}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              {/* Registrar Abono */}
              <button
                onClick={() => onOpenPayment(currentClient)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">payments</span>
                <span>Registrar Abono</span>
              </button>

              {/* Cargar Deuda */}
              <button
                onClick={() => onOpenAddDebt(currentClient)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">post_add</span>
                <span>+ Cargar Deuda</span>
              </button>

              {/* Quick Purchase Toggle */}
              <button
                onClick={() => setShowQuickPurchase(!showQuickPurchase)}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                <span>{showQuickPurchase ? 'Ocultar Compra Rápida' : '+ Nueva Compra'}</span>
              </button>
            </div>

            <button
              onClick={handlePrintKardex}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Imprimir estado de cuenta corriente"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Imprimir</span>
            </button>
          </div>

          {/* Inline Quick Purchase Form */}
          {showQuickPurchase && (
            <form
              onSubmit={handleCreateQuickPurchase}
              className="mt-4 p-4 bg-white rounded-2xl border border-rose-200/80 shadow-xs space-y-3"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
                  Registrar Compra a Crédito para {currentClient.name}
                </span>
                <button
                  type="button"
                  onClick={() => setShowQuickPurchase(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Producto / Concepto *</label>
                  <input
                    type="text"
                    required
                    value={quickProduct}
                    onChange={(e) => setQuickProduct(e.target.value)}
                    placeholder="Ej. Paquete de víveres, Artículos de tienda"
                    className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Precio Unitario (S/) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={quickUnitPrice}
                    onChange={(e) => setQuickUnitPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-mono text-right focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quickQuantity}
                    onChange={(e) => setQuickQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-mono text-center focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="text-xs text-slate-500 font-medium">
                  Total a cargar:{' '}
                  <strong className="font-mono text-rose-600 font-bold">
                    {formatCurrency((parseFloat(String(quickUnitPrice)) || 0) * (quickQuantity || 1))}
                  </strong>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickPurchase(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={quickLoading}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    {quickLoading ? 'Guardando...' : 'Guardar Cargo'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-white border-b border-slate-100 flex gap-4 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('kardex')}
            className={`py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'kardex'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            Kardex Cronológico de Cuenta Corriente ({kardexMovements.length})
          </button>

          <button
            onClick={() => setActiveTab('purchases')}
            className={`py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'purchases'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
            Compras y Cargos ({currentPurchases.length})
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'payments'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>
            Abonos Realizados ({currentPayments.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <span className="material-symbols-outlined animate-spin text-[32px] text-rose-600">sync</span>
              <p className="mt-2 text-xs font-medium">Cargando movimientos de deuda corriente...</p>
            </div>
          ) : activeTab === 'kardex' ? (
            /* TAB 1: KARDEX CRONOLÓGICO */
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Fecha y Hora</th>
                    <th className="py-2.5 px-4">Tipo</th>
                    <th className="py-2.5 px-4">Concepto / Comprobante</th>
                    <th className="py-2.5 px-4 text-right">Cargo (+)</th>
                    <th className="py-2.5 px-4 text-right">Abono (-)</th>
                    <th className="py-2.5 px-4 text-right">Saldo Progresivo</th>
                    <th className="py-2.5 px-4">Registrado Por</th>
                    <th className="py-2.5 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {kardexMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                        No hay movimientos registrados en la cuenta corriente de este cliente.
                      </td>
                    </tr>
                  ) : (
                    kardexMovements.map((mov) => {
                      const isCharge = mov.type === 'cargo';
                      return (
                        <tr
                          key={mov.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            mov.status === 'Anulado' ? 'opacity-50 bg-slate-50/40' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800">
                              {new Date(mov.date).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {new Date(mov.date).toLocaleTimeString('es-PE', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
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
                              {isCharge ? 'Cargo' : 'Abono'}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-slate-800 font-medium">
                            <div>{mov.concept}</div>
                            {mov.ticket && (
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                {mov.ticket}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                            {mov.debit > 0 ? `+${formatCurrency(mov.debit)}` : '—'}
                          </td>

                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                            {mov.credit > 0 ? `-${formatCurrency(mov.credit)}` : '—'}
                          </td>

                          <td className="py-2.5 px-4 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                            {formatCurrency(mov.balance)}
                          </td>

                          <td className="py-2.5 px-4 text-slate-500 font-medium whitespace-nowrap">
                            {mov.registeredBy}
                          </td>

                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                mov.status === 'Activo'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-rose-50 text-rose-600 line-through'
                              }`}
                            >
                              {mov.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'purchases' ? (
            /* TAB 2: COMPRAS Y CARGOS A CRÉDITO */
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Fecha</th>
                    <th className="py-2.5 px-4">Ticket / Folio</th>
                    <th className="py-2.5 px-4">Producto / Concepto</th>
                    <th className="py-2.5 px-4 text-right">P. Unitario</th>
                    <th className="py-2.5 px-4 text-center">Cant.</th>
                    <th className="py-2.5 px-4 text-right">Total Cargo</th>
                    <th className="py-2.5 px-4">Registrado Por</th>
                    <th className="py-2.5 px-4 text-center">Estado</th>
                    {currentUser?.role === 'Administrador' && (
                      <th className="py-2.5 px-4 text-right">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {currentPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400 font-medium">
                        No hay compras o cargos a crédito registrados para este cliente.
                      </td>
                    </tr>
                  ) : (
                    currentPurchases.map((p) => (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          p.status === 'Anulado' ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-800">
                            {new Date(p.date).toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-700">
                          {p.ticketNumber || 'N/A'}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{p.product}</td>
                        <td className="py-2.5 px-4 font-mono text-right text-slate-600">
                          {formatCurrency(p.unitPrice)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-center text-slate-600">{p.quantity}</td>
                        <td className="py-2.5 px-4 font-mono text-right font-extrabold text-rose-600 whitespace-nowrap">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-medium">{p.registeredBy}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'Activo'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-400 line-through'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        {currentUser?.role === 'Administrador' && (
                          <td className="py-2.5 px-4 text-right">
                            {p.status === 'Activo' && (
                              <button
                                onClick={() =>
                                  setAnnulItem({
                                    type: 'purchase',
                                    id: p.id,
                                    title: `Anular cargo: ${p.product} (${formatCurrency(p.amount)})`,
                                  })
                                }
                                className="text-rose-600 hover:text-rose-800 hover:underline font-bold text-xs cursor-pointer"
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
          ) : (
            /* TAB 3: ABONOS Y PAGOS */
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Fecha y Hora</th>
                    <th className="py-2.5 px-4 text-right">Importe Abonado</th>
                    <th className="py-2.5 px-4 text-right">Saldo Previo</th>
                    <th className="py-2.5 px-4 text-right">Saldo Resultante</th>
                    <th className="py-2.5 px-4">Método</th>
                    <th className="py-2.5 px-4">Registrado Por</th>
                    <th className="py-2.5 px-4 text-center">Estado</th>
                    {currentUser?.role === 'Administrador' && (
                      <th className="py-2.5 px-4 text-right">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {currentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                        No hay abonos registrados para este cliente.
                      </td>
                    </tr>
                  ) : (
                    currentPayments.map((pay) => (
                      <tr
                        key={pay.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          pay.status === 'Anulado' ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-800">
                            {new Date(pay.date).toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {new Date(pay.date).toLocaleTimeString('es-PE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right font-extrabold text-emerald-600 whitespace-nowrap">
                          +{formatCurrency(pay.amount)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right text-slate-500">
                          {formatCurrency(pay.previousBalance)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-right font-bold text-slate-900">
                          {formatCurrency(pay.resultingBalance)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-800 font-medium">
                          {pay.paymentMethod}
                          {pay.cardSurcharge && pay.cardSurcharge > 0 ? (
                            <span className="block text-[9px] text-amber-700 font-bold">
                              +5% recargo: {formatCurrency(pay.cardSurcharge)}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-medium">{pay.registeredBy}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pay.status === 'Activo'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-400 line-through'
                            }`}
                          >
                            {pay.status}
                          </span>
                        </td>
                        {currentUser?.role === 'Administrador' && (
                          <td className="py-2.5 px-4 text-right">
                            {pay.status === 'Activo' && (
                              <button
                                onClick={() =>
                                  setAnnulItem({
                                    type: 'payment',
                                    id: pay.id,
                                    title: `Anular abono de ${formatCurrency(pay.amount)}`,
                                  })
                                }
                                className="text-rose-600 hover:text-rose-800 hover:underline font-bold text-xs cursor-pointer"
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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            CrediManage POS • Módulo Exclusivo de Deuda Corriente
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>

      {/* Annul Reason Prompt Modal */}
      {annulItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-base font-extrabold text-slate-900">Anulación de Operación</h3>
            </div>

            <p className="text-xs text-slate-600 font-medium">{annulItem.title}</p>
            <p className="text-[11px] text-slate-500">
              Esta acción revertirá el saldo correspondiente del cliente y quedará registrada de forma permanente en el
              log de auditoría.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo / Justificación de la Anulación *
              </label>
              <textarea
                rows={3}
                required
                value={annulReason}
                onChange={(e) => setAnnulReason(e.target.value)}
                placeholder="Ej. Registro duplicado por error de caja, cancelación solicitada..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAnnulItem(null)}
                className="px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!annulReason.trim() || annulLoading}
                onClick={handleConfirmAnnul}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
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
