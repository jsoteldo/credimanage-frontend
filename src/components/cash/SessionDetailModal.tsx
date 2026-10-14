import React, { useState, useEffect } from 'react';
import { CashSession, CashMovement } from '../../types';
import { api } from '../../services/api';

interface SessionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  isOpen,
  onClose,
  sessionId,
}) => {
  const [session, setSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadDetails(sessionId);
    }
  }, [isOpen, sessionId]);

  const loadDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const sess = await api.getCashSessionById(id);
      setSession(sess);
      const movs = await api.getCashMovements({ cashSessionId: id, limit: 100 });
      setMovements(movs.items);
    } catch (err: any) {
      setError('Error al cargar el detalle del turno');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !sessionId) return null;

  const formatDate = (iso?: string | Date | null) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleString('es-PE', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });
    } catch {
      return '-';
    }
  };

  const getDifferenceBadge = (diff?: number | string | null) => {
    if (diff === null || diff === undefined || diff === '') return null;
    const num = Number(diff);
    if (isNaN(num)) return null;

    if (Math.abs(num) < 0.005) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Cuadra Exacto (S/ 0.00)
        </span>
      );
    } else if (num > 0) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
          Sobrante (+S/ {num.toFixed(2)})
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
          Faltante (-S/ {Math.abs(num).toFixed(2)})
        </span>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Acta y Detalle de Turno de Caja</h3>
              <p className="text-xs text-slate-500 font-medium">
                {session?.store?.name} · {session?.cashRegister?.name} ({session?.cashRegister?.code})
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

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-500">
              <span className="material-symbols-outlined animate-spin text-3xl text-indigo-600">
                progress_activity
              </span>
              <p className="text-xs font-medium">Cargando información del turno...</p>
            </div>
          ) : session ? (
            <>
              {/* General Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-500 block font-medium">Apertura:</span>
                  <strong className="text-slate-900 block text-sm font-bold">
                    {formatDate(session.openedAt)}
                  </strong>
                  <span className="text-slate-500 text-[11px]">Por: {session.openedByUser?.name || 'Usuario'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Cierre:</span>
                  <strong className="text-slate-900 block text-sm font-bold">
                    {session.closedAt ? formatDate(session.closedAt) : 'Turno aún abierto'}
                  </strong>
                  {session.closedByUser && (
                    <span className="text-slate-500 text-[11px]">Por: {session.closedByUser.name}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Estado:</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold mt-1 ${
                      session.status === 'OPEN'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {session.status === 'OPEN' ? 'ABIERTO' : 'CERRADO'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Fondo Inicial:</span>
                  <strong className="text-slate-900 block text-sm font-bold">
                    S/ {Number(session.openingCashAmount || 0).toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Arqueo Balance Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Balance de Efectivo en Gaveta
                  </h4>
                  {getDifferenceBadge(session.differenceAmount)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500 font-medium block">Efectivo Esperado</span>
                    <span className="text-xl font-black text-slate-900">
                      S/ {Number(session.expectedCashAmount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500 font-medium block">Efectivo Contado</span>
                    <span className="text-xl font-black text-slate-900">
                      {session.countedCashAmount !== null && session.countedCashAmount !== undefined
                        ? `S/ ${Number(session.countedCashAmount).toFixed(2)}`
                        : 'No registrado'}
                    </span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500 font-medium block">Diferencia</span>
                    {(() => {
                      const diffVal =
                        session.differenceAmount !== null && session.differenceAmount !== undefined
                          ? Number(session.differenceAmount)
                          : null;
                      return (
                        <span
                          className={`text-xl font-black ${
                            diffVal !== null && !isNaN(diffVal) && diffVal < 0
                              ? 'text-rose-600'
                              : diffVal !== null && !isNaN(diffVal) && diffVal > 0
                              ? 'text-blue-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {diffVal !== null && !isNaN(diffVal)
                            ? `${diffVal > 0 ? '+' : ''}S/ ${diffVal.toFixed(2)}`
                            : 'S/ 0.00'}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {session.notes && (
                  <div className="text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <span className="font-bold text-slate-700">
                      Observaciones de Cierre:
                    </span>{' '}
                    {session.notes}
                  </div>
                )}
              </div>

              {/* Movements Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Movimientos Registrados ({movements.length})
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/75 text-slate-500 font-bold border-b border-slate-100 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Hora</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Método</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-right">Monto</th>
                        <th className="py-2.5 px-3">Usuario</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {movements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            No hay movimientos en este turno.
                          </td>
                        </tr>
                      ) : (
                        movements.map((m) => {
                          const numAmount = Number(m.amount || 0);
                          const isNegative =
                            numAmount < 0 ||
                            m.type === 'CASH_OUT' ||
                            m.type === 'SALE_REVERSAL';
                          const displayAmount = Math.abs(numAmount);
                          return (
                            <tr
                              key={m.id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                {(() => {
                                  try {
                                    return new Date(m.createdAt).toLocaleTimeString('es-PE', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                  } catch {
                                    return '-';
                                  }
                                })()}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-800">
                                {m.type}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {m.paymentMethod}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium">
                                {m.description || m.notes || '-'}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-black whitespace-nowrap ${
                                  isNegative
                                    ? 'text-rose-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {isNegative ? '-' : '+'}S/ {displayAmount.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                {m.createdByUser?.name || 'Usuario'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition cursor-pointer shadow-2xs"
          >
            Cerrar Detalle
          </button>
        </div>
      </div>
    </div>
  );
};
