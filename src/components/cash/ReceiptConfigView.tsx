import React, { useState, useEffect } from 'react';
import { User, ReceiptConfig } from '../../types';
import { api } from '../../services/api';
import { PageHeader } from '../PageHeader';

interface ReceiptConfigViewProps {
  currentUser: User | null;
}

const DEFAULT_CONFIG: ReceiptConfig = {
  businessName: 'CrediManage',
  secondaryText: 'Comercial & Servicios',
  address: 'Av. Principal 123, Tienda Centro',
  phone: '999-999-999',
  footerMessage: '¡Gracias por su compra! Vuelva pronto.',
  paperWidth: '80mm',
  showLogo: true,
  showProductCode: false,
  showCustomer: true,
  showCashier: true,
  showStore: true,
  showPaymentMethods: true,
  series: 'B001',
};

export const ReceiptConfigView: React.FC<ReceiptConfigViewProps> = ({ currentUser }) => {
  const [config, setConfig] = useState<ReceiptConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'Administrador';

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReceiptConfig();
      setConfig({
        ...DEFAULT_CONFIG,
        ...data,
      });
    } catch (err: any) {
      setError('Error al cargar la configuración de la boleta. Usando valores predeterminados.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin || saving) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await api.updateReceiptConfig(config);
      setConfig(updated);
      setSuccessMessage('Configuración de boleta actualizada correctamente.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof ReceiptConfig>(field: K, value: ReceiptConfig[K]) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        icon="receipt_long"
        iconBgClass="bg-indigo-600"
        title="Configuración de Boleta Simple"
        subtitle="Personaliza los datos impresos, ancho térmico y visualización de la boleta interna."
        actions={
          isAdmin ? (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 transition cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 flex items-center space-x-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center space-x-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{successMessage}</span>
        </div>
      )}

      {!isAdmin && (
        <div className="p-4 bg-slate-100 text-slate-700 rounded-xl text-xs flex items-center space-x-2 border border-slate-200">
          <span className="material-symbols-outlined text-amber-600 text-base">lock</span>
          <span>Solo los administradores pueden modificar los datos del comprobante.</span>
        </div>
      )}

      {/* Main Grid: Form Left, Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form controls */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-indigo-600 text-lg">edit_note</span>
            <span>Datos del Negocio en la Boleta</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Nombre Comercial del Negocio
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.businessName || ''}
                onChange={(e) => updateField('businessName', e.target.value)}
                placeholder="Ej. CREDIMANAGE RETAIL"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Texto Secundario / Razón / Giro
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={config.secondaryText || ''}
                onChange={(e) => updateField('secondaryText', e.target.value)}
                placeholder="Ej. Comercializadora & Distribuidora"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Dirección Principal
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={config.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Ej. Av. Central 456"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Teléfono / WhatsApp de Contacto
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={config.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="Ej. +51 987 654 321"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Mensaje de Pie de Página
              </label>
              <textarea
                disabled={!isAdmin}
                value={config.footerMessage || ''}
                onChange={(e) => updateField('footerMessage', e.target.value)}
                placeholder="Ej. ¡Gracias por su compra! Conserve su boleta para reclamos."
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              />
            </div>
          </div>

          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3 pt-2">
            <span className="material-symbols-outlined text-indigo-600 text-lg">settings</span>
            <span>Formato y Elementos Visibles</span>
          </h2>

          <div className="space-y-4">
            {/* Paper Width Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Ancho de Papel Predeterminado
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: '80mm', label: '80 mm (Térmico)', desc: 'Recomendado' },
                  { id: '58mm', label: '58 mm (Angosto)', desc: 'Portátil' },
                  { id: 'a4', label: 'A4 / Carta', desc: 'Oficina' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => updateField('paperWidth', p.id as any)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      config.paperWidth === p.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{p.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Checkbox toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100/60 transition">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.showStore !== false}
                  onChange={(e) => updateField('showStore', e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Mostrar Nombre de Tienda
                </span>
              </label>

              <label className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100/60 transition">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.showCashier !== false}
                  onChange={(e) => updateField('showCashier', e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Mostrar Nombre del Cajero
                </span>
              </label>

              <label className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100/60 transition">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.showCustomer !== false}
                  onChange={(e) => updateField('showCustomer', e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Mostrar Datos del Cliente
                </span>
              </label>

              <label className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100/60 transition">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.showPaymentMethods !== false}
                  onChange={(e) => updateField('showPaymentMethods', e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Desglosar Métodos de Pago
                </span>
              </label>

              <label className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100/60 transition sm:col-span-2">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.showProductCode === true}
                  onChange={(e) => updateField('showProductCode', e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Mostrar SKU / Código de Producto en el Detalle
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview on Right */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="sticky top-6 w-full max-w-sm flex flex-col items-center">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              <span className="material-symbols-outlined text-base text-indigo-600">visibility</span>
              <span>Vista Previa en Tiempo Real ({config.paperWidth || '80mm'})</span>
            </div>

            {/* Simulated Ticket Card */}
            <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-xl border border-slate-200 w-full font-mono text-xs space-y-3">
              {/* Header */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                <h3 className="text-base font-black uppercase tracking-tight">
                  {config.businessName || 'NOMBRE DEL NEGOCIO'}
                </h3>
                {config.secondaryText && (
                  <p className="text-[11px] text-slate-600 font-sans">{config.secondaryText}</p>
                )}
                {config.address && (
                  <p className="text-[10px] text-slate-600 font-sans">{config.address}</p>
                )}
                {config.phone && (
                  <p className="text-[10px] text-slate-600 font-sans">Telf: {config.phone}</p>
                )}

                <div className="pt-2">
                  <span className="inline-block border border-slate-900 px-3 py-0.5 font-bold text-xs uppercase">
                    BOLETA DE VENTA
                  </span>
                  <p className="text-sm font-black pt-1">B001-000042</p>
                </div>
              </div>

              {/* Metadata */}
              <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-600">Fecha:</span>
                  <span>{new Date().toLocaleDateString('es-PE')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Hora:</span>
                  <span>{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {config.showStore !== false && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tienda:</span>
                    <span className="font-semibold">Tienda Centro</span>
                  </div>
                )}

                {config.showCashier !== false && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cajero:</span>
                    <span className="font-semibold">
                      {currentUser?.name || 'Carlos Mendoza'}
                    </span>
                  </div>
                )}

                {config.showCustomer !== false && (
                  <div className="flex justify-between pt-1 border-t border-dotted border-slate-200">
                    <span className="text-slate-600">Cliente:</span>
                    <span className="font-bold">JUAN PÉREZ GARCÍA</span>
                  </div>
                )}
              </div>

              {/* Simulated Items */}
              <div className="py-2 border-b border-dashed border-slate-300">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-900 text-left font-bold">
                      <th className="pb-1">Cant.</th>
                      <th className="pb-1 px-1">Producto</th>
                      <th className="pb-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dotted divide-slate-200">
                    <tr>
                      <td className="pt-1 align-top font-bold">2</td>
                      <td className="pt-1 px-1 align-top font-sans">
                        {config.showProductCode && (
                          <span className="text-[9px] text-slate-500 block">[PROD-01]</span>
                        )}
                        Camisa Oxford Azul
                      </td>
                      <td className="pt-1 align-top text-right font-bold">90.00</td>
                    </tr>
                    <tr>
                      <td className="pt-1 align-top font-bold">1</td>
                      <td className="pt-1 px-1 align-top font-sans">
                        {config.showProductCode && (
                          <span className="text-[9px] text-slate-500 block">[PROD-02]</span>
                        )}
                        Pantalón Drill Clásico
                      </td>
                      <td className="pt-1 align-top text-right font-bold">75.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="py-2 border-b border-dashed border-slate-300 flex justify-between items-center text-sm font-bold">
                <span>TOTAL A PAGAR:</span>
                <span className="text-base font-black">S/ 165.00</span>
              </div>

              {/* Payments */}
              {config.showPaymentMethods !== false && (
                <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                  <p className="font-bold text-[10px] text-slate-500 uppercase">Forma de Pago:</p>
                  <div className="flex justify-between">
                    <span>Efectivo:</span>
                    <span className="font-semibold">S/ 100.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Yape:</span>
                    <span className="font-semibold">S/ 65.00</span>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 text-center space-y-1 font-sans">
                {config.footerMessage && (
                  <p className="text-xs font-bold text-slate-800">{config.footerMessage}</p>
                )}
                <p className="text-[9px] text-slate-400">
                  Comprobante Interno · No válido como factura fiscal
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
