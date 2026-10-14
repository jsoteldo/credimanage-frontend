import React, { useState, useEffect } from 'react';
import { Receipt, Sale } from '../../types';
import { api } from '../../services/api';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId?: string | null;
  receipt?: Receipt | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  saleId,
  receipt: initialReceipt,
}) => {
  const [receipt, setReceipt] = useState<Receipt | null>(initialReceipt || null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm' | 'a4'>('80mm');
  const [reprinting, setReprinting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (initialReceipt) {
        setReceipt(initialReceipt);
        if (initialReceipt.sale) {
          setSale(initialReceipt.sale);
        } else if (initialReceipt.saleId) {
          loadSaleData(initialReceipt.saleId);
        }
        if (initialReceipt.configSnapshot?.paperWidth) {
          setPaperWidth(initialReceipt.configSnapshot.paperWidth);
        }
      } else if (saleId) {
        loadReceiptAndSale(saleId);
      }
    }
  }, [isOpen, saleId, initialReceipt]);

  const loadSaleData = async (sId: string) => {
    try {
      const s = await api.getSaleById(sId);
      setSale(s);
    } catch {
      // silently fail
    }
  };

  const loadReceiptAndSale = async (sId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [rData, sData] = await Promise.all([
        api.getSaleReceipt(sId),
        api.getSaleById(sId),
      ]);
      setReceipt(rData);
      setSale(sData);
      if (rData.configSnapshot?.paperWidth) {
        setPaperWidth(rData.configSnapshot.paperWidth);
      }
    } catch (err: any) {
      setError('No se pudo cargar el comprobante de venta');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!receipt || !sale) return;

    // Call reprint API to record audit log and increment counter
    if (sale.id) {
      setReprinting(true);
      try {
        const updated = await api.reprintSaleReceipt(sale.id);
        setReceipt(updated);
      } catch {
        // Continue with printing even if reprint audit fails
      } finally {
        setReprinting(false);
      }
    }

    window.print();
  };

  if (!isOpen) return null;

  const cfg = receipt?.configSnapshot || {
    businessName: 'CrediManage',
    secondaryText: 'Comercial & Servicios',
    address: 'Av. Principal 123',
    phone: '999-999-999',
    footerMessage: '¡Gracias por su compra!',
    showLogo: true,
    showProductCode: false,
    showCustomer: true,
    showCashier: true,
    showStore: true,
    showPaymentMethods: true,
  };

  const isAnulled = sale?.status === 'ANULLED';

  const containerWidthClass =
    paperWidth === '58mm'
      ? 'w-[280px]'
      : paperWidth === '80mm'
      ? 'w-[360px]'
      : 'w-[520px]';

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Print styles */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-receipt, #printable-receipt * {
              visibility: visible;
            }
            #printable-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: ${paperWidth === '58mm' ? '58mm' : paperWidth === '80mm' ? '80mm' : '100%'};
              margin: 0;
              padding: 4mm;
              background: white !important;
              color: black !important;
              box-shadow: none !important;
              border: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar (Screen only) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between no-print shrink-0">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-indigo-400">receipt</span>
            <span className="font-bold text-sm">Boleta Simple de Venta</span>
            {receipt && (
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-md font-mono font-bold">
                {receipt.number}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Format selector */}
            <div className="flex items-center bg-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  paperWidth === '58mm' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  paperWidth === '80mm' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                80 mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('a4')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  paperWidth === 'a4' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                A4
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center bg-slate-100">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold mb-4 border border-rose-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center space-y-2 text-slate-500">
              <span className="material-symbols-outlined animate-spin text-3xl text-indigo-600">
                progress_activity
              </span>
              <p className="text-xs font-medium">Generando comprobante...</p>
            </div>
          ) : receipt && sale ? (
            /* Printable Receipt Ticket */
            <div
              id="printable-receipt"
              className={`bg-white text-slate-900 p-6 rounded-2xl shadow-xl border border-slate-200 transition-all font-mono text-xs ${containerWidthClass}`}
            >
              {/* Anulled Banner */}
              {isAnulled && (
                <div className="border-4 border-rose-600 text-rose-600 font-black text-center py-2 px-1 mb-4 rounded-xl transform rotate-[-2deg] tracking-widest text-base">
                  *** VENTA ANULADA ***
                </div>
              )}

              {/* Header */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                <h2 className="text-base font-black tracking-tight uppercase">
                  {cfg.businessName || 'CREDIMANAGE'}
                </h2>
                {cfg.secondaryText && (
                  <p className="text-[11px] text-slate-600 font-sans">{cfg.secondaryText}</p>
                )}
                {cfg.address && (
                  <p className="text-[10px] text-slate-600 font-sans">{cfg.address}</p>
                )}
                {cfg.phone && (
                  <p className="text-[10px] text-slate-600 font-sans">Telf: {cfg.phone}</p>
                )}

                <div className="pt-2">
                  <span className="inline-block border border-slate-900 px-3 py-1 font-bold text-xs uppercase tracking-wider">
                    BOLETA DE VENTA
                  </span>
                  <p className="text-sm font-black pt-1">{receipt.number}</p>
                </div>
              </div>

              {/* Metadata */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-600">Fecha:</span>
                  <span className="font-semibold">
                    {new Date(sale.createdAt).toLocaleDateString('es-PE')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Hora:</span>
                  <span className="font-semibold">
                    {new Date(sale.createdAt).toLocaleTimeString('es-PE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {cfg.showStore !== false && sale.storeName && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tienda:</span>
                    <span className="font-semibold truncate max-w-[180px]">
                      {sale.storeName}
                    </span>
                  </div>
                )}

                {cfg.showCashier !== false && sale.createdBy && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cajero:</span>
                    <span className="font-semibold truncate max-w-[180px]">
                      {sale.createdBy}
                    </span>
                  </div>
                )}

                {cfg.showCustomer !== false && (
                  <div className="flex justify-between pt-1 border-t border-dotted border-slate-200">
                    <span className="text-slate-600">Cliente:</span>
                    <span className="font-bold text-right truncate max-w-[180px]">
                      {sale.clientName || sale.client?.name || 'CONSUMIDOR FINAL'}
                    </span>
                  </div>
                )}

                {receipt.reprintedCount > 0 && (
                  <div className="text-right text-[10px] text-slate-500 font-sans italic pt-1">
                    {`[Copia #${receipt.reprintedCount}]`}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="py-3 border-b border-dashed border-slate-300">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-900 text-left font-bold">
                      <th className="pb-1">Cant.</th>
                      <th className="pb-1 px-1">Descripción</th>
                      <th className="pb-1 text-right">P.U.</th>
                      <th className="pb-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dotted divide-slate-200">
                    {sale.items?.map((item) => (
                      <tr key={item.id} className="py-1">
                        <td className="align-top font-bold pt-1">{item.quantity}</td>
                        <td className="align-top px-1 pt-1 font-sans">
                          {cfg.showProductCode && item.productCode && (
                            <span className="text-[9px] text-slate-500 block">
                              [{item.productCode}]
                            </span>
                          )}
                          <span>{item.productName || 'Producto'}</span>
                        </td>
                        <td className="align-top text-right pt-1 whitespace-nowrap">
                          {Number(item.unitPrice).toFixed(2)}
                        </td>
                        <td className="align-top text-right font-bold pt-1 whitespace-nowrap">
                          {Number(item.lineTotal || (item.quantity * item.unitPrice)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
                {sale.cardSurcharge !== undefined && sale.cardSurcharge !== null && sale.cardSurcharge > 0 ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal productos:</span>
                      <span className="font-semibold">S/ {Number(sale.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Recargo tarjeta (5%):</span>
                      <span className="font-semibold">S/ {Number(sale.cardSurcharge).toFixed(2)}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between font-bold text-sm pt-1">
                  <span>TOTAL A PAGAR:</span>
                  <span className="text-base font-black">S/ {Number(sale.total).toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Methods */}
              {cfg.showPaymentMethods !== false && sale.payments && (
                <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                  <p className="font-bold text-[10px] text-slate-500 uppercase">
                    Forma de Pago:
                  </p>
                  {sale.payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="capitalize">
                        {p.method === 'CREDIT' ? 'Venta a Crédito' : p.method.toLowerCase()}:
                      </span>
                      <span className="font-semibold">S/ {Number(p.amount).toFixed(2)}</span>
                    </div>
                  ))}

                  {/* Cash Change info if applicable */}
                  {sale.cashReceived && sale.cashReceived > 0 && (
                    <div className="pt-1 border-t border-dotted border-slate-200 text-[10px] text-slate-600">
                      <div className="flex justify-between">
                        <span>Efectivo entregado:</span>
                        <span>S/ {Number(sale.cashReceived).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Vuelto:</span>
                        <span>S/ {Number(sale.cashChange || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Note */}
              <div className="pt-4 text-center space-y-1 font-sans">
                {cfg.footerMessage && (
                  <p className="text-xs font-bold text-slate-800">{cfg.footerMessage}</p>
                )}
                <p className="text-[9px] text-slate-400">
                  Comprobante Interno · No válido como factura fiscal
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Action Bottom Bar (Screen only) */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between no-print shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!receipt || reprinting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs shadow-indigo-600/20 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>{receipt?.reprintedCount ? 'Reimprimir Boleta' : 'Imprimir Boleta'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
