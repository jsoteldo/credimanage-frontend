import React, { useState, useMemo, useRef } from 'react';
import { Client, Location, SalePaymentMethod, CreateSalePayload, CashSession } from '../../types';
import { formatCurrency } from '../../utils/loanCalculations';

interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface PaymentRow {
  method: SalePaymentMethod;
  amount: number | string;
  reference?: string;
}

interface CheckoutModalProps {
  store: Location;
  selectedClient: Client | null;
  items: CartItem[];
  total: number;
  cashSession?: CashSession | null;
  initialPayments?: { method: SalePaymentMethod; amount: number | string; reference?: string }[];
  initialNotes?: string;
  isEditing?: boolean;
  onOpenCashSessionModal?: () => void;
  onClose: () => void;
  onConfirmSale: (payload: CreateSalePayload) => Promise<void>;
  onRequestSelectClient?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  store,
  selectedClient,
  items,
  total,
  cashSession,
  initialPayments,
  initialNotes,
  isEditing,
  onOpenCashSessionModal,
  onClose,
  onConfirmSale,
  onRequestSelectClient,
}) => {
  // Payments state: by default starts with 1 CASH payment equal to total, or initialPayments if provided
  const [payments, setPayments] = useState<PaymentRow[]>(() => {
    if (initialPayments && initialPayments.length > 0) {
      return initialPayments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference,
      }));
    }
    return [{ method: 'CASH', amount: total }];
  });

  // Cash received state
  const [cashReceivedInput, setCashReceivedInput] = useState<string>('');
  const [isCashReceivedDirty, setIsCashReceivedDirty] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(initialNotes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Anti double-submit mutex
  const submitMutex = useRef<boolean>(false);

  // Helper to parse amount safely
  const parseAmount = (val: number | string | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Check if any payment row has invalid amounts (<= 0, negative, empty or non-numeric)
  const hasInvalidAmounts = useMemo(() => {
    return payments.some((p) => {
      if (p.amount === '' || p.amount === undefined || p.amount === null) return true;
      const num = typeof p.amount === 'number' ? p.amount : parseFloat(p.amount as string);
      return isNaN(num) || !isFinite(num) || num <= 0;
    });
  }, [payments]);

  // Computed sums (Real-time update)
  const paymentSum = useMemo(() => {
    return Math.round(payments.reduce((sum, p) => sum + (parseAmount(p.amount) || 0), 0) * 100) / 100;
  }, [payments]);

  const difference = useMemo(() => {
    return Math.round((total - paymentSum) * 100) / 100;
  }, [total, paymentSum]);

  const hasCashPayment = useMemo(() => {
    return payments.some((p) => p.method === 'CASH');
  }, [payments]);

  const totalCashAmount = useMemo(() => {
    return Math.round(
      payments
        .filter((p) => p.method === 'CASH')
        .reduce((sum, p) => sum + (parseAmount(p.amount) || 0), 0) * 100
    ) / 100;
  }, [payments]);

  const totalCreditAmount = useMemo(() => {
    return Math.round(
      payments
        .filter((p) => p.method === 'CREDIT')
        .reduce((sum, p) => sum + (parseAmount(p.amount) || 0), 0) * 100
    ) / 100;
  }, [payments]);

  // Card Surcharge (5% applied ONLY on payments made with CARD)
  const cardAmount = useMemo(() => {
    return Math.round(
      payments
        .filter((p) => p.method === 'CARD')
        .reduce((sum, p) => sum + (parseAmount(p.amount) || 0), 0) * 100
    ) / 100;
  }, [payments]);

  const cardSurcharge = useMemo(() => {
    return Math.round(cardAmount * 0.05 * 100) / 100;
  }, [cardAmount]);

  const finalTotal = useMemo(() => {
    return Math.round((total + cardSurcharge) * 100) / 100;
  }, [total, cardSurcharge]);

  // Effective cash received: if not dirty, defaults to totalCashAmount; else uses input value
  const effectiveCashReceived = useMemo(() => {
    if (!isCashReceivedDirty) {
      return totalCashAmount;
    }
    if (cashReceivedInput === '') return 0;
    const parsed = parseFloat(cashReceivedInput);
    return isNaN(parsed) ? 0 : parsed;
  }, [isCashReceivedDirty, totalCashAmount, cashReceivedInput]);

  // Cash change: ONLY from cash received minus cash applied to sale
  const cashChange = useMemo(() => {
    if (!hasCashPayment || totalCashAmount <= 0) return 0;
    return effectiveCashReceived >= totalCashAmount
      ? Math.round((effectiveCashReceived - totalCashAmount) * 100) / 100
      : 0;
  }, [hasCashPayment, totalCashAmount, effectiveCashReceived]);

  // Credit limit validation for client
  const creditLimitExceeded = useMemo(() => {
    if (totalCreditAmount <= 0 || !selectedClient) return false;
    if (selectedClient.creditLimit <= 0) return false; // no limit

    const currentDailyDebt =
      selectedClient.dailyDebtBalance != null
        ? Math.max(0, Number(selectedClient.dailyDebtBalance))
        : Math.max(0, Number(selectedClient.currentBalance));

    const projected = currentDailyDebt + totalCreditAmount;
    return projected > selectedClient.creditLimit;
  }, [totalCreditAmount, selectedClient]);

  // Validation flag for confirming sale
  const isPaymentValid = useMemo(() => {
    if (payments.length === 0) return false;
    if (hasInvalidAmounts) return false;
    if (Math.abs(difference) > 0.01) return false;

    if (hasCashPayment && totalCashAmount > 0) {
      if (isNaN(effectiveCashReceived) || effectiveCashReceived < totalCashAmount) {
        return false;
      }
    }

    if (totalCreditAmount > 0) {
      if (!selectedClient) return false;
      if (creditLimitExceeded) return false;
    }

    if (!cashSession || cashSession.status !== 'OPEN') {
      return false;
    }

    return true;
  }, [
    payments.length,
    hasInvalidAmounts,
    difference,
    hasCashPayment,
    totalCashAmount,
    effectiveCashReceived,
    totalCreditAmount,
    selectedClient,
    creditLimitExceeded,
    cashSession,
  ]);

  // Handle payment method change for a row
  const handleMethodChange = (index: number, newMethod: SalePaymentMethod) => {
    setPayments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], method: newMethod };
      const stillHasCash = next.some((p) => p.method === 'CASH');
      if (!stillHasCash) {
        setIsCashReceivedDirty(false);
        setCashReceivedInput('');
      }
      return next;
    });
  };

  // Handle amount change for a row
  const handleAmountChange = (index: number, val: number | string) => {
    setPayments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], amount: val };
      return next;
    });
  };

  // Handle reference change
  const handleReferenceChange = (index: number, val: string) => {
    setPayments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], reference: val };
      return next;
    });
  };

  // Handle cash received input change
  const handleCashReceivedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCashReceivedDirty(true);
    setCashReceivedInput(e.target.value);
  };

  // Add payment row
  const handleAddPaymentRow = () => {
    const remaining = Math.max(0, difference);
    setPayments((prev) => [
      ...prev,
      { method: 'YAPE', amount: remaining > 0 ? remaining : '' },
    ]);
  };

  // Remove payment row
  const handleRemovePaymentRow = (index: number) => {
    if (payments.length <= 1) return;
    setPayments((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      const stillHasCash = next.some((p) => p.method === 'CASH');
      if (!stillHasCash) {
        setIsCashReceivedDirty(false);
        setCashReceivedInput('');
      }
      return next;
    });
  };

  // Quick fill remaining
  const handleFillRemaining = (index: number) => {
    const otherSum = payments.reduce(
      (acc, p, idx) => (idx === index ? acc : acc + parseAmount(p.amount)),
      0,
    );
    const need = Math.max(0, Math.round((total - otherSum) * 100) / 100);
    handleAmountChange(index, need);
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitMutex.current || isSubmitting) return;

    setError(null);

    // 0. Validate open cash session
    if (!cashSession || cashSession.status !== 'OPEN') {
      setError('No existe una caja abierta. Debes abrir un turno antes de registrar ventas.');
      return;
    }

    // 1. Validate payment amounts are valid positive numbers
    if (hasInvalidAmounts) {
      setError('Todos los métodos de pago deben tener un importe válido y mayor a 0.');
      return;
    }

    // 2. Validate payment sum equals total
    if (Math.abs(paymentSum - total) > 0.01) {
      if (difference > 0) {
        setError(`Faltan S/ ${difference.toFixed(2)} por asignar para completar el total.`);
      } else {
        setError(`El importe asignado excede el total de la venta por S/ ${Math.abs(difference).toFixed(2)}.`);
      }
      return;
    }

    // 3. Validate credit requirements
    if (totalCreditAmount > 0) {
      if (!selectedClient) {
        setError('Selecciona un cliente para registrar una venta a crédito.');
        return;
      }
      if (creditLimitExceeded) {
        setError(
          `Límite de crédito excedido para ${selectedClient.name}. Límite: S/ ${selectedClient.creditLimit.toFixed(
            2,
          )}, Crédito Solicitado: S/ ${totalCreditAmount.toFixed(2)}.`,
        );
        return;
      }
    }

    // 4. Validate cash received if cash component exists
    if (hasCashPayment && totalCashAmount > 0) {
      if (effectiveCashReceived < totalCashAmount) {
        setError(
          `El efectivo recibido (S/ ${effectiveCashReceived.toFixed(2)}) no cubre el efectivo aplicado a la venta (S/ ${totalCashAmount.toFixed(2)}).`,
        );
        return;
      }
    }

    submitMutex.current = true;
    setIsSubmitting(true);

    try {
      await onConfirmSale({
        storeId: store.id,
        clientId: selectedClient ? selectedClient.id : null,
        cashSessionId: cashSession?.id,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amount: Math.round(parseAmount(p.amount) * 100) / 100,
          reference: p.reference?.trim() || undefined,
        })),
        cashReceived: hasCashPayment && totalCashAmount > 0 ? Math.round(effectiveCashReceived * 100) / 100 : undefined,
        notes: notes.trim() || undefined,
      });
      // onClose is handled by onConfirmSale / Success screen
    } catch (err: any) {
      setError(err.message || 'Error al procesar la venta');
      submitMutex.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                {isEditing ? 'Editar Cobro de Venta' : 'Cobrar Venta'}
              </h3>
              <p className="text-xs text-slate-500">
                {store.name} • {items.reduce((sum, it) => sum + it.quantity, 0)} items
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Cerrar cobro"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Cash Session Status Banner */}
          {(!cashSession || cashSession.status !== 'OPEN') && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">warning</span>
                <span className="font-semibold">
                  No existe una caja abierta. Debes abrir un turno antes de registrar ventas.
                </span>
              </div>
              {onOpenCashSessionModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCashSessionModal();
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shrink-0 transition cursor-pointer"
                >
                  Abrir Caja
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0 text-rose-600">error</span>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Big Total & Balance Bar */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total a Cobrar
              </span>
              <span className="text-3xl font-black font-mono text-indigo-700">
                {formatCurrency(total)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Estado del Pago
              </span>
              {difference === 0 ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Monto exacto cubierto
                </span>
              ) : difference > 0 ? (
                <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100/70 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-mono">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  Faltan {formatCurrency(difference)} por asignar
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100/70 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-mono">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  Exceso de {formatCurrency(Math.abs(difference))} por asignar
                </span>
              )}
            </div>
          </div>

          {/* Client summary box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-indigo-600">person</span>
              <div>
                <span className="font-bold text-slate-800">
                  {selectedClient ? selectedClient.name : 'Consumidor Final'}
                </span>
                {selectedClient ? (
                  <span className="text-slate-500 block text-[11px]">
                    {selectedClient.clientNumber} • Deuda actual: S/{' '}
                    {Number(selectedClient.dailyDebtBalance || selectedClient.currentBalance || 0).toFixed(2)} •
                    Disp:{' '}
                    {selectedClient.creditLimit > 0
                      ? formatCurrency(
                          selectedClient.availableCredit !== null && selectedClient.availableCredit !== undefined
                            ? selectedClient.availableCredit
                            : Math.max(0, selectedClient.creditLimit - (selectedClient.dailyDebtBalance || 0)),
                        )
                      : 'Sin límite'}
                  </span>
                ) : (
                  <span className="text-slate-400 block text-[11px]">
                    No requiere registro. Para ventas a crédito debe seleccionar un cliente.
                  </span>
                )}
              </div>
            </div>

            {onRequestSelectClient && !selectedClient && (
              <button
                type="button"
                onClick={onRequestSelectClient}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-indigo-600 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
              >
                + Asignar Cliente
              </button>
            )}
          </div>

          {/* Payment Methods Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Métodos de Pago Asignados
              </label>
              <button
                type="button"
                onClick={handleAddPaymentRow}
                className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Agregar otro medio (Pago mixto)
              </button>
            </div>

            <div className="space-y-2.5">
              {payments.map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2"
                >
                  <div className="flex items-center gap-2">
                    {/* Method Dropdown */}
                    <div className="w-40 sm:w-44 shrink-0">
                      <select
                        value={row.method}
                        onChange={(e) =>
                          handleMethodChange(idx, e.target.value as SalePaymentMethod)
                        }
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="CASH">💵 Efectivo</option>
                        <option value="YAPE">🟣 Yape</option>
                        <option value="PLIN">🔵 Plin</option>
                        <option value="CARD">💳 Tarjeta</option>
                        <option value="TRANSFER">🏦 Transferencia</option>
                        <option value="CREDIT">📋 Crédito</option>
                      </select>
                    </div>

                    {/* Amount Input */}
                    <div className="flex-1 relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                        S/
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => handleAmountChange(idx, e.target.value)}
                        placeholder="0.00"
                        aria-label={`Monto de pago ${idx + 1}`}
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Auto-fill remaining button */}
                    <button
                      type="button"
                      onClick={() => handleFillRemaining(idx)}
                      title="Ajustar monto al saldo restante"
                      className="px-2 py-1.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      Ajustar
                    </button>

                    {/* Remove button */}
                    {payments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar este pago"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>

                  {/* Reference input for non-cash & non-credit */}
                  {['YAPE', 'PLIN', 'CARD', 'TRANSFER'].includes(row.method) && (
                    <div className="pt-1">
                      <input
                        type="text"
                        value={row.reference || ''}
                        onChange={(e) => handleReferenceChange(idx, e.target.value)}
                        placeholder="N° operación / voucher / referencia (opcional)..."
                        className="w-full px-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                  )}

                  {/* Warning if CREDIT without client */}
                  {row.method === 'CREDIT' && !selectedClient && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-amber-600">warning</span>
                      <span>Debe seleccionar un cliente registrado para habilitar venta a crédito.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary Block (Payment Summary & Cash/Change) */}
          <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-600">receipt_long</span>
                Resumen del pago
              </span>
              {difference === 0 && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Cubierto al 100%
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-slate-600 font-semibold text-[11px]">
                  {cardSurcharge > 0 ? 'Subtotal productos:' : 'Total de la venta:'}
                </span>
                <span className="font-mono font-black text-slate-900">{formatCurrency(total)}</span>
              </div>

              <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-slate-600 font-semibold text-[11px]">Total asignado:</span>
                <span
                  className={`font-mono font-black ${
                    difference === 0 ? 'text-emerald-700' : difference > 0 ? 'text-rose-600' : 'text-amber-600'
                  }`}
                >
                  {formatCurrency(paymentSum)}
                </span>
              </div>
            </div>

            {/* Card Surcharge Breakdown (when card payments exist) */}
            {cardSurcharge > 0 && (
              <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-xs space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-blue-900">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <span className="material-symbols-outlined text-[16px] text-blue-600">credit_card</span>
                    <span>Recargo tarjeta 5%:</span>
                  </div>
                  <span className="font-mono font-black text-blue-950">
                    +{formatCurrency(cardSurcharge)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-blue-200/80 flex items-center justify-between text-blue-950">
                  <span className="font-extrabold text-[12px] uppercase tracking-wide">
                    TOTAL A COBRAR:
                  </span>
                  <span className="font-mono font-black text-base text-blue-700">
                    {formatCurrency(finalTotal)}
                  </span>
                </div>
              </div>
            )}

            {/* Cash Breakdown (Only if a CASH payment method is present) */}
            {hasCashPayment && (
              <div className="pt-2 border-t border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between bg-emerald-50/70 px-3 py-2 rounded-xl border border-emerald-200 text-xs">
                  <span className="font-bold text-emerald-900 text-[11px]">Efectivo aplicado:</span>
                  <span className="font-mono font-black text-emerald-900 text-sm">
                    {formatCurrency(totalCashAmount)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Efectivo recibido:
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                        S/
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={totalCashAmount}
                        value={
                          isCashReceivedDirty
                            ? cashReceivedInput
                            : totalCashAmount > 0
                            ? totalCashAmount
                            : ''
                        }
                        onChange={handleCashReceivedChange}
                        aria-label="Efectivo Recibido"
                        placeholder="0.00"
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    {totalCashAmount > 0 && effectiveCashReceived < totalCashAmount && (
                      <span className="text-[10px] text-rose-600 font-semibold mt-1 block">
                        El efectivo recibido debe ser al menos {formatCurrency(totalCashAmount)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col justify-end">
                    <span className="text-[11px] font-semibold text-slate-700 mb-1">
                      Cambio a entregar:
                    </span>
                    <div className="px-3 py-1.5 bg-emerald-100/80 rounded-lg border border-emerald-300 text-xs font-mono font-black text-emerald-900">
                      {formatCurrency(cashChange)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Notas u observaciones de la venta (opcional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Entregado en mostrador..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !isPaymentValid}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Procesando venta...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>
                  {isEditing ? 'Actualizar Venta' : 'Confirmar Venta'} ({formatCurrency(finalTotal)})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
