import React from 'react';
import { LoanInstallment, PaymentFrequency } from '../types';
import { formatSpanishDate, formatCurrency } from '../utils/loanCalculations';

interface LoanScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  capital: number;
  interestRate: number;
  interestAmount: number;
  totalAmount: number;
  installmentsCount: number;
  frequency: PaymentFrequency;
  installments: LoanInstallment[];
  title?: string;
  code?: string;
}

export const LoanScheduleModal: React.FC<LoanScheduleModalProps> = ({
  isOpen,
  onClose,
  clientName,
  capital,
  interestRate,
  interestAmount,
  totalAmount,
  installmentsCount,
  frequency,
  installments,
  title = 'Cronograma de Pagos',
  code,
}) => {
  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pagada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Pagada
          </span>
        );
      case 'Parcial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Parcial
          </span>
        );
      case 'Vencida':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Vencida
          </span>
        );
      case 'Anulada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 line-through">
            Anulada
          </span>
        );
      case 'Pendiente':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-60 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl my-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-indigo-600 text-white p-5 md:p-6 flex items-center justify-between relative shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 text-white border border-white/20 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[26px]">calendar_month</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
                {code && (
                  <span className="bg-white/20 text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded-md">
                    {code}
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-100/90 mt-0.5">
                Cliente: <strong className="text-white font-bold">{clientName}</strong> • Frecuencia: {frequency}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-indigo-700/80 hover:bg-indigo-800 text-indigo-100 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Summary Info Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capital Inicial</p>
              <p className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">{formatCurrency(capital)}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Interés ({interestRate}%)</p>
              <p className="text-sm font-extrabold text-indigo-600 font-mono mt-0.5">+{formatCurrency(interestAmount)}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</p>
              <p className="text-sm font-extrabold text-rose-600 font-mono mt-0.5">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cuotas Totales</p>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5">{installmentsCount} ({frequency})</p>
            </div>
          </div>
        </div>

        {/* Installment Table */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 text-center">N° Cuota</th>
                  <th className="py-3 px-4">Fecha Vencimiento</th>
                  <th className="py-3 px-4 text-right">Capital</th>
                  <th className="py-3 px-4 text-right">Interés</th>
                  <th className="py-3 px-4 text-right">Importe Total</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {installments.map((inst) => (
                  <tr key={inst.installmentNumber} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold inline-flex items-center justify-center font-mono">
                        {inst.installmentNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">event</span>
                        <span className="font-extrabold text-slate-900 font-mono">
                          {formatSpanishDate(inst.dueDate)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 font-medium whitespace-nowrap">
                      {formatCurrency(inst.capital)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-600 font-semibold whitespace-nowrap">
                      +{formatCurrency(inst.interest)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-extrabold text-slate-900 whitespace-nowrap">
                      {formatCurrency(inst.amount)}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(inst.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span className="text-xs text-slate-500 font-medium">
            Interés simple sobre capital inicial ({interestRate}%) distribuido en {installmentsCount} cuotas.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            Cerrar Cronograma
          </button>
        </div>
      </div>
    </div>
  );
};
