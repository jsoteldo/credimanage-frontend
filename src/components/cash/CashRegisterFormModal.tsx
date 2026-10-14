import React, { useState, useEffect } from 'react';
import { CashRegister, CashRegisterStatus, Location } from '../../types';

interface CashRegisterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Location;
  register?: CashRegister | null;
  onSave: (data: { code: string; name: string; status: CashRegisterStatus }) => Promise<void>;
  zIndexClass?: string;
}

export const CashRegisterFormModal: React.FC<CashRegisterFormModalProps> = ({
  isOpen,
  onClose,
  store,
  register,
  onSave,
  zIndexClass = 'z-[60]',
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<CashRegisterStatus>('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (register) {
      setCode(register.code || '');
      setName(register.name || '');
      setStatus(register.status || 'ACTIVE');
    } else {
      setCode('');
      setName('');
      setStatus('ACTIVE');
    }
    setError(null);
  }, [register, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      setError('El código de la caja es obligatorio.');
      return;
    }
    if (!cleanName) {
      setError('El nombre de la caja es obligatorio.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave({
        code: cleanCode,
        name: cleanName,
        status,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la caja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs ${zIndexClass}`}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                {register ? 'Editar Caja' : 'Nueva Caja'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Punto de venta y arqueo para tienda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Store (preselected and non-editable) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tienda Asignada
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                store
              </span>
              <input
                type="text"
                disabled
                value={`${store.name}${store.code ? ` (${store.code})` : ''}`}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              La caja se asocia exclusivamente a esta tienda y no puede transferirse arbitrariamente.
            </p>
          </div>

          {/* Code */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Código de Caja <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. CAJA-01"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre de la Caja <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Caja Principal, Caja Mostrador 2"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Estado de la Caja
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('ACTIVE')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  status === 'ACTIVE'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Activa</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('INACTIVE')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  status === 'INACTIVE'
                    ? 'bg-rose-50 border-rose-500 text-rose-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">block</span>
                <span>Inactiva</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Las cajas inactivas no están disponibles para apertura de turnos pero conservan su historial.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">
                {loading ? 'hourglass_top' : 'save'}
              </span>
              <span>{loading ? 'Guardando...' : register ? 'Guardar Cambios' : 'Crear Caja'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
