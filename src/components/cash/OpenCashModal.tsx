import React, { useState, useEffect } from 'react';
import { Location, CashRegister, User } from '../../types';
import { api } from '../../services/api';

interface OpenCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: User | null;
  stores: Location[];
  initialStoreId?: string;
  onConfigureRegisters?: (storeId: string) => void;
}

export const OpenCashModal: React.FC<OpenCashModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  stores,
  initialStoreId,
  onConfigureRegisters,
}) => {
  const [storeId, setStoreId] = useState<string>(initialStoreId || '');
  const [cashRegisterId, setCashRegisterId] = useState<string>('');
  const [openingCashAmount, setOpeningCashAmount] = useState<string>('0.00');
  const [notes, setNotes] = useState<string>('');
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loadingRegisters, setLoadingRegisters] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStoreId) {
      setStoreId(initialStoreId);
    } else if (stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [initialStoreId, stores]);

  useEffect(() => {
    if (isOpen && storeId) {
      loadRegisters(storeId);
    }
  }, [isOpen, storeId]);

  const loadRegisters = async (sId: string) => {
    setLoadingRegisters(true);
    setError(null);
    try {
      const data = await api.getCashRegisters(sId);
      // Only active registers without an already open session
      const available = data.filter((r) => r.status === 'ACTIVE');
      setRegisters(available);
      if (available.length > 0) {
        setCashRegisterId(available[0].id);
      } else {
        setCashRegisterId('');
      }
    } catch (err: any) {
      setError('Error al cargar las cajas de la tienda');
    } finally {
      setLoadingRegisters(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const amount = parseFloat(openingCashAmount);
    if (isNaN(amount) || amount < 0) {
      setError('El monto del fondo inicial no puede ser negativo');
      return;
    }

    if (!storeId) {
      setError('Debes seleccionar una tienda');
      return;
    }

    if (!cashRegisterId) {
      setError('Debes seleccionar una caja activa');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.openCashSession({
        storeId,
        cashRegisterId,
        openingCashAmount: amount,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al abrir el turno de caja');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
              <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                Apertura de Turno de Caja
              </h3>
              <p className="text-xs text-slate-500">
                Inicia operaciones indicando la tienda, caja y fondo inicial.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Current User Info */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">account_circle</span>
              <span className="text-slate-600">Cajero asignado:</span>
            </div>
            <span className="font-bold text-slate-900">
              {currentUser?.name || currentUser?.email || 'Usuario'}
            </span>
          </div>

          {/* Store Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tienda / Ubicación
            </label>
            <select
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                loadRegisters(e.target.value);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              required
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code || 'S/C'})
                </option>
              ))}
            </select>
          </div>

          {/* Cash Register Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Caja a Operar
              </label>
              <button
                type="button"
                onClick={() => storeId && loadRegisters(storeId)}
                disabled={loadingRegisters}
                className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
                title="Actualizar lista de cajas"
              >
                <span className={`material-symbols-outlined text-[14px] ${loadingRegisters ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>Refrescar</span>
              </button>
            </div>
            {loadingRegisters ? (
              <p className="text-xs text-slate-500 py-2">Cargando cajas disponibles...</p>
            ) : registers.length === 0 ? (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200 space-y-2">
                <p>No hay cajas activas configuradas para esta tienda.</p>
                {currentUser?.role === 'Administrador' && onConfigureRegisters && (
                  <div>
                    <button
                      type="button"
                      onClick={() => onConfigureRegisters(storeId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">settings</span>
                      <span>Configurar cajas</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <select
                value={cashRegisterId}
                onChange={(e) => setCashRegisterId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              >
                {registers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Opening Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Fondo Inicial en Efectivo (S/)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">S/</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={openingCashAmount}
                onChange={(e) => setOpeningCashAmount(e.target.value)}
                placeholder="200.00"
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Monto con el que inicia la gaveta (sencillo / cambio base).
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observaciones (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Billetes de 20 y monedas variadas"
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            />
          </div>

          {/* Action Buttons */}
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
              disabled={submitting || registers.length === 0}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs shadow-indigo-600/30 flex items-center gap-1.5 transition cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  <span>Abriendo Caja...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  <span>Abrir Turno</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
