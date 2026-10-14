import React, { useState, useRef } from 'react';
import { Sale, User } from '../../types';
import { formatCurrency } from '../../utils/loanCalculations';
import { api } from '../../services/api';
import { canAnnulSale } from '../../utils/permissions';
import { ReceiptModal } from '../cash/ReceiptModal';

interface SaleDetailModalProps {
  sale: Sale;
  onClose: () => void;
  currentUser: User | null;
  onSaleAnnulled?: (updatedSale: Sale) => void;
}

export const SaleDetailModal: React.FC<SaleDetailModalProps> = ({
  sale,
  onClose,
  currentUser,
  onSaleAnnulled,
}) => {
  const [isAnnulling, setIsAnnulling] = useState(false);
  const [showAnnulConfirm, setShowAnnulConfirm] = useState(false);
  const [annulReason, setAnnulReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  const annulMutex = useRef(false);

  const handleConfirmAnnul = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annulReason.trim()) {
      setError('Debe especificar un motivo válido de anulación');
      return;
    }

    if (annulMutex.current) return;
    annulMutex.current = true;
    setIsAnnulling(true);
    setError(null);

    try {
      const updated = await api.annulSale(sale.id, annulReason.trim());
      if (onSaleAnnulled) {
        onSaleAnnulled(updated);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al anular la venta');
    } finally {
      setIsAnnulling(false);
      annulMutex.current = false;
    }
  };

  const isCompleted = sale.status === 'COMPLETED';
  const isAnnulled = sale.status === 'ANULLED';
  const userCanAnnul = canAnnulSale(currentUser);

  const formatMethodLabel = (m: string) => {
    switch (m) {
      case 'CASH':
        return 'Efectivo';
      case 'YAPE':
        return 'Yape';
      case 'PLIN':
        return 'Plin';
      case 'CARD':
        return 'Tarjeta';
      case 'TRANSFER':
        return 'Transferencia';
      case 'CREDIT':
        return 'Crédito';
      default:
        return m;
    }
  };

  const getMethodBadgeColor = (m: string) => {
    switch (m) {
      case 'CASH':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'YAPE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PLIN':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'CARD':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'TRANSFER':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'CREDIT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isAnnulled ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">receipt_long</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 font-mono">
                  {sale.saleNumber}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isAnnulled
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {isAnnulled ? 'Anulada' : 'Completada'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {new Date(sale.createdAt).toLocaleString('es-PE', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Anulled Banner if applicable */}
          {isAnnulled && (
            <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs">
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                <span>Venta Anulada</span>
              </div>
              <p className="text-xs text-rose-700">
                <span className="font-semibold">Motivo:</span> {sale.annulReason || 'Sin motivo especificado'}
              </p>
              <p className="text-[11px] text-rose-600">
                Anulado por {sale.annulledBy || 'Usuario'} el{' '}
                {sale.annulledAt ? new Date(sale.annulledAt).toLocaleString('es-PE') : 'Fecha no registrada'}
              </p>
            </div>
          )}

          {/* Meta Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Tienda</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-500">store</span>
                {sale.storeName || 'Tienda Principal'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Cliente</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-500">person</span>
                {sale.clientName || 'Consumidor Final'}
                {sale.clientNumber && (
                  <span className="text-slate-400 font-normal">({sale.clientNumber})</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Atendido por</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-500">badge</span>
                {sale.createdBy || 'Cajero'}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Productos Vendidos ({sale.items?.length || 0})
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2.5">Producto</th>
                    <th className="px-3 py-2.5 text-center">Código</th>
                    <th className="px-3 py-2.5 text-right">Precio Unit.</th>
                    <th className="px-3 py-2.5 text-center">Cantidad</th>
                    <th className="px-3 py-2.5 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.items?.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        {item.productName || (item as any).product?.name || 'Producto'}
                        {item.productType === 'KIT' && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded">
                            Kit / Combo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-500">
                        {item.productCode || (item as any).product?.sku || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                        {formatCurrency(item.unitPrice ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-semibold text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.lineTotal ?? ((item.quantity ?? 1) * (item.unitPrice ?? 0)) ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments and Totals Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Payments List */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Métodos de Pago
              </h5>
              <div className="space-y-1.5">
                {sale.payments?.map((pay, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getMethodBadgeColor(
                          pay.method,
                        )}`}
                      >
                        {formatMethodLabel(pay.method)}
                      </span>
                      {pay.reference && (
                        <span className="text-[11px] text-slate-500 font-mono">
                          Ref: {pay.reference}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrency(pay.amount)}
                    </span>
                  </div>
                ))}

                {sale.cardSurcharge !== undefined && sale.cardSurcharge !== null && sale.cardSurcharge > 0 && (
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none text-blue-700 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200">
                        Recargo tarjeta 5%
                      </span>
                    </div>
                    <span className="font-mono font-bold text-blue-900">
                      +{formatCurrency(sale.cardSurcharge)}
                    </span>
                  </div>
                )}
              </div>

              {sale.cashReceived !== null && sale.cashReceived !== undefined && sale.cashReceived > 0 && (
                <div className="pt-2 border-t border-slate-200 text-xs space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Efectivo Recibido:</span>
                    <span className="font-mono">{formatCurrency(sale.cashReceived)}</span>
                  </div>
                  {sale.cashChange !== null && sale.cashChange !== undefined && sale.cashChange > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Vuelto / Cambio:</span>
                      <span className="font-mono font-bold">{formatCurrency(sale.cashChange)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total Box */}
            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-col justify-between">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal productos:</span>
                  <span className="font-mono">{formatCurrency(sale.subtotal)}</span>
                </div>
                {sale.cardSurcharge !== undefined && sale.cardSurcharge !== null && sale.cardSurcharge > 0 && (
                  <div className="flex justify-between text-blue-700 font-medium">
                    <span>Recargo tarjeta 5%:</span>
                    <span className="font-mono font-bold">+{formatCurrency(sale.cardSurcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Descuentos / Impuestos:</span>
                  <span className="font-mono">S/ 0.00</span>
                </div>
              </div>

              <div className="pt-3 border-t border-indigo-200/80 flex items-baseline justify-between mt-2">
                <span className="text-sm font-bold text-slate-800">Total cobrado:</span>
                <span className="text-2xl font-black font-mono text-indigo-700">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes / Observaciones if present */}
          {sale.notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                Observaciones:
              </span>
              <p className="text-slate-600 italic">{sale.notes}</p>
            </div>
          )}

          {/* Annulment Section if permitted and not yet annulled */}
          {isCompleted && userCanAnnul && !showAnnulConfirm && (
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAnnulConfirm(true)}
                className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-medium rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                Anular Venta
              </button>
            </div>
          )}

          {/* Annulment Confirmation Form */}
          {showAnnulConfirm && (
            <form
              onSubmit={handleConfirmAnnul}
              className="p-4 bg-rose-50/90 border border-rose-300 rounded-xl space-y-3"
            >
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Confirmar Anulación de Venta</span>
              </div>
              <p className="text-xs text-rose-700">
                Esta acción restaurará automáticamente el inventario de los productos (o componentes de kits) y
                revertirá la deuda corriente en caso de pago a crédito. Esta acción no se puede deshacer.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo de la anulación <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Error de digitación, cliente canceló compra..."
                  value={annulReason}
                  onChange={(e) => setAnnulReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-rose-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAnnulConfirm(false)}
                  disabled={isAnnulling}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAnnulling || !annulReason.trim()}
                  className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isAnnulling ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Anulando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Confirmar Anulación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowReceiptModal(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Ver / Reimprimir Boleta</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {showReceiptModal && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          saleId={sale.id}
        />
      )}
    </div>
  );
};
