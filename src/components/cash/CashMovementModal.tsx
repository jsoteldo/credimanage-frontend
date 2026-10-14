import React, { useState } from 'react';
import { CashSession, CashSessionSummary, User } from '../../types';
import { api } from '../../services/api';
import { canCashIn, canCashOut } from '../../utils/permissions';

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  session: CashSession | null;
  summary: CashSessionSummary | null;
  defaultType?: 'CASH_IN' | 'CASH_OUT';
  currentUser?: User | null;
}

export const CashMovementModal: React.FC<CashMovementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  session,
  summary,
  defaultType = 'CASH_IN',
  currentUser,
}) => {
  const allowCashIn = currentUser !== undefined ? canCashIn(currentUser) : true;
  const allowCashOut = currentUser !== undefined ? canCashOut(currentUser) : true;

  // Pick initial type respecting permissions
  const initialType: 'CASH_IN' | 'CASH_OUT' =
    defaultType === 'CASH_OUT'
      ? allowCashOut
        ? 'CASH_OUT'
        : allowCashIn
        ? 'CASH_IN'
        : 'CASH_OUT'
      : allowCashIn
      ? 'CASH_IN'
      : allowCashOut
      ? 'CASH_OUT'
      : 'CASH_IN';

  const [type, setType] = useState<'CASH_IN' | 'CASH_OUT'>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warningConfirmed, setWarningConfirmed] = useState<boolean>(false);

  // Sync defaultType when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (defaultType === 'CASH_OUT') {
        setType(allowCashOut ? 'CASH_OUT' : allowCashIn ? 'CASH_IN' : 'CASH_OUT');
      } else {
        setType(allowCashIn ? 'CASH_IN' : allowCashOut ? 'CASH_OUT' : 'CASH_IN');
      }
      setAmount('');
      setReason('');
      setNotes('');
      setError(null);
      setWarningConfirmed(false);
    }
  }, [isOpen, defaultType, allowCashIn, allowCashOut]);

  if (!isOpen || !session) return null;

  const currentCash = summary ? summary.expectedCashAmount : 0;
  const numAmount = parseFloat(amount);
  const willBeNegative =
    type === 'CASH_OUT' && !isNaN(numAmount) && numAmount > 0 && currentCash - numAmount < 0;
  const resultingCash = !isNaN(numAmount)
    ? type === 'CASH_IN'
      ? currentCash + numAmount
      : currentCash - numAmount
    : currentCash;

  const isOperationAllowed = type === 'CASH_IN' ? allowCashIn : allowCashOut;
  const permissionDeniedMessage =
    type === 'CASH_IN'
      ? 'No tienes permiso para registrar ingresos manuales de caja.'
      : 'No tienes permiso para registrar retiros de caja.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!isOperationAllowed) {
      setError(permissionDeniedMessage);
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Debes ingresar un monto mayor a cero');
      return;
    }

    if (!reason.trim()) {
      setError('Debes indicar el motivo del movimiento');
      return;
    }

    // If it will leave the cash drawer negative and hasn't been confirmed yet
    if (willBeNegative && !warningConfirmed) {
      setError(
        `Atención: Este retiro de S/ ${numAmount.toFixed(
          2,
        )} dejará la caja con un saldo negativo de S/ ${resultingCash.toFixed(
          2,
        )}. Marca la casilla de confirmación para proceder.`,
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.addCashMovement(session.id, {
        type,
        amount: numAmount,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      let msg = err.message || 'Error al registrar el movimiento de caja';
      if (err.status === 401 || err.statusCode === 401 || msg === 'Unauthorized') {
        msg = 'Sesión expirada o no autenticado. Por favor inicie sesión nuevamente.';
      } else if (
        err.status === 403 ||
        err.statusCode === 403 ||
        msg === 'Forbidden' ||
        msg.toLowerCase().includes('forbidden') ||
        msg.toLowerCase().includes('permiso')
      ) {
        msg =
          type === 'CASH_OUT'
            ? 'No tienes permiso para registrar retiros de caja.'
            : 'No tienes permiso para registrar ingresos manuales de caja.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs ${
                type === 'CASH_IN' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">
                {type === 'CASH_IN' ? 'move_to_inbox' : 'outbox'}
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {type === 'CASH_IN' ? 'Ingreso de Efectivo' : 'Retiro / Egreso de Efectivo'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {session.store?.name} · {session.cashRegister?.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Movement Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              disabled={!allowCashIn}
              title={!allowCashIn ? 'No tienes permiso para registrar ingresos manuales de caja.' : undefined}
              onClick={() => {
                if (!allowCashIn) return;
                setType('CASH_IN');
                setError(null);
                setWarningConfirmed(false);
              }}
              className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition ${
                type === 'CASH_IN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              } ${
                !allowCashIn
                  ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-400'
                  : 'cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>Ingreso</span>
            </button>
            <button
              type="button"
              disabled={!allowCashOut}
              title={!allowCashOut ? 'No tienes permiso para registrar retiros de caja.' : undefined}
              onClick={() => {
                if (!allowCashOut) return;
                setType('CASH_OUT');
                setError(null);
                setWarningConfirmed(false);
              }}
              className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition ${
                type === 'CASH_OUT'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              } ${
                !allowCashOut
                  ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-400'
                  : 'cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-base">remove_circle</span>
              <span>Retiro</span>
            </button>
          </div>

          {!isOperationAllowed && (
            <div className="p-3 bg-amber-50 text-amber-800 text-xs font-semibold rounded-xl flex items-start space-x-2 border border-amber-200">
              <span className="material-symbols-outlined text-base mt-0.5 text-amber-600">lock</span>
              <span className="flex-1">{permissionDeniedMessage}</span>
            </div>
          )}

          {/* Current Balance Indicator */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Efectivo actual en gaveta:</span>
            <span className="font-extrabold text-slate-900 text-sm">
              S/ {currentCash.toFixed(2)}
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-start space-x-2 border border-rose-200">
              <span className="material-symbols-outlined text-base mt-0.5 text-rose-500">error</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Monto en Efectivo (S/) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                S/
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="0.00"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-lg font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                required
                autoFocus
              />
            </div>
            {!isNaN(numAmount) && numAmount > 0 && (
              <p className="text-xs text-slate-500 mt-1.5 font-medium">
                Efectivo resultante tras movimiento:{' '}
                <strong
                  className={
                    resultingCash < 0 ? 'text-rose-600 font-black' : 'text-slate-900 font-bold'
                  }
                >
                  S/ {resultingCash.toFixed(2)}
                </strong>
              </p>
            )}
          </div>

          {/* Negative Cash Warning Confirmation Checkbox */}
          {willBeNegative && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                <span className="material-symbols-outlined text-base">warning</span>
                <span>Advertencia de saldo negativo</span>
              </div>
              <p className="text-amber-800/90 leading-relaxed">
                Este retiro dejará la gaveta física con un saldo negativo de{' '}
                <strong className="text-amber-950">S/ {resultingCash.toFixed(2)}</strong>.
              </p>
              <label className="flex items-center space-x-2 font-semibold cursor-pointer pt-1 text-amber-900">
                <input
                  type="checkbox"
                  checked={warningConfirmed}
                  onChange={(e) => setWarningConfirmed(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>Confirmo y autorizo este egreso a pesar del saldo negativo</span>
              </label>
            </div>
          )}

          {/* Reason / Motivo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Motivo del {type === 'CASH_IN' ? 'Ingreso' : 'Retiro'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                type === 'CASH_IN'
                  ? 'Ej. Fondo adicional de caja, reposición de sencillo...'
                  : 'Ej. Compra de suministros, pago de delivery, retiro menor...'
              }
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Detalle / Observaciones adicionales (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Número de comprobante de compra o comentarios..."
              rows={2}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !isOperationAllowed || (willBeNegative && !warningConfirmed)}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs flex items-center space-x-1.5 transition ${
                !isOperationAllowed ? 'opacity-40 cursor-not-allowed bg-slate-400' : 'cursor-pointer'
              } ${
                type === 'CASH_IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">
                    {type === 'CASH_IN' ? 'add' : 'remove'}
                  </span>
                  <span>{type === 'CASH_IN' ? 'Registrar Ingreso' : 'Registrar Retiro'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
