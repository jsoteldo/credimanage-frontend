import React, { useState } from 'react';
import { Department, User } from '../types';
import { PageHeader } from './PageHeader';
import { canManageDepartments } from '../utils/permissions';

interface DepartmentsViewProps {
  departments: Department[];
  currentUser: User | null;
  onNewDepartment: () => void;
  onEditDepartment: (dept: Department) => void;
  onDeactivateDepartment: (dept: Department) => Promise<void>;
  onReactivateDepartment: (dept: Department) => Promise<void>;
  onDeleteDepartment?: (dept: Department) => Promise<void>;
  onRefreshData: () => void;
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({
  departments,
  currentUser,
  onNewDepartment,
  onEditDepartment,
  onDeactivateDepartment,
  onReactivateDepartment,
  onDeleteDepartment,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const allowManage = canManageDepartments(currentUser);

  const filtered = departments.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.description && d.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon="category"
        iconBgClass="bg-indigo-600"
        title="Departamentos de Productos"
        subtitle="Categorías para organizar el inventario y catálogo de productos."
        actions={
          <>
            <button
              onClick={onRefreshData}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Recargar departamentos"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>

            {allowManage && (
              <button
                onClick={onNewDepartment}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>+ Nuevo Departamento</span>
              </button>
            )}
          </>
        }
      />

      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex justify-between items-center">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar departamento..."
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
              <th className="py-3.5 px-4">Nombre del Departamento</th>
              <th className="py-3.5 px-4">Descripción</th>
              <th className="py-3.5 px-4 text-center">Productos Asociados</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              <th className="py-3.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400">
                  No hay departamentos registrados.
                </td>
              </tr>
            ) : (
              filtered.map((dept) => (
                <tr key={dept.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{dept.name}</td>
                  <td className="py-3 px-4 text-slate-500">
                    {dept.description || <span className="text-slate-300">Sin descripción</span>}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-indigo-700">
                    {dept._count?.products || 0}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        dept.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {dept.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {allowManage && (
                        <>
                          <button
                            onClick={() => onEditDepartment(dept)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar departamento"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          {dept.active ? (
                            <button
                              onClick={() => onDeactivateDepartment(dept)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Desactivar departamento"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onReactivateDepartment(dept)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Reactivar departamento"
                            >
                              <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            </button>
                          )}
                          {(dept._count?.products || 0) === 0 && (
                            <button
                              onClick={() => onDeleteDepartment(dept)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar departamento vacío"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
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
