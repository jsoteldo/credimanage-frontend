import React, { useState, useEffect, useMemo } from 'react';
import { Client, PaymentFrequency } from '../types';
import { calculateLoanSchedule, formatSpanishDate, formatCurrency, round2 } from '../utils/loanCalculations';
import { LoanScheduleModal } from './LoanScheduleModal';

interface AddDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSubmit: (
    clientId: string,
    debtData: {
      product: string;
      unitPrice: number;
      quantity: number;
      ticketNumber?: string;
      date?: string;
      debtType?: 'simple' | 'credit';
      capital?: number;
      interestRate?: number;
      interestAmount?: number;
      totalAmount?: number;
      installmentsCount?: number;
      installmentAmount?: number;
      frequency?: PaymentFrequency;
      firstDueDate?: string;
      notes?: string;
    }
  ) => Promise<void>;
}

export const AddDebtModal: React.FC<AddDebtModalProps> = ({
  isOpen,
  onClose,
  client,
  onSubmit,
}) => {
  const getTodayString = () => new Date().toISOString().split('T')[0];

  // Mode: 'simple' | 'credit'
  const [debtType, setDebtType] = useState<'simple' | 'credit'>('simple');

  // Simple Debt State
  const [product, setProduct] = useState('');
  const [debtDate, setDebtDate] = useState(getTodayString());
  const [amount, setAmount] = useState<number | string>('');
  const [ticketNumber, setTicketNumber] = useState('');

  // Credit With Interest State
  const [capital, setCapital] = useState<number | string>('1000');
  const [interestRate, setInterestRate] = useState<number | string>('10');
  const [installmentsCount, setInstallmentsCount] = useState<number | string>('5');
  const [frequency, setFrequency] = useState<PaymentFrequency>('Mensual');
  const [firstDueDate, setFirstDueDate] = useState(getTodayString());
  const [creditConcept, setCreditConcept] = useState('Crédito otorgado con intereses');
  const [creditTicketNumber, setCreditTicketNumber] = useState('');
  const [creditNotes, setCreditNotes] = useState('');

  // UI state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showConfirmationStep, setShowConfirmationStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form values
  useEffect(() => {
    if (isOpen) {
      setDebtType('simple');
      setProduct('Cargo de deuda por compra a crédito');
      setDebtDate(getTodayString());
      setAmount('');
      setTicketNumber(`CARGO-${Math.floor(1000 + Math.random() * 9000)}`);

      // Credit defaults
      setCapital('');
      setInterestRate('10');
      setInstallmentsCount('5');
      setFrequency('Mensual');
      // Set default first due date: 1 month from now for monthly, 7 days for weekly
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      setFirstDueDate(nextDate.toISOString().split('T')[0]);
      setCreditConcept('Crédito otorgado con intereses');
      setCreditTicketNumber(`CR-${Math.floor(100000 + Math.random() * 900000)}`);
      setCreditNotes('');

      setShowScheduleModal(false);
      setShowConfirmationStep(false);
      setError(null);
    }
  }, [isOpen]);

  // Adjust default first due date when frequency changes if user hasn't explicitly customized
  const handleFrequencyChange = (newFreq: PaymentFrequency) => {
    setFrequency(newFreq);
    const date = new Date();
    if (newFreq === 'Semanal') {
      date.setDate(date.getDate() + 7);
    } else if (newFreq === 'Quincenal') {
      date.setDate(date.getDate() + 15);
    } else {
      date.setDate(date.getDate() + 30);
    }
    setFirstDueDate(date.toISOString().split('T')[0]);
  };

  // Safe numerical calculations for Credit with Interest
  const numCapital = parseFloat(String(capital)) || 0;
  const numInterestRate = parseFloat(String(interestRate)) || 0;
  const numInstallments = parseInt(String(installmentsCount), 10) || 1;

  const loanCalculation = useMemo(() => {
    return calculateLoanSchedule({
      capital: numCapital,
      interestRate: numInterestRate,
      installmentsCount: numInstallments,
      frequency,
      firstDueDate: firstDueDate || getTodayString(),
    });
  }, [numCapital, numInterestRate, numInstallments, frequency, firstDueDate]);

  if (!isOpen || !client) return null;

  const currentBalance = client.currentBalance;

  // Simple debt calculation
  const simpleDebtToAdd = parseFloat(String(amount)) || 0;
  const simpleProjectedBalance = currentBalance + simpleDebtToAdd;
  const isSimpleOverLimit = client.creditLimit > 0 && simpleProjectedBalance > client.creditLimit;

  // Credit debt calculation
  const creditTotalDebtToAdd = loanCalculation.totalAmount;
  const creditProjectedBalance = currentBalance + creditTotalDebtToAdd;
  const isCreditOverLimit = client.creditLimit > 0 && creditProjectedBalance > client.creditLimit;

  // Handlers for Simple Debt
  const handleSubmitSimpleDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (simpleDebtToAdd <= 0) {
      setError('El monto de la nueva deuda debe ser mayor a S/ 0.00');
      return;
    }
    if (!product.trim()) {
      setError('Por favor ingrese el concepto o producto de la deuda');
      return;
    }

    if (isSimpleOverLimit) {
      setError(
        `Supera el límite de crédito del cliente (S/ ${client.creditLimit.toFixed(2)}). Exceso: S/ ${(
          simpleProjectedBalance - client.creditLimit
        ).toFixed(2)}`
      );
      return;
    }

    setLoading(true);
    try {
      await onSubmit(client.id, {
        product: product.trim(),
        unitPrice: simpleDebtToAdd,
        quantity: 1,
        ticketNumber: ticketNumber.trim(),
        date: debtDate || getTodayString(),
        debtType: 'simple',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al agregar la deuda');
    } finally {
      setLoading(false);
    }
  };

  // Pre-validate credit before opening confirmation step
  const handleProceedCreditConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numCapital <= 0) {
      setError('El monto del crédito (Capital) debe ser mayor a S/ 0.00');
      return;
    }
    if (numInterestRate < 0 || isNaN(numInterestRate)) {
      setError('El porcentaje de interés debe ser un número mayor o igual a 0%');
      return;
    }
    if (numInstallments < 1 || isNaN(numInstallments)) {
      setError('El número de cuotas debe ser como mínimo 1');
      return;
    }
    if (!firstDueDate) {
      setError('Seleccione la fecha de vencimiento de la primera cuota');
      return;
    }

    if (isCreditOverLimit) {
      setError(
        `El crédito solicitado supera el límite de crédito disponible del cliente (Límite: S/ ${client.creditLimit.toFixed(
          2
        )}, Total Crédito: S/ ${creditTotalDebtToAdd.toFixed(2)}, Nuevo Saldo: S/ ${creditProjectedBalance.toFixed(
          2
        )}).`
      );
      return;
    }

    setShowConfirmationStep(true);
  };

  // Final execution of credit creation
  const handleConfirmCreditFinal = async () => {
    setLoading(true);
    setError(null);

    try {
      await onSubmit(client.id, {
        product: creditConcept.trim() || `Crédito con intereses ${loanCalculation.interestRate}% (${loanCalculation.installmentsCount} cuotas)`,
        unitPrice: loanCalculation.totalAmount,
        quantity: 1,
        ticketNumber: creditTicketNumber.trim() || `CR-${Date.now().toString().slice(-6)}`,
        date: debtDate || getTodayString(),
        debtType: 'credit',
        capital: loanCalculation.capital,
        interestRate: loanCalculation.interestRate,
        interestAmount: loanCalculation.interestAmount,
        totalAmount: loanCalculation.totalAmount,
        installmentsCount: loanCalculation.installmentsCount,
        installmentAmount: loanCalculation.installmentAmount,
        frequency: loanCalculation.frequency,
        firstDueDate: loanCalculation.firstDueDate,
        notes: creditNotes.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el crédito');
      setShowConfirmationStep(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-xs ${
                  debtType === 'credit'
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {debtType === 'credit' ? 'calculate' : 'post_add'}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  {debtType === 'credit' ? 'Registrar Crédito con Intereses' : 'Añadir Deuda / Editar Saldo'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Cliente: <strong className="text-slate-900 font-bold">{client.name}</strong> ({client.clientNumber})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Type Selector (Segmented Tabs) */}
          <div className="p-4 pb-0 bg-white shrink-0">
            <div className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setDebtType('simple');
                  setShowConfirmationStep(false);
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  debtType === 'simple'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                <span>Deuda simple</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDebtType('credit');
                  setShowConfirmationStep(false);
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  debtType === 'credit'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">percent</span>
                <span>Crédito con intereses</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-medium flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Modal Body Container with Scroll */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* ========================================================================= */}
            {/* OPTION 1: DEUDA SIMPLE                                                    */}
            {/* ========================================================================= */}
            {debtType === 'simple' && (
              <form onSubmit={handleSubmitSimpleDebt} className="space-y-4">
                {/* Concept */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Concepto / Descripción del Cargo *
                  </label>
                  <input
                    type="text"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Ej. Compra de mercadería, Factura #108, Cargo adicional"
                    className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Debt Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Fecha del Cargo / Deuda *</span>
                      <span className="text-[10px] text-slate-400 font-normal">Defecto: Hoy</span>
                    </label>
                    <input
                      type="date"
                      value={debtDate}
                      onChange={(e) => setDebtDate(e.target.value)}
                      className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all cursor-pointer"
                      required
                    />
                  </div>

                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Monto de la Deuda * (S/ PEN)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-mono text-xs font-bold">
                        S/
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-10 pl-9 pr-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-extrabold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all text-right"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Ticket / Reference */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Comprobante / Ticket (Opcional)
                  </label>
                  <input
                    type="text"
                    value={ticketNumber}
                    onChange={(e) => setTicketNumber(e.target.value)}
                    placeholder="Ej. TKT-9012"
                    className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Balance Projection Summary */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>Saldo Actual Deudor:</span>
                    <span className="font-mono font-bold text-slate-900">
                      S/ {currentBalance.toFixed(2)} PEN
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>+ Nueva Deuda a Registrar:</span>
                    <span className="font-mono">+S/ {simpleDebtToAdd.toFixed(2)} PEN</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-slate-900">
                    <span>Nuevo Saldo Resultante:</span>
                    <span className="font-mono text-rose-600 text-sm">
                      S/ {simpleProjectedBalance.toFixed(2)} PEN
                    </span>
                  </div>

                  {client.creditLimit > 0 && (
                    <div
                      className={`mt-1 pt-1.5 border-t border-slate-200/60 flex justify-between text-[11px] font-semibold ${
                        isSimpleOverLimit ? 'text-rose-600' : 'text-slate-500'
                      }`}
                    >
                      <span>Límite de Crédito:</span>
                      <span className="font-mono">
                        S/ {client.creditLimit.toFixed(2)} {isSimpleOverLimit && '⚠️ (Excedido)'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || isSimpleOverLimit}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    {loading ? 'Añadiendo...' : 'Confirmar Deuda'}
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================================= */}
            {/* OPTION 2: CRÉDITO CON INTERESES (INPUT OR CONFIRMATION STEP)              */}
            {/* ========================================================================= */}
            {debtType === 'credit' && !showConfirmationStep && (
              <form onSubmit={handleProceedCreditConfirmation} className="space-y-4">
                {/* Capital & Interest Rate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Capital */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Monto del Crédito (Capital) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-mono text-xs font-bold">
                        S/
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={capital}
                        onChange={(e) => setCapital(e.target.value)}
                        placeholder="Ej. 1000.00"
                        className="w-full h-10 pl-9 pr-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-extrabold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-right"
                        required
                      />
                    </div>
                  </div>

                  {/* Interest % */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Porcentaje de Interés (%) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        placeholder="Ej. 10"
                        className="w-full h-10 pl-3.5 pr-8 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-right"
                        required
                      />
                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 font-mono text-xs font-bold">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* Installments & Frequency & First Due Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Number of installments */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      N° de Cuotas *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={installmentsCount}
                      onChange={(e) => setInstallmentsCount(e.target.value)}
                      placeholder="Ej. 5"
                      className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-center"
                      required
                    />
                  </div>

                  {/* Payment Frequency */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Frecuencia de Pago *
                    </label>
                    <select
                      value={frequency}
                      onChange={(e) => handleFrequencyChange(e.target.value as PaymentFrequency)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Semanal">Semanal (Cada 7 días)</option>
                      <option value="Quincenal">Quincenal (Cada 15 días)</option>
                      <option value="Mensual">Mensual (Cada 30 días)</option>
                    </select>
                  </div>

                  {/* First Due Date */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      1ª Cuota Vence *
                    </label>
                    <input
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                      required
                    />
                  </div>
                </div>

                {/* DYNAMIC CREDIT SUMMARY CARD (Resumen del Crédito) */}
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-indigo-600">finance_mode</span>
                      Resumen del Crédito Calculado
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200/60 shadow-2xs">
                      {loanCalculation.frequency}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Capital</span>
                      <p className="font-mono font-extrabold text-slate-900 mt-0.5">
                        {formatCurrency(loanCalculation.capital)}
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Interés ({loanCalculation.interestRate}%)</span>
                      <p className="font-mono font-extrabold text-indigo-600 mt-0.5">
                        +{formatCurrency(loanCalculation.interestAmount)}
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Crédito</span>
                      <p className="font-mono font-extrabold text-rose-600 mt-0.5">
                        {formatCurrency(loanCalculation.totalAmount)}
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">N° Cuotas</span>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {loanCalculation.installmentsCount} cuotas
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs col-span-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Valor por Cuota</span>
                      <p className="font-mono font-extrabold text-indigo-700 text-sm mt-0.5">
                        {formatCurrency(loanCalculation.installmentAmount)} / cuota
                      </p>
                    </div>
                  </div>

                  {/* Balance Impact */}
                  <div className="pt-2 border-t border-indigo-100/80 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 text-xs text-slate-600">
                    <div>
                      <span>Saldo actual: <strong>S/ {currentBalance.toFixed(2)}</strong></span>
                      <span className="mx-1 text-slate-300">•</span>
                      <span>Nuevo saldo con crédito: <strong className="text-rose-600">S/ {creditProjectedBalance.toFixed(2)}</strong></span>
                    </div>

                    {client.creditLimit > 0 && (
                      <span className={`text-[11px] font-bold ${isCreditOverLimit ? 'text-rose-600' : 'text-slate-500'}`}>
                        Límite: S/ {client.creditLimit.toFixed(2)} {isCreditOverLimit && '⚠️ (Superado)'}
                      </span>
                    )}
                  </div>

                  {/* View Schedule Button */}
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="w-full py-2 bg-white hover:bg-indigo-50/80 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                    Ver cronograma de pagos ({loanCalculation.installmentsCount} cuotas)
                  </button>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || isCreditOverLimit || numCapital <= 0}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>Continuar y Confirmar</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================================= */}
            {/* OPTION 2 - STEP 2: CONFIRMATION PREVIEW                                   */}
            {/* ========================================================================= */}
            {debtType === 'credit' && showConfirmationStep && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-[22px] text-amber-600 shrink-0 mt-0.5">
                    verified_user
                  </span>
                  <div className="text-xs text-amber-900">
                    <p className="font-bold">Confirme el otorgamiento de este crédito con intereses</p>
                    <p className="text-amber-800/90 mt-0.5">
                      El monto total a pagar de <strong>{formatCurrency(loanCalculation.totalAmount)}</strong> será sumado al saldo deudor del cliente y se generará su cronograma de pagos.
                    </p>
                  </div>
                </div>

                {/* Full Confirmation Breakdown */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 divide-y divide-slate-200/80 text-xs">
                  <div className="pb-3 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Cliente Beneficiario:</span>
                    <span className="font-bold text-slate-900">{client.name}</span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Monto Capital:</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(loanCalculation.capital)}</span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Tasa de Interés:</span>
                    <span className="font-mono font-semibold text-indigo-700">{loanCalculation.interestRate}%</span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Intereses Generados:</span>
                    <span className="font-mono font-bold text-indigo-600">+{formatCurrency(loanCalculation.interestAmount)}</span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center bg-indigo-50/60 -mx-4 px-4 font-bold">
                    <span className="text-indigo-950">Total del Crédito a Deber:</span>
                    <span className="font-mono text-rose-600 text-sm font-extrabold">{formatCurrency(loanCalculation.totalAmount)}</span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Plan de Pago:</span>
                    <span className="font-semibold text-slate-800">
                      {loanCalculation.installmentsCount} cuotas ({loanCalculation.frequency})
                    </span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Importe por Cuota:</span>
                    <span className="font-mono font-bold text-indigo-700">
                      {formatCurrency(loanCalculation.installmentAmount)}
                    </span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Vencimiento 1ª Cuota:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatSpanishDate(loanCalculation.firstDueDate)}
                    </span>
                  </div>

                  <div className="pt-3 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Nuevo Saldo Deudor Total:</span>
                    <span className="font-mono font-extrabold text-rose-600">
                      {formatCurrency(creditProjectedBalance)}
                    </span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowConfirmationStep(false)}
                    disabled={loading}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Volver y Editar
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(true)}
                      className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                      <span>Cronograma</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmCreditFinal}
                      disabled={loading}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      {loading ? 'Registrando...' : 'Confirmar Crédito'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loan Installment Schedule Modal */}
      <LoanScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        clientName={client.name}
        capital={loanCalculation.capital}
        interestRate={loanCalculation.interestRate}
        interestAmount={loanCalculation.interestAmount}
        totalAmount={loanCalculation.totalAmount}
        installmentsCount={loanCalculation.installmentsCount}
        frequency={loanCalculation.frequency}
        installments={loanCalculation.installments}
        code={creditTicketNumber || 'VISTA PREVIA'}
      />
    </>
  );
};
