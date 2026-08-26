import React, { useState, useEffect, useMemo } from 'react';
import { Client, PaymentPeriod, PaymentFrequency } from '../types';
import {
  calculateLoanSchedule,
  calculateDueDate,
  formatCurrency,
} from '../utils/loanCalculations';
import { LoanScheduleModal } from './LoanScheduleModal';

export interface InitialCreditPayload {
  debtType: 'none' | 'simple' | 'credit';
  // For simple debt
  simpleAmount?: number;
  simpleConcept?: string;
  // For credit with interest
  capital?: number;
  interestRate?: number;
  interestAmount?: number;
  totalAmount?: number;
  installmentsCount?: number;
  installmentAmount?: number;
  frequency?: PaymentFrequency;
  firstDueDate?: string;
}

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clientData: Partial<Client>, initialCredit?: InitialCreditPayload) => Promise<void>;
  initialClient?: Client | null;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialClient,
}) => {
  // Client base info
  const [name, setName] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState<number | string>(0);
  const [paymentPeriod, setPaymentPeriod] = useState<PaymentPeriod>('Mensual');
  const [paymentDay, setPaymentDay] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Credit Mode
  const [initialDebtType, setInitialDebtType] = useState<'none' | 'simple' | 'credit'>('none');

  // Simple Debt fields
  const [simpleAmount, setSimpleAmount] = useState<number | string>('');
  const [simpleConcept, setSimpleConcept] = useState('Saldo inicial de apertura');

  // Credit with Interest fields
  const [creditCapital, setCreditCapital] = useState<number | string>('');
  const [interestRate, setInterestRate] = useState<number | string>(10);
  const [installmentsCount, setInstallmentsCount] = useState<number | string>(5);
  const [frequency, setFrequency] = useState<PaymentFrequency>('Mensual');
  const [firstDueDate, setFirstDueDate] = useState<string>('');

  // Schedule modal view state
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (initialClient) {
      setName(initialClient.name);
      setClientNumber(initialClient.clientNumber);
      setAddress(initialClient.address || '');
      setPhone(initialClient.phone || '');
      setCreditLimit(initialClient.creditLimit);
      setPaymentPeriod(initialClient.paymentPeriod || 'Mensual');
      setPaymentDay(initialClient.paymentDay || '');
      setNextDueDate(initialClient.nextDueDate || '');
      setInitialDebtType('none');
    } else {
      setName('');
      setClientNumber(`CLI-${Math.floor(1050 + Math.random() * 50)}`);
      setAddress('');
      setPhone('');
      setCreditLimit(0);
      setPaymentPeriod('Mensual');
      setPaymentDay('Día 15');
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      setNextDueDate(futureDate.toISOString().split('T')[0]);

      // Initialize credit fields
      setInitialDebtType('none');
      setSimpleAmount('');
      setSimpleConcept('Saldo inicial de apertura');
      setCreditCapital('');
      setInterestRate(10);
      setInstallmentsCount(5);
      setFrequency('Mensual');

      const today = new Date().toISOString().split('T')[0];
      setFirstDueDate(calculateDueDate(today, 1, 'Mensual'));
    }
    setError(null);
    setShowScheduleModal(false);
  }, [initialClient, isOpen]);

  // Adjust first due date when frequency changes
  const handleFrequencyChange = (newFreq: PaymentFrequency) => {
    setFrequency(newFreq);
    const today = new Date().toISOString().split('T')[0];
    setFirstDueDate(calculateDueDate(today, 1, newFreq));
  };

  // Real-time calculation for Credit with Interest
  const loanCalculation = useMemo(() => {
    const cap = parseFloat(String(creditCapital)) || 0;
    const rate = parseFloat(String(interestRate)) || 0;
    const count = parseInt(String(installmentsCount), 10) || 1;
    const startDate = firstDueDate || new Date().toISOString().split('T')[0];

    return calculateLoanSchedule({
      capital: cap,
      interestRate: rate,
      installmentsCount: count,
      frequency,
      firstDueDate: startDate,
    });
  }, [creditCapital, interestRate, installmentsCount, frequency, firstDueDate]);

  if (!isOpen) return null;

  const parsedCreditLimit = parseFloat(String(creditLimit)) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El Nombre Completo es obligatorio');
      return;
    }

    // Validation for simple debt
    if (initialDebtType === 'simple') {
      const amt = parseFloat(String(simpleAmount)) || 0;
      if (amt <= 0) {
        setError('El monto de la deuda simple inicial debe ser mayor a S/ 0.00');
        return;
      }
      if (parsedCreditLimit > 0 && amt > parsedCreditLimit) {
        setError(`El saldo inicial supera el límite de crédito fijado (S/ ${parsedCreditLimit.toFixed(2)})`);
        return;
      }
    }

    // Validation for credit with interest
    if (initialDebtType === 'credit') {
      const cap = parseFloat(String(creditCapital)) || 0;
      if (cap <= 0) {
        setError('El monto del capital del crédito debe ser mayor a S/ 0.00');
        return;
      }
      if (parsedCreditLimit > 0 && loanCalculation.totalAmount > parsedCreditLimit) {
        setError(
          `El total del crédito a pagar (S/ ${loanCalculation.totalAmount.toFixed(2)}) supera el límite de crédito fijado (S/ ${parsedCreditLimit.toFixed(2)})`
        );
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const initialCreditPayload: InitialCreditPayload = {
        debtType: initialDebtType,
        simpleAmount: initialDebtType === 'simple' ? parseFloat(String(simpleAmount)) : undefined,
        simpleConcept: initialDebtType === 'simple' ? simpleConcept.trim() : undefined,
        capital: initialDebtType === 'credit' ? loanCalculation.capital : undefined,
        interestRate: initialDebtType === 'credit' ? loanCalculation.interestRate : undefined,
        interestAmount: initialDebtType === 'credit' ? loanCalculation.interestAmount : undefined,
        totalAmount: initialDebtType === 'credit' ? loanCalculation.totalAmount : undefined,
        installmentsCount: initialDebtType === 'credit' ? loanCalculation.installmentsCount : undefined,
        installmentAmount: initialDebtType === 'credit' ? loanCalculation.installmentAmount : undefined,
        frequency: initialDebtType === 'credit' ? frequency : undefined,
        firstDueDate: initialDebtType === 'credit' ? firstDueDate : undefined,
      };

      await onSubmit(
        {
          name: name.trim(),
          clientNumber: clientNumber.trim(),
          address: address.trim(),
          phone: phone.trim(),
          creditLimit: parsedCreditLimit,
          paymentPeriod,
          paymentDay: paymentDay.trim(),
          nextDueDate: nextDueDate.trim(),
        },
        initialDebtType !== 'none' ? initialCreditPayload : undefined
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200/80 shadow-2xl my-4 max-h-[92vh] flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {initialClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {initialClient
                  ? 'Modifique los datos de contacto, límite y periodos de cobro del cliente.'
                  : 'Registre un nuevo cliente con opción de asignarle un crédito inicial con intereses.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-medium flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* General Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label htmlFor="client-name" className="block text-xs font-bold text-slate-700">
                  Nombre Completo *
                </label>
                <input
                  id="client-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                  required
                />
              </div>

              {/* Client Code */}
              <div className="space-y-1">
                <label htmlFor="client-number" className="block text-xs font-bold text-slate-700">
                  Número / Código de Cliente
                </label>
                <input
                  id="client-number"
                  type="text"
                  value={clientNumber}
                  onChange={(e) => setClientNumber(e.target.value)}
                  placeholder="CLI-1042"
                  className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Address & Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="client-address" className="block text-xs font-bold text-slate-700">
                  Dirección
                </label>
                <input
                  id="client-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle principal 123, Ciudad"
                  className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="client-phone" className="block text-xs font-bold text-slate-700">
                  Teléfono
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">call</span>
                  </span>
                  <input
                    id="client-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="555-000-0000"
                    className="w-full h-10 pl-9 pr-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Credit Limit & Cobro Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="space-y-1">
                <label htmlFor="credit-limit" className="block text-xs font-bold text-slate-700">
                  Límite de Crédito (S/)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-mono text-xs font-bold">
                    S/
                  </span>
                  <input
                    id="credit-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 pl-9 pr-3.5 border border-slate-200 rounded-xl bg-white text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-right"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Periodo de Pago</label>
                <select
                  value={paymentPeriod}
                  onChange={(e) => setPaymentPeriod(e.target.value as PaymentPeriod)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option value="Semanal">Semanal</option>
                  <option value="Quincenal">Quincenal</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Día Fijo">Día Fijo al Mes</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Próxima Fecha de Cobro</label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-900 font-mono text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* SECCIÓN DE CRÉDITO / SALDO INICIAL (SOLO AL CREAR NUEVO CLIENTE) */}
            {!initialClient && (
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600 text-[20px]">account_balance_wallet</span>
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Asignar Saldo / Crédito Inicial
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">(Opcional)</span>
                </div>

                {/* Pill Mode Switcher */}
                <div className="p-1 bg-slate-200/60 rounded-xl flex gap-1">
                  <button
                    type="button"
                    onClick={() => setInitialDebtType('none')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      initialDebtType === 'none'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    <span>Sin crédito inicial</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInitialDebtType('simple')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      initialDebtType === 'simple'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                    <span>Deuda simple</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInitialDebtType('credit')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      initialDebtType === 'credit'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">percent</span>
                    <span>Crédito con intereses</span>
                  </button>
                </div>

                {/* Sub-form: Simple Debt */}
                {initialDebtType === 'simple' && (
                  <div className="p-4 bg-white rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Monto Deuda Inicial (S/) *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-mono text-xs font-bold">
                            S/
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={simpleAmount}
                            onChange={(e) => setSimpleAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full h-10 pl-9 pr-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-right"
                            required={initialDebtType === 'simple'}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Concepto / Motivo
                        </label>
                        <input
                          type="text"
                          value={simpleConcept}
                          onChange={(e) => setSimpleConcept(e.target.value)}
                          placeholder="Saldo inicial"
                          className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-form: Crédito con Intereses (Exact Match with AddDebtModal) */}
                {initialDebtType === 'credit' && (
                  <div className="space-y-4">
                    {/* Financial Inputs Grid */}
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
                            value={creditCapital}
                            onChange={(e) => setCreditCapital(e.target.value)}
                            placeholder="Ej. 1000.00"
                            className="w-full h-10 pl-9 pr-3.5 border border-slate-200 rounded-xl bg-white text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-right"
                            required={initialDebtType === 'credit'}
                          />
                        </div>
                      </div>

                      {/* Interest Rate */}
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
                            placeholder="10"
                            className="w-full h-10 px-3.5 pr-8 border border-slate-200 rounded-xl bg-white text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-right"
                            required={initialDebtType === 'credit'}
                          />
                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 font-mono text-xs font-bold">
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Installments, Frequency & First Due Date */}
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
                          className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-white text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-center"
                          required={initialDebtType === 'credit'}
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
                          className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
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
                          className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                          required={initialDebtType === 'credit'}
                        />
                      </div>
                    </div>

                    {/* DYNAMIC CREDIT SUMMARY CARD (Resumen del Crédito) */}
                    <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3">
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
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Interés ({loanCalculation.interestRate}%)
                          </span>
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
                            {formatCurrency(loanCalculation.installmentAmount)} <span className="text-[11px] font-normal text-slate-500">/ cuota</span>
                          </p>
                        </div>
                      </div>

                      {/* Credit Limit vs Loan Comparison */}
                      <div className="pt-2 border-t border-indigo-100/80 flex items-center justify-between text-[11px] text-slate-600">
                        <span>
                          Total crédito inicial:{' '}
                          <strong className="font-mono text-rose-600 font-bold">
                            {formatCurrency(loanCalculation.totalAmount)}
                          </strong>
                        </span>
                        <span className="font-medium">
                          Límite:{' '}
                          <strong className="font-mono text-slate-900 font-bold">
                            {parsedCreditLimit > 0 ? formatCurrency(parsedCreditLimit) : 'Sin límite'}
                          </strong>
                        </span>
                      </div>

                      {/* View Schedule Button */}
                      <button
                        type="button"
                        onClick={() => setShowScheduleModal(true)}
                        className="w-full py-2 bg-white hover:bg-indigo-50/50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                        <span>Ver cronograma de pagos ({loanCalculation.installmentsCount} cuotas)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                {loading ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Loan Schedule Modal */}
      {showScheduleModal && (
        <LoanScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          clientName={name || 'Nuevo Cliente'}
          capital={loanCalculation.capital}
          interestRate={loanCalculation.interestRate}
          interestAmount={loanCalculation.interestAmount}
          totalAmount={loanCalculation.totalAmount}
          installmentsCount={loanCalculation.installmentsCount}
          frequency={loanCalculation.frequency}
          installments={loanCalculation.installments}
          title="Cronograma Proyectado de Cuotas"
        />
      )}
    </>
  );
};
