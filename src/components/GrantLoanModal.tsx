import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, PaymentFrequency } from '../types';
import {
  calculateLoanSchedule,
  calculateDueDate,
  formatCurrency,
  formatSpanishDate,
} from '../utils/loanCalculations';
import { LoanScheduleModal } from './LoanScheduleModal';
import { ClientSelector } from './ClientSelector';

interface GrantLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  initialClientId?: string | null;
  onSubmit: (
    clientId: string,
    loanData: {
      capital: number;
      interestRate: number;
      interestAmount: number;
      totalAmount: number;
      installmentsCount: number;
      installmentAmount: number;
      frequency: string;
      firstDueDate: string;
      product?: string;
      ticketNumber?: string;
      notes?: string;
      date?: string;
    }
  ) => Promise<void>;
  onClientCreated?: (newClient: Client) => void;
}

export const GrantLoanModal: React.FC<GrantLoanModalProps> = ({
  isOpen,
  onClose,
  clients,
  initialClientId,
  onSubmit,
  onClientCreated,
}) => {
  const getTodayString = () => new Date().toISOString().split('T')[0];

  const prevIsOpen = useRef(false);
  const prevInitialClientId = useRef(initialClientId);
  const isSubmittingRef = useRef(false);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [capital, setCapital] = useState<number | string>('1000');
  const [interestRate, setInterestRate] = useState<number | string>('10');
  const [installmentsCount, setInstallmentsCount] = useState<number | string>('5');
  const [frequency, setFrequency] = useState<PaymentFrequency>('Mensual');
  const [firstDueDate, setFirstDueDate] = useState(getTodayString());
  const [product, setProduct] = useState('Crédito con intereses');
  const [ticketNumber, setTicketNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form initialization: only reset fields when modal opens fresh, preserving data if a client is created while open
  useEffect(() => {
    if (isOpen) {
      if (!prevIsOpen.current || (initialClientId && initialClientId !== prevInitialClientId.current)) {
        if (initialClientId) {
          const found = clients.find((c) => c.id === initialClientId) || null;
          setSelectedClient(found);
        } else {
          setSelectedClient(null);
        }

        setCapital('1000');
        setInterestRate('10');
        setInstallmentsCount('5');
        setFrequency('Mensual');

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30);
        setFirstDueDate(nextDate.toISOString().split('T')[0]);

        setProduct('Crédito otorgado con intereses');
        setTicketNumber(`CR-${Math.floor(100000 + Math.random() * 900000)}`);
        setNotes('');
        setError(null);
        setShowScheduleModal(false);
      }
    }
    prevIsOpen.current = isOpen;
    prevInitialClientId.current = initialClientId;
  }, [isOpen, initialClientId]);

  // Keep selectedClient synced with clients array if balance/limit changes
  useEffect(() => {
    if (selectedClient) {
      const updated = clients.find((c) => c.id === selectedClient.id);
      if (
        updated &&
        (updated.creditLimit !== selectedClient.creditLimit ||
          updated.currentBalance !== selectedClient.currentBalance ||
          updated.name !== selectedClient.name)
      ) {
        setSelectedClient(updated);
      }
    }
  }, [clients, selectedClient]);

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

  if (!isOpen) return null;

  const clientBalance = selectedClient?.currentBalance || 0;
  const clientLimit = selectedClient?.creditLimit || 0;
  const projectedBalance = clientBalance + loanCalculation.totalAmount;
  const isOverLimit = clientLimit > 0 && projectedBalance > clientLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setError(null);

    if (!selectedClient) {
      setError('Debe seleccionar un cliente activo');
      return;
    }

    if (selectedClient.status === 'Desactivado') {
      setError('No se puede otorgar crédito a un cliente desactivado');
      return;
    }

    if (numCapital <= 0) {
      setError('El capital prestado debe ser mayor a S/ 0.00');
      return;
    }

    if (numInstallments < 1) {
      setError('El número de cuotas debe ser al menos 1');
      return;
    }

    if (isOverLimit) {
      setError(
        `El crédito supera el límite de crédito disponible del cliente (Límite: S/ ${clientLimit.toFixed(
          2
        )}, Total a pagar: S/ ${loanCalculation.totalAmount.toFixed(2)}, Saldo proyectado: S/ ${projectedBalance.toFixed(
          2
        )}).`
      );
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await onSubmit(selectedClient.id, {
        capital: loanCalculation.capital,
        interestRate: loanCalculation.interestRate,
        interestAmount: loanCalculation.interestAmount,
        totalAmount: loanCalculation.totalAmount,
        installmentsCount: loanCalculation.installmentsCount,
        installmentAmount: loanCalculation.installmentAmount,
        frequency: loanCalculation.frequency,
        firstDueDate: loanCalculation.firstDueDate,
        product: product.trim() || undefined,
        ticketNumber: ticketNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        date: getTodayString(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al otorgar crédito con intereses');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
                <span className="material-symbols-outlined text-[22px]">account_balance</span>
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Otorgar Crédito con Intereses
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Módulo Banco • Cálculo financiero y cronograma de cuotas
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Cerrar modal"
              aria-label="Cerrar modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-medium flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Reusable Client Selector in Bank Mode */}
            <ClientSelector
              selectedClient={selectedClient}
              onSelectClient={(c) => setSelectedClient(c)}
              clients={clients}
              mode="bank"
              label="Seleccionar Cliente *"
              disabled={loading}
              onClientCreated={onClientCreated}
            />

            {/* Financial Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Capital */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Capital Prestado *
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
                    placeholder="1000.00"
                    className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-right"
                    required
                  />
                </div>
              </div>

              {/* Interest Rate */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Tasa de Interés (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="10"
                    className="w-full h-10 pl-3 pr-7 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-right"
                    required
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 font-bold text-xs">
                    %
                  </span>
                </div>
              </div>

              {/* Installments Count */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Número de Cuotas *
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  placeholder="5"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all text-center"
                  required
                />
              </div>
            </div>

            {/* Frequency and First Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Frequency */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Frecuencia de Pago
                </label>
                <select
                  value={frequency}
                  onChange={(e) => handleFrequencyChange(e.target.value as PaymentFrequency)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="Semanal">Semanal (cada 7 días)</option>
                  <option value="Quincenal">Quincenal (cada 15 días)</option>
                  <option value="Mensual">Mensual (cada 30 días)</option>
                </select>
              </div>

              {/* First Due Date */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Primera Fecha de Vencimiento *
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

            {/* Real-time Financial Breakdown Box */}
            <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Capital
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    {formatCurrency(loanCalculation.capital)}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Interés ({loanCalculation.interestRate}%)
                  </span>
                  <span className="font-mono font-bold text-indigo-600 text-xs">
                    +{formatCurrency(loanCalculation.interestAmount)}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total a Pagar
                  </span>
                  <span className="font-mono font-extrabold text-rose-600 text-xs">
                    {formatCurrency(loanCalculation.totalAmount)}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-indigo-100/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Valor por Cuota
                  </span>
                  <span className="font-mono font-extrabold text-indigo-700 text-xs">
                    {formatCurrency(loanCalculation.installmentAmount)}
                  </span>
                </div>
              </div>

              {/* Schedule preview button */}
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="w-full py-2 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                <span>Previsualizar Cronograma ({loanCalculation.installmentsCount} cuotas {loanCalculation.frequency})</span>
              </button>

              {/* Credit Limit warning if exceeded */}
              {clientLimit > 0 && (
                <div
                  className={`pt-2 border-t border-indigo-100 flex justify-between items-center text-[11px] font-semibold ${
                    isOverLimit ? 'text-rose-600' : 'text-slate-600'
                  }`}
                >
                  <span>Límite disponible: {formatCurrency(clientLimit)}</span>
                  <span>
                    Saldo proyectado: {formatCurrency(projectedBalance)} {isOverLimit && '⚠️ (Excedido)'}
                  </span>
                </div>
              )}
            </div>

            {/* Ticket & Concept Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Concepto del Crédito
                </label>
                <input
                  type="text"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="Ej. Crédito con intereses 10%"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Código / Folio
                </label>
                <input
                  type="text"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="Ej. CR-108200"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Observaciones / Notas (Opcional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentarios adicionales sobre el crédito..."
                className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !selectedClient || isOverLimit || numCapital <= 0}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">done</span>
                <span>{loading ? 'Otorgando crédito...' : 'Otorgar Crédito'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Reused LoanScheduleModal */}
      {showScheduleModal && (
        <LoanScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          clientName={selectedClient?.name || 'Cliente'}
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
