import React, { useState, useEffect } from 'react';
import { Department } from '../types';

interface DepartmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description?: string }) => Promise<void>;
  initialDepartment?: Department | null;
  onDeactivateDepartment?: (dept: Department) => Promise<void>;
  onReactivateDepartment?: (dept: Department) => Promise<void>;
  onDeleteDepartment?: (dept: Department) => Promise<void>;
  zIndexClass?: string;
}

export const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDepartment,
  onDeactivateDepartment,
  onReactivateDepartment,
  onDeleteDepartment,
  zIndexClass = 'z-50',
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDepartment) {
      setName(initialDepartment.name);
      setDescription(initialDepartment.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setError(null);
  }, [initialDepartment, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del departamento es obligatorio');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave({ name: name.trim(), description: description.trim() || undefined });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar departamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm ${zIndexClass}`}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <span className="material-symbols-outlined text-[22px]">category</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                {initialDepartment ? 'Editar Departamento' : 'Nuevo Departamento'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Categorías del catálogo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Bebidas y Refrescos"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Descripción Opcional
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas o descripción del departamento..."
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            {/* Left Action: Desactivar / Reactivar Departamento */}
            <div className="flex items-center gap-2 shrink-0">
              {initialDepartment && (
                initialDepartment.active ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      if (onDeactivateDepartment) {
                        try {
                          setLoading(true);
                          await onDeactivateDepartment(initialDepartment);
                          onClose();
                        } catch (err: any) {
                          setError(err.message || 'Error al desactivar el departamento');
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Desactivar este departamento"
                  >
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    <span>Desactivar Departamento</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      if (onReactivateDepartment) {
                        try {
                          setLoading(true);
                          await onReactivateDepartment(initialDepartment);
                          onClose();
                        } catch (err: any) {
                          setError(err.message || 'Error al reactivar el departamento');
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Reactivar este departamento"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Reactivar Departamento</span>
                  </button>
                )
              )}
              {initialDepartment && (initialDepartment._count?.products || 0) === 0 && onDeleteDepartment && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    if (window.confirm('¿Estás seguro de eliminar este departamento vacío? Esta acción no se puede deshacer.')) {
                      try {
                        setLoading(true);
                        await onDeleteDepartment(initialDepartment);
                        onClose();
                      } catch (err: any) {
                        setError(err.message || 'Error al eliminar el departamento');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
                  title="Eliminar departamento vacío"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>

            {/* Right Actions: Cancelar and Actualizar / Crear */}
            <div className="flex items-center gap-2 shrink-0">
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
                <span>{loading ? 'Guardando...' : initialDepartment ? 'Actualizar' : 'Crear'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
