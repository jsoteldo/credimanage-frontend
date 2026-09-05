import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Client, PaymentFrequency } from '../types';
import { formatCurrency } from '../utils/loanCalculations';
import { ClientSelector } from './ClientSelector';

interface AddDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
  clients?: Client[];
  onSubmit: (
    clientId: string,
    debtData: {
      product: string;
      unitPrice: number;
      quantity: number;
      ticketNumber?: string;
      date?: string;
      debtType?: 'simple' | 'credit';
      capital?: number;
      interestRate?: number;
      interestAmount?: number;
      totalAmount?: number;
      installmentsCount?: number;
      installmentAmount?: number;
      frequency?: PaymentFrequency;
      firstDueDate?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onClientCreated?: (newClient: Client) => void;
}

export const AddDebtModal: React.FC<AddDebtModalProps> = ({
  isOpen,
  onClose,
  client = null,
  clients = [],
  onSubmit,
  onClientCreated,
}) => {
  const getTodayString = () => new Date().toISOString().split('T')[0];

  const [selectedClient, setSelectedClient] = useState<Client | null>(client || null);

  // Form fields
  const [product, setProduct] = useState('');
  const [debtDate, setDebtDate] = useState(getTodayString());
  const [unitPrice, setUnitPrice] = useState<number | string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [ticketNumber, setTicketNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevIsOpen = useRef(false);
  const prevClient = useRef(client);
  const isSubmittingRef = useRef(false);

  // Modal open/reset logic: preserves entered debt data if client is created while modal is open
  useEffect(() => {
    if (isOpen) {
      if (!prevIsOpen.current || (client && client !== prevClient.current)) {
        setSelectedClient(client || null);
        setProduct('Compra a crédito en tienda / Cargo de consumo');
        setDebtDate(getTodayString());
        setUnitPrice('');
        setQuantity(1);
        setTicketNumber(`CARGO-${Math.floor(1000 + Math.random() * 9000)}`);
        setNotes('');
        setError(null);
      }
    }
    prevIsOpen.current = isOpen;
    prevClient.current = client;
  }, [isOpen, client]);

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

  if (!isOpen) return null;

  const currentBalance = selectedClient ? selectedClient.currentBalance : 0;
  const numUnitPrice = parseFloat(String(unitPrice)) || 0;
  const numQuantity = Math.max(1, quantity || 1);
  const totalChargeAmount = Math.round(numUnitPrice * numQuantity * 100) / 100;
  const projectedBalance = Math.round((currentBalance + totalChargeAmount) * 100) / 100;
  const creditLimit = selectedClient?.creditLimit || 0;
  const isOverLimit = creditLimit > 0 && projectedBalance > creditLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    setError(null);

    if (!selectedClient) {
      setError('Debe seleccionar un cliente para registrar el cargo de deuda');
      return;
    }

    if (selectedClient.status === 'Desactivado') {
      setError('No se puede cargar deuda a un cliente desactivado');
      return;
    }

    if (!product.trim()) {
      setError('El concepto o descripción del cargo es obligatorio');
      return;
    }

    if (totalChargeAmount <= 0) {
      setError('El importe total del cargo debe ser mayor a S/ 0.00');
      return;
    }

    if (isOverLimit) {
      setError(
        `El cargo supera el límite de crédito disponible del cliente (Límite: S/ ${creditLimit.toFixed(
          2
        )}, Saldo proyectado: S/ ${projectedBalance.toFixed(2)}, Exceso: S/ ${(
          projectedBalance - creditLimit
        ).toFixed(2)}).`
      );
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      await onSubmit(selectedClient.id, {
        product: product.trim(),
        unitPrice: numUnitPrice,
        quantity: numQuantity,
        ticketNumber: ticketNumber.trim() || undefined,
        date: debtDate || getTodayString(),
        debtType: 'simple',
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el cargo de deuda');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl my-6 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
                <span className="material-symbols-outlined text-[22px]">post_add</span>
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Cargar Nueva Deuda a Cliente
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Registro de consumos, compras a crédito o cargos en cuenta corriente.
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
            <div className="mx-6 mt-4 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-medium flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Reusable Client Selector in Debt Mode */}
            <ClientSelector
              selectedClient={selectedClient}
              onSelectClient={(c) => setSelectedClient(c)}
              clients={clients}
              mode="debt"
              label="Cliente Destino *"
              disabled={loading}
              onClientCreated={onClientCreated}
            />

            {/* Concept / Product */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Concepto / Producto de la Deuda o Compra *
              </label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Ej. Consumo del día, Compra de víveres a crédito, Artículos de tienda"
                className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all"
                required
              />
            </div>

            {/* Amount and Quantity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">
                  Importe / Precio Unitario (S/ PEN) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-mono text-xs font-bold">
                    S/
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 pl-8 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-extrabold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all text-right"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Cantidad *
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            {/* Date and Ticket Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Fecha del Cargo *
                </label>
                <input
                  type="date"
                  value={debtDate}
                  onChange={(e) => setDebtDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all cursor-pointer"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Comprobante / Ticket (Opcional)
                </label>
                <input
                  type="text"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="Ej. TKT-9012"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Observaciones (Opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Consumo autorizado por encargado"
                className="w-full h-9 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white transition-all"
              />
            </div>

            {/* Balance Projection Summary */}
            {selectedClient && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Saldo Actual del Cliente:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(currentBalance)}
                  </span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>
                    + Nuevo Cargo a Asignar ({numQuantity} x S/ {numUnitPrice.toFixed(2)}):
                  </span>
                  <span className="font-mono font-extrabold">+S/ {totalChargeAmount.toFixed(2)} PEN</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-slate-900">
                  <span>Nuevo Saldo Resultante:</span>
                  <span className="font-mono text-rose-600 text-sm">
                    {formatCurrency(projectedBalance)}
                  </span>
                </div>

                {creditLimit > 0 && (
                  <div
                    className={`mt-1 pt-1.5 border-t border-slate-200/60 flex justify-between text-[11px] font-semibold ${
                      isOverLimit ? 'text-rose-600' : 'text-slate-500'
                    }`}
                  >
                    <span>Límite de Crédito:</span>
                    <span className="font-mono">
                      {formatCurrency(creditLimit)} {isOverLimit && '⚠️ (Excedido)'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
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
                disabled={loading || !selectedClient || isOverLimit || totalChargeAmount <= 0}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>{loading ? 'Registrando...' : 'Confirmar y Cargar Deuda'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
