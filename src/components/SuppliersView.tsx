import React, { useState } from 'react';
import { Supplier, User } from '../types';
import { PageHeader } from './PageHeader';
import { canManageSuppliers } from '../utils/permissions';

interface SuppliersViewProps {
  suppliers: Supplier[];
  currentUser: User | null;
  onNewSupplier: () => void;
  onEditSupplier: (supplier: Supplier) => void;
  onDeactivateSupplier: (supplier: Supplier) => Promise<void>;
  onReactivateSupplier: (supplier: Supplier) => Promise<void>;
  onRefreshData: () => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  currentUser,
  onNewSupplier,
  onEditSupplier,
  onDeactivateSupplier,
  onReactivateSupplier,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const allowManage = canManageSuppliers(currentUser);

  const filtered = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.taxId && s.taxId.toLowerCase().includes(q)) ||
      (s.contactName && s.contactName.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon="local_shipping"
        iconBgClass="bg-indigo-600"
        title="Directorio de Proveedores"
        subtitle="Gestión de contactos de proveedores para compras y recepciones futuras."
        actions={
          <>
            <button
              onClick={onRefreshData}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Recargar proveedores"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>

            {allowManage && (
              <button
                onClick={onNewSupplier}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>+ Nuevo Proveedor</span>
              </button>
            )}
          </>
        }
      />

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex justify-between items-center">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar proveedor, RUC, teléfono..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Proveedor / Razón Social</th>
              <th className="py-3.5 px-4">RUC / Identificación</th>
              <th className="py-3.5 px-4">Contacto / Teléfono</th>
              <th className="py-3.5 px-4">Correo</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              <th className="py-3.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  No hay proveedores registrados.
                </td>
              </tr>
            ) : (
              filtered.map((supp) => (
                <tr key={supp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{supp.name}</div>
                    {supp.address && <div className="text-[11px] text-slate-400">{supp.address}</div>}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {supp.taxId || <span className="text-slate-300">--</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{supp.contactName || '--'}</div>
                    {supp.phone && (
                      <div className="text-[11px] text-slate-500 font-mono">{supp.phone}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {supp.email || <span className="text-slate-300">--</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        supp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {supp.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {allowManage && (
                        <>
                          <button
                            onClick={() => onEditSupplier(supp)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar proveedor"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          {supp.active ? (
                            <button
                              onClick={() => onDeactivateSupplier(supp)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Desactivar proveedor"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onReactivateSupplier(supp)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Reactivar proveedor"
                            >
                              <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
