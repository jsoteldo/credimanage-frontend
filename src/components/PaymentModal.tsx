import React, { useState, useEffect, useRef } from 'react';
import { Client, LoanCredit } from '../types';

export interface PaymentContext {
  mode: 'dailyDebt' | 'bankLoan';
  targetLoanId?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  mode?: 'dailyDebt' | 'bankLoan';
  targetLoan?: LoanCredit | null;
  onConfirmPayment: (
    paymentData: {
      amount: number;
      paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
      notes?: string;
      isFullPayoff?: boolean;
    },
    context?: PaymentContext
  ) => Promise<void>;
  isFullPayoffDefault?: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  client,
  mode = 'dailyDebt',
  targetLoan = null,
  onConfirmPayment,
  isFullPayoffDefault = false,
}) => {
  const [amountInput, setAmountInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
  const [notes, setNotes] = useState('');
  const [isFullPayoff, setIsFullPayoff] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSubmittingRef = useRef(false);

  const isBank = mode === 'bankLoan' && Boolean(targetLoan);

  useEffect(() => {
    if (client) {
      const debtToPay = isBank
        ? (targetLoan?.pendingAmount ?? 0)
        : Math.max(0, client.dailyDebtBalance ?? 0);

      if (isFullPayoffDefault) {
        setIsFullPayoff(true);
        setAmountInput(String(debtToPay));
      } else {
        setIsFullPayoff(false);
        setAmountInput('');
      }
      setPaymentMethod('Efectivo');
      setNotes('');
      setStep('input');
      setError(null);
    }
  }, [client, isOpen, isFullPayoffDefault, mode, targetLoan]);

  if (!isOpen || !client) return null;

  const targetDebt = isBank
    ? (targetLoan?.pendingAmount ?? 0)
    : (client.dailyDebtBalance ?? 0);

  const payAmount = isFullPayoff
    ? (isBank ? targetDebt : Math.max(0, targetDebt))
    : parseFloat(amountInput) || 0;

  const resultingBalance = Math.round((targetDebt - payAmount) * 100) / 100;
  const cardSurcharge = paymentMethod === 'Tarjeta' ? Math.round(payAmount * 0.05 * 100) / 100 : 0;
  const totalCharged = payAmount + cardSurcharge;

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (payAmount <= 0) {
      setError('El importe del abono debe ser mayor a S/ 0.00 Soles Peruanos.');
      return;
    }

    if (isNaN(payAmount)) {
      setError('Ingrese un número de importe válido.');
      return;
    }

    // Overpayment validation for bank loans
    if (isBank && payAmount > targetDebt) {
      setError(
        `El importe a abonar (S/ ${payAmount.toFixed(2)}) no puede superar el saldo pendiente del préstamo (S/ ${targetDebt.toFixed(2)}).`
      );
      return;
    }

    // Advance to confirmation step
    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      await onConfirmPayment(
        {
          amount: payAmount,
          paymentMethod,
          notes,
          isFullPayoff,
        },
        {
          mode: isBank ? 'bankLoan' : 'dailyDebt',
          targetLoanId: targetLoan?.id,
        }
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar el abono');
      setStep('input');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/80 shadow-xl my-4 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {isBank
                ? isFullPayoff
                  ? 'Liquidar Préstamo Bancario'
                  : 'Abonar a Préstamo Bancario'
                : isFullPayoff
                ? 'Liquidar Deuda Corriente'
                : 'Registrar Abono a Deuda Corriente'}
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Cliente: <strong className="text-slate-900 font-semibold">{client.name}</strong> ({client.clientNumber})
              {isBank && targetLoan && (
                <> • Préstamo: <strong className="font-mono text-indigo-700">{targetLoan.code}</strong></>
              )}
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

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Input Form */}
        {step === 'input' && (
          <form onSubmit={handleNextStep} className="p-6 space-y-4">
            {/* Balance Summary Box */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-1.5">
              {isBank && targetLoan ? (
                <>
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                    <span>Préstamo a Abonar:</span>
                    <span className="font-mono font-bold text-slate-900">{targetLoan.code}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                    <span>Saldo Pendiente del Préstamo:</span>
                    <span className="font-mono font-extrabold text-sm text-rose-600">
                      S/ {targetDebt.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400 font-medium pt-1 border-t border-slate-200/60">
                    <span>Deuda Bancaria Total (Agregada):</span>
                    <span className="font-mono font-semibold text-slate-600">
                      S/ {(client.bankDebtBalance ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                    <span>Deuda Corriente Pendiente:</span>
                    <span
                      className={`font-mono font-extrabold text-sm ${
                        targetDebt > 0 ? 'text-rose-600' : 'text-indigo-600'
                      }`}
                    >
                      S/ {targetDebt.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                    <span>Límite de Crédito:</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      {client.creditLimit > 0
                        ? `S/ ${client.creditLimit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                        : 'Sin límite'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400 font-medium pt-1 border-t border-slate-200/60">
                    <span>Saldo Consolidado Total:</span>
                    <span className="font-mono font-semibold text-slate-600">
                      S/ {client.currentBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Quick Action: Liquidar Adeudo */}
            <div className="flex items-center gap-2.5 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
              <input
                id="checkbox-liquidar"
                type="checkbox"
                checked={isFullPayoff}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsFullPayoff(checked);
                  if (checked) {
                    const fullAmount = isBank ? targetDebt : Math.max(0, targetDebt);
                    setAmountInput(String(fullAmount));
                  }
                }}
                className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="checkbox-liquidar" className="text-xs font-bold text-slate-800 cursor-pointer">
                {isBank
                  ? `Liquidar préstamo completo (S/ ${targetDebt.toFixed(2)} Soles Peruanos)`
                  : `Liquidar adeudo corriente completo (S/ ${Math.max(0, targetDebt).toFixed(2)} Soles Peruanos)`}
              </label>
            </div>

            {/* Payment Amount Input */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Importe del Abono (S/ Soles Peruanos) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 font-mono font-bold text-lg">
                  S/
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  disabled={isFullPayoff}
                  value={isFullPayoff ? (isBank ? targetDebt : Math.max(0, targetDebt)) : amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-12 pl-11 pr-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xl font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-right"
                  required
                />
              </div>
            </div>

            {/* Resulting Balance Calculation Preview */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex justify-between items-center shadow-2xs">
              <span className="text-xs font-medium text-slate-500">
                {isBank ? 'Saldo Pendiente Resultante del Préstamo:' : 'Nuevo Saldo Corriente Resultante:'}
              </span>
              <span
                className={`font-mono font-extrabold text-base ${
                  resultingBalance > 0 ? 'text-rose-600' : 'text-indigo-600'
                }`}
              >
                S/ {resultingBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta de Débito / Crédito (Recargo +5%)</option>
                <option value="Transferencia">Transferencia bancaria / Yape / Plin</option>
              </select>
            </div>

            {/* Business Rule Banner when paying with Card */}
            {paymentMethod === 'Tarjeta' && (
              <div className="p-3 bg-indigo-50/90 border border-indigo-200 rounded-2xl space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-extrabold text-indigo-950">
                  <span className="material-symbols-outlined text-[18px] text-indigo-600">credit_card</span>
                  <span>Regla de Negocio: Pago con Tarjeta (+5%)</span>
                </div>
                <div className="text-[11px] text-indigo-800 leading-snug">
                  Se agrega un <strong>5% de recargo</strong> por comisión bancaria en pagos con tarjeta de débito/crédito:
                </div>
                <div className="space-y-1 pt-1 border-t border-indigo-200/60 text-slate-700">
                  <div className="flex justify-between items-center">
                    <span>Abono abonado a deuda:</span>
                    <span className="font-mono font-bold">S/ {payAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-indigo-900 font-bold">
                    <span>Recargo por Tarjeta (5%):</span>
                    <span className="font-mono">+S/ {cardSurcharge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-900 font-extrabold pt-1 border-t border-indigo-200/80">
                    <span>Total a cobrar en POS:</span>
                    <span className="font-mono text-indigo-700 text-sm">S/ {totalCharged.toFixed(2)} PEN</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Notas u Observaciones
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Pago en caja 1 con ticket #1029"
                className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Footer buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Continuar a Confirmación</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Pre-Confirmation Screen */}
        {step === 'confirm' && (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-amber-50 text-amber-900 border border-amber-200/80 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">help_outline</span>
                Confirmación de Movimiento Financiero
              </div>
              <p className="text-xs text-amber-800">
                Por favor revise cuidadosamente los valores antes de aplicar la transacción:
              </p>
            </div>

            {/* Pre-Confirmation Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 text-xs overflow-hidden">
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">Cliente:</span>
                <span className="font-bold text-slate-900">{client.name}</span>
              </div>
              {isBank && targetLoan ? (
                <>
                  <div className="p-3 flex justify-between">
                    <span className="text-slate-500 font-medium">Préstamo:</span>
                    <span className="font-mono font-bold text-indigo-700">{targetLoan.code}</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-slate-500 font-medium">Saldo Pendiente del Préstamo:</span>
                    <span className="font-mono font-bold text-rose-600">
                      S/ {targetDebt.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="p-3 flex justify-between">
                  <span className="text-slate-500 font-medium">Deuda Corriente Actual:</span>
                  <span className="font-mono font-bold text-rose-600">
                    S/ {targetDebt.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="p-3 flex justify-between bg-emerald-50/60">
                <span className="text-emerald-900 font-bold">Importe del Abono:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  -S/ {payAmount.toLocaleString('es-PE', { minimumFractionDigits: 2 })} PEN
                </span>
              </div>
              {paymentMethod === 'Tarjeta' && (
                <>
                  <div className="p-3 flex justify-between bg-amber-50/60">
                    <span className="text-amber-900 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">credit_card</span>
                      Recargo por Tarjeta (5%):
                    </span>
                    <span className="font-mono font-bold text-amber-800 text-xs">
                      +S/ {cardSurcharge.toLocaleString('es-PE', { minimumFractionDigits: 2 })} PEN
                    </span>
                  </div>
                  <div className="p-3 flex justify-between bg-indigo-50/60">
                    <span className="text-indigo-900 font-extrabold">Total Cobrado en POS / Tarjeta:</span>
                    <span className="font-mono font-black text-indigo-700 text-sm">
                      S/ {totalCharged.toLocaleString('es-PE', { minimumFractionDigits: 2 })} PEN
                    </span>
                  </div>
                </>
              )}
              <div className="p-3 flex justify-between">
                <span className="text-slate-500 font-medium">
                  {isBank ? 'Nuevo Saldo del Préstamo:' : 'Nuevo Saldo Corriente Resultante:'}
                </span>
                <span
                  className={`font-mono font-black text-sm ${
                    resultingBalance > 0 ? 'text-rose-600' : 'text-indigo-600'
                  }`}
                >
                  S/ {resultingBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })} PEN
                </span>
              </div>
              <div className="p-3 flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Método de Pago:</span>
                <span className="font-semibold text-slate-800">{paymentMethod}</span>
              </div>
            </div>

            {!isBank && resultingBalance < 0 && (
              <div className="p-3 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs flex items-center gap-2 font-medium">
                <span className="material-symbols-outlined text-[18px]">info</span>
                <span>
                  Este abono genera un <strong>saldo a favor de S/ {Math.abs(resultingBalance).toFixed(2)}</strong> para el cliente en su cuenta corriente.
                </span>
              </div>
            )}

            {/* Confirmation Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={loading}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-center"
              >
                Volver a Editar
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{loading ? 'Procesando...' : 'Confirmar y Registrar Movimiento'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
