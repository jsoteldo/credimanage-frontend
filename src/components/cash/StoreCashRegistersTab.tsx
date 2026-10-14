import React, { useState, useEffect, useCallback } from 'react';
import { CashRegister, CashRegisterStatus, Location, User } from '../../types';
import { api } from '../../services/api';
import { CashRegisterFormModal } from './CashRegisterFormModal';

interface StoreCashRegistersTabProps {
  store: Location;
  currentUser: User | null;
  onRegistersUpdated?: () => void;
}

export const StoreCashRegistersTab: React.FC<StoreCashRegistersTabProps> = ({
  store,
  currentUser,
  onRegistersUpdated,
}) => {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);

  const isAdmin = currentUser?.role === 'Administrador';

  const loadRegisters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCashRegisters(store.id);
      setRegisters(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las cajas de la tienda.');
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => {
    loadRegisters();
  }, [loadRegisters]);

  const handleOpenCreateModal = () => {
    setSelectedRegister(null);
    setIsModalOpen(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleOpenEditModal = (reg: CashRegister) => {
    setSelectedRegister(reg);
    setIsModalOpen(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSaveRegister = async (data: {
    code: string;
    name: string;
    status: CashRegisterStatus;
  }) => {
    if (selectedRegister) {
      // Edit existing register
      // Check if deactivating with open session
      if (data.status === 'INACTIVE' && selectedRegister.activeSession) {
        throw new Error('No puedes desactivar esta caja porque tiene un turno abierto.');
      }

      await api.updateCashRegister(selectedRegister.id, {
        code: data.code,
        name: data.name,
        status: data.status,
      });
      setSuccessMessage(`Caja ${data.name} (${data.code}) actualizada correctamente.`);
    } else {
      // Create new register
      await api.createCashRegister({
        storeId: store.id,
        code: data.code,
        name: data.name,
        status: data.status,
      });
      setSuccessMessage(`Caja ${data.name} (${data.code}) creada correctamente.`);
    }

    await loadRegisters();
    onRegistersUpdated?.();
  };

  const handleToggleStatus = async (reg: CashRegister) => {
    if (!isAdmin) return;
    setError(null);
    setSuccessMessage(null);

    const newStatus: CashRegisterStatus = reg.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    // Business rule: Cannot deactivate register with open session
    if (newStatus === 'INACTIVE' && reg.activeSession) {
      setError('No puedes desactivar esta caja porque tiene un turno abierto.');
      return;
    }

    try {
      await api.updateCashRegister(reg.id, { status: newStatus });
      setSuccessMessage(
        `Caja ${reg.name} (${reg.code}) ${newStatus === 'ACTIVE' ? 'activada' : 'desactivada'} correctamente.`
      );
      await loadRegisters();
      onRegistersUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar el estado de la caja.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Messages */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Cajas Configuradas ({registers.length})
          </h4>
          <p className="text-[11px] text-slate-500 font-medium">
            Gestión de puntos de cobro y arqueos de {store.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRegisters}
            disabled={loading}
            className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Recargar cajas"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Nueva Caja</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && registers.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
          <span className="material-symbols-outlined text-3xl animate-spin text-indigo-600 mb-2">
            progress_activity
          </span>
          <p className="text-xs font-medium">Cargando cajas de la tienda...</p>
        </div>
      ) : registers.length === 0 ? (
        /* Empty State */
        <div className="py-10 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[26px]">point_of_sale</span>
          </div>
          <h5 className="text-sm font-bold text-slate-800 mb-1">
            No hay cajas configuradas para esta tienda
          </h5>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Para poder abrir turnos y registrar cobros en POS, debe crear al menos una caja activa.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>+ Crear Primera Caja</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table (≥ md) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Nombre de Caja</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Turno Actual</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {registers.map((reg) => {
                  const isActive = reg.status === 'ACTIVE';
                  const hasOpenSession = !!reg.activeSession;

                  return (
                    <tr
                      key={reg.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isActive ? 'opacity-65 bg-slate-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {reg.code}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {reg.name}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            {isActive ? 'check_circle' : 'block'}
                          </span>
                          <span>{isActive ? 'Activa' : 'Inactiva'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {hasOpenSession ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                            title={`Turno abierto por ${reg.activeSession?.openedByUser?.name || 'Cajero'}`}
                          >
                            <span className="material-symbols-outlined text-[12px]">lock_open</span>
                            <span>Turno Abierto</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-400">
                            <span>Cerrada</span>
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(reg)}
                              className="px-2.5 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Editar caja"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(reg)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                isActive
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={
                                isActive
                                  ? hasOpenSession
                                    ? 'No puedes desactivar esta caja porque tiene un turno abierto.'
                                    : 'Desactivar caja'
                                  : 'Activar caja'
                              }
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {isActive ? 'block' : 'check_circle'}
                              </span>
                              <span>{isActive ? 'Desactivar' : 'Activar'}</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-2.5">
            {registers.map((reg) => {
              const isActive = reg.status === 'ACTIVE';
              const hasOpenSession = !!reg.activeSession;

              return (
                <div
                  key={reg.id}
                  className={`p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 ${
                    !isActive ? 'opacity-70 bg-slate-50/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md mr-2">
                        {reg.code}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">{reg.name}</span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span>{isActive ? 'Activa' : 'Inactiva'}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div>
                      {hasOpenSession ? (
                        <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">lock_open</span>
                          <span>Turno abierto</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Turno cerrado</span>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(reg)}
                          className="px-2 py-1 text-slate-600 hover:text-indigo-600 rounded-md text-xs font-bold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(reg)}
                          className={`px-2 py-1 rounded-md text-xs font-bold ${
                            isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal for Creating or Editing Cash Register */}
      <CashRegisterFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        store={store}
        register={selectedRegister}
        onSave={handleSaveRegister}
        zIndexClass="z-[60]"
      />
    </div>
  );
};
