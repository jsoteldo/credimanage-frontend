import React, { useState, useEffect } from 'react';
import { CashSession, CashSessionSummary } from '../../types';
import { api } from '../../services/api';

interface CloseCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (closedSession: CashSession) => void;
  session: CashSession | null;
}

export const CloseCashModal: React.FC<CloseCashModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  session,
}) => {
  const [summary, setSummary] = useState<CashSessionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [countedCashAmount, setCountedCashAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && session) {
      loadSummary(session.id);
      setCountedCashAmount('');
      setNotes('');
      setShowConfirm(false);
      setError(null);
    }
  }, [isOpen, session]);

  const loadSummary = async (sessionId: string) => {
    setLoadingSummary(true);
    setError(null);
    try {
      const data = await api.getCashSessionSummary(sessionId);
      setSummary(data);
    } catch (err: any) {
      setError('Error al cargar el resumen del turno');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!isOpen || !session) return null;

  const expectedCash = summary ? summary.expectedCashAmount : 0;
  const countedNum = countedCashAmount === '' ? null : parseFloat(countedCashAmount);
  const difference = countedNum !== null && !isNaN(countedNum) ? countedNum - expectedCash : null;

  const getDifferenceBadge = () => {
    if (difference === null) return null;
    if (Math.abs(difference) < 0.005) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="material-symbols-outlined text-sm mr-1">check_circle</span>
          Cuadra Exacto (S/ 0.00)
        </span>
      );
    } else if (difference > 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
          <span className="material-symbols-outlined text-sm mr-1">arrow_upward</span>
          Sobrante (+S/ {difference.toFixed(2)})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
          <span className="material-symbols-outlined text-sm mr-1">warning</span>
          Faltante (-S/ {Math.abs(difference).toFixed(2)})
        </span>
      );
    }
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (countedNum === null || isNaN(countedNum) || countedNum < 0) {
      setError('Debes ingresar un monto válido de efectivo contado');
      return;
    }

    if (difference !== null && Math.abs(difference) >= 0.01) {
      setShowConfirm(true);
    } else {
      executeClose();
    }
  };

  const executeClose = async () => {
    if (submitting) return;
    if (countedNum === null || isNaN(countedNum)) return;

    setSubmitting(true);
    setError(null);
    try {
      const closed = await api.closeCashSession(session.id, {
        countedCashAmount: countedNum,
        notes: notes.trim() || undefined,
      });
      onSuccess(closed);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al cerrar el turno de caja');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                Arqueo y Cierre de Caja
              </h3>
              <p className="text-xs text-slate-500">
                {session.store?.name || 'Tienda'} · {session.cashRegister?.name || 'Caja'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {loadingSummary ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
              <span className="material-symbols-outlined animate-spin text-3xl text-indigo-600">progress_activity</span>
              <p className="text-xs font-bold text-slate-500">Calculando arqueo del turno...</p>
            </div>
          ) : summary ? (
            <>
              {/* Arqueo breakdown card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Resumen de Efectivo Físico (Gaveta)
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Fondo inicial en efectivo:</span>
                    <span className="font-mono font-bold text-slate-900">
                      S/ {summary.openingCash.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>(+) Ventas en efectivo:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      +S/ {summary.cashSales.toFixed(2)}
                    </span>
                  </div>
                  {summary.cashDebtPayments > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>(+) Cobranza deuda (efectivo):</span>
                      <span className="font-mono font-bold text-emerald-600">
                        +S/ {summary.cashDebtPayments.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {summary.cashIn > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>(+) Ingresos manuales:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        +S/ {summary.cashIn.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {summary.cashOut > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>(-) Retiros / egresos:</span>
                      <span className="font-mono font-bold text-rose-600">
                        -S/ {summary.cashOut.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {summary.cashSaleReversals > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>(-) Devoluciones / anulaciones:</span>
                      <span className="font-mono font-bold text-amber-700">
                        -S/ {summary.cashSaleReversals.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900 uppercase">
                    EFECTIVO ESPERADO EN GAVETA:
                  </span>
                  <span className="text-base font-black font-mono text-slate-900">
                    S/ {expectedCash.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Informative non-cash breakdown */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-purple-50/60 p-2.5 rounded-xl border border-purple-200/60">
                  <span className="text-purple-700 font-bold block text-[11px]">Yape/Plin</span>
                  <span className="font-mono font-bold text-purple-900">
                    S/ {(summary.yapeSales + summary.plinSales).toFixed(2)}
                  </span>
                </div>
                <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-200/60">
                  <span className="text-blue-700 font-bold block text-[11px]">Tarjeta/Transf.</span>
                  <span className="font-mono font-bold text-blue-900">
                    S/ {(summary.cardSales + summary.transferSales).toFixed(2)}
                  </span>
                </div>
                <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-200/60">
                  <span className="text-rose-700 font-bold block text-[11px]">Ventas Crédito</span>
                  <span className="font-mono font-bold text-rose-900">
                    S/ {summary.creditSales.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Form for Counted Cash */}
              {!showConfirm ? (
                <form onSubmit={handlePreSubmit} className="space-y-4 pt-2">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Efectivo Físico Contado (S/)
                      </label>
                      {getDifferenceBadge()}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">S/</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={countedCashAmount}
                        onChange={(e) => setCountedCashAmount(e.target.value)}
                        placeholder={expectedCash.toFixed(2)}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-slate-900 text-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        required
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Cuenta billetes y monedas físicos en la gaveta e ingresa el total real.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Observaciones de Cierre (Opcional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Motivo de diferencias, notas del turno o entregas a gerencia..."
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={countedNum === null || isNaN(countedNum)}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs shadow-indigo-600/30 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">lock</span>
                      <span>Proceder al Cierre</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Confirmation Screen if there is difference */
                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <span className="material-symbols-outlined text-[18px] text-amber-700">warning</span>
                      <span>Atención: Se detectó una diferencia de caja</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Efectivo esperado: <strong className="font-mono">S/ {expectedCash.toFixed(2)}</strong>
                      <br />
                      Efectivo contado: <strong className="font-mono">S/ {countedNum?.toFixed(2)}</strong>
                      <br />
                      Diferencia resultante:{' '}
                      <strong
                        className={`font-mono ${
                          (difference || 0) < 0
                            ? 'text-rose-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {(difference || 0) > 0 ? '+' : ''}S/ {difference?.toFixed(2)}
                      </strong>{' '}
                      ({(difference || 0) > 0 ? 'Sobrante' : 'Faltante'}).
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Esta diferencia quedará registrada en el acta de cierre para auditoría.
                      ¿Deseas confirmar el cierre definitivo del turno?
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirm(false)}
                      disabled={submitting}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    >
                      Volver a contar
                    </button>
                    <button
                      type="button"
                      onClick={executeClose}
                      disabled={submitting}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs shadow-rose-600/30 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                          <span>Cerrando Turno...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">check</span>
                          <span>Confirmar Cierre Definitivo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
