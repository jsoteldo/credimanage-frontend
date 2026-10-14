import React, { useState } from 'react';
import { Sale, User } from '../../types';
import { formatCurrency } from '../../utils/loanCalculations';
import { ReceiptModal } from '../cash/ReceiptModal';
import { SaleDetailModal } from './SaleDetailModal';

interface SaleSuccessModalProps {
  sale: Sale;
  onNewSale: () => void;
  onEditSale?: (sale: Sale) => void;
  currentUser?: User | null;
}

export const SaleSuccessModal: React.FC<SaleSuccessModalProps> = ({
  sale,
  onNewSale,
  onEditSale,
  currentUser,
}) => {
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-center p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
          {/* Success Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-[36px]">check_circle</span>
          </div>

          {/* Title & Folio */}
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-900">
              ¡Venta Registrada Correctamente!
            </h3>
            <p className="text-sm font-mono font-bold text-indigo-600">
              N° {sale.saleNumber}
            </p>
          </div>

          {/* Summary Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Tienda:</span>
              <span className="font-semibold text-slate-800">{sale.storeName || 'Tienda Principal'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Cliente:</span>
              <span className="font-semibold text-slate-800">{sale.clientName || 'Consumidor Final'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Productos:</span>
              <span className="font-semibold text-slate-800">
                {sale.items?.reduce((acc, it) => acc + Number(it.quantity), 0) || 0} unidades
              </span>
            </div>

            {/* Subtotal & Surcharge if card surcharge exists (Req 12) */}
            {sale.cardSurcharge !== undefined && sale.cardSurcharge !== null && sale.cardSurcharge > 0 ? (
              <>
                <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-200/60">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">{formatCurrency(sale.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-blue-700 font-semibold">
                  <span>Recargo tarjeta (5%):</span>
                  <span className="font-mono font-bold">+{formatCurrency(sale.cardSurcharge)}</span>
                </div>
              </>
            ) : null}

            {sale.cashReceived !== null && sale.cashReceived !== undefined && sale.cashReceived > 0 && (
              <div className="flex justify-between items-center text-slate-600">
                <span>Efectivo Recibido:</span>
                <span className="font-mono">{formatCurrency(sale.cashReceived)}</span>
              </div>
            )}
            {sale.cashChange !== null && sale.cashChange !== undefined && sale.cashChange > 0 && (
              <div className="flex justify-between items-center text-emerald-700 font-semibold">
                <span>Vuelto / Cambio:</span>
                <span className="font-mono font-bold">{formatCurrency(sale.cashChange)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-700">Total Cobrado:</span>
              <span className="text-xl font-black font-mono text-indigo-700">
                {formatCurrency(sale.total)}
              </span>
            </div>
          </div>

          {/* Warnings Banner if any */}
          {sale.warnings && sale.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-[16px] text-amber-600">warning</span>
                <span>Avisos de inventario:</span>
              </div>
              {sale.warnings.map((w, idx) => (
                <p key={idx} className="text-[11px] text-amber-700">
                  • {w}
                </p>
              ))}
            </div>
          )}

          {/* Actions (Req 5) */}
          <div className="pt-2 space-y-2">
            {/* 1. Ver / Imprimir Boleta Simple */}
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Ver / Imprimir Boleta Simple</span>
            </button>

            {/* 2. Editar Venta */}
            {onEditSale && (
              <button
                type="button"
                onClick={() => onEditSale(sale)}
                className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-[18px] text-amber-700">edit_note</span>
                <span>Editar Venta</span>
              </button>
            )}

            {/* 3. Nueva Venta */}
            <button
              type="button"
              onClick={onNewSale}
              autoFocus
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
              <span>Nueva Venta</span>
            </button>

            {/* 4. Ver Detalle Completo (Overlay sobre confirmación) */}
            <button
              type="button"
              onClick={() => setShowDetailModal(true)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>Ver Detalle Completo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal as Overlay over Success Modal (Req 9, 10, 11) */}
      {showDetailModal && (
        <SaleDetailModal
          sale={sale}
          onClose={() => setShowDetailModal(false)}
          currentUser={currentUser || null}
        />
      )}

      {/* Receipt Modal as Overlay */}
      {showReceiptModal && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          saleId={sale.id}
        />
      )}
    </>
  );
};
