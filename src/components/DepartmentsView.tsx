import React, { useState, useEffect } from 'react';
import { Department, Product, User } from '../types';
import { PageHeader } from './PageHeader';
import { canManageDepartments } from '../utils/permissions';
import { DepartmentDetailView } from './DepartmentDetailView';
import { api } from '../services/api';

export interface DepartmentsViewProps {
  departments: Department[];
  products?: Product[];
  currentUser: User | null;
  onNewDepartment: () => void;
  onEditDepartment: (dept: Department) => void;
  onDeactivateDepartment: (dept: Department) => Promise<void>;
  onReactivateDepartment: (dept: Department) => Promise<void>;
  onDeleteDepartment?: (dept: Department) => Promise<void>;
  onRefreshData: () => void;
  onEditProduct?: (product: Product) => void;
  onNewProduct?: () => void;
  onNavigateToProducts?: () => void;
  initialSelectedDepartmentId?: string | null;
}

export const DepartmentsView: React.FC<DepartmentsViewProps> = ({
  departments,
  products,
  currentUser,
  onNewDepartment,
  onEditDepartment,
  onDeactivateDepartment,
  onReactivateDepartment,
  onDeleteDepartment,
  onRefreshData,
  onEditProduct,
  onNewProduct,
  onNavigateToProducts,
  initialSelectedDepartmentId = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(() => {
    if (initialSelectedDepartmentId) {
      return departments.find((d) => d.id === initialSelectedDepartmentId) || null;
    }
    return null;
  });

  // Fallback product loading if products prop is not provided
  const [fetchedProducts, setFetchedProducts] = useState<Product[] | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const allowManage = canManageDepartments(currentUser);

  // If initialSelectedDepartmentId changes externally, update state
  useEffect(() => {
    if (initialSelectedDepartmentId) {
      const match = departments.find((d) => d.id === initialSelectedDepartmentId);
      if (match) setSelectedDepartment(match);
    }
  }, [initialSelectedDepartmentId, departments]);

  // If products is not provided via props and a department is selected, fetch products via API
  useEffect(() => {
    if (selectedDepartment && products === undefined) {
      setIsLoadingProducts(true);
      api.getProducts({ departmentId: selectedDepartment.id })
        .then((res) => setFetchedProducts(res))
        .catch((err) => {
          console.error('Error fetching department products:', err);
          setFetchedProducts([]);
        })
        .finally(() => setIsLoadingProducts(false));
    }
  }, [selectedDepartment, products]);

  // If a department is currently selected, render DepartmentDetailView
  if (selectedDepartment) {
    const currentDept =
      departments.find((d) => d.id === selectedDepartment.id) || selectedDepartment;

    const effectiveProducts = products !== undefined ? products : (fetchedProducts || []);

    return (
      <DepartmentDetailView
        department={currentDept}
        products={effectiveProducts}
        currentUser={currentUser}
        onBack={() => {
          setSelectedDepartment(null);
          setFetchedProducts(null);
        }}
        onEditDepartment={onEditDepartment}
        onEditProduct={onEditProduct}
        onNewProduct={onNewProduct}
        onNavigateToProducts={onNavigateToProducts}
        onRefreshData={onRefreshData}
        isLoading={products === undefined && isLoadingProducts}
      />
    );
  }

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
            {allowManage && (
              <button
                onClick={onNewDepartment}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">category</span>
                <span>Nuevo Departamento</span>
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Limpiar búsqueda"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Nombre del Departamento</th>
              <th className="py-3.5 px-4">Descripción</th>
              <th className="py-3.5 px-4 text-center">Productos Asociados</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              {allowManage && <th className="py-3.5 px-4 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={allowManage ? 5 : 4} className="py-10 text-center text-slate-400">
                  No hay departamentos registrados.
                </td>
              </tr>
            ) : (
              filtered.map((dept) => (
                <tr
                  key={dept.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDepartment(dept)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedDepartment(dept);
                    }
                  }}
                  className={`hover:bg-slate-50/90 active:bg-slate-100 transition-colors select-none cursor-pointer focus:outline-none focus:bg-indigo-50/40 ${
                    !dept.active ? 'opacity-60 bg-slate-50/30' : ''
                  }`}
                  title={`Ver detalle del departamento ${dept.name}`}
                  data-testid={`department-row-${dept.id}`}
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-indigo-600">category</span>
                      <span>{dept.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {dept.description || <span className="text-slate-300">Sin descripción</span>}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold font-mono text-indigo-700">
                    {dept._count?.products || 0}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        dept.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {dept.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {allowManage && (
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditDepartment(dept);
                        }}
                        title="Editar departamento"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            No hay departamentos registrados.
          </div>
        ) : (
          filtered.map((dept) => (
            <div
              key={dept.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDepartment(dept)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedDepartment(dept);
                }
              }}
              className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 cursor-pointer hover:bg-slate-50/90 active:bg-slate-100 select-none transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                !dept.active ? 'opacity-60 bg-slate-50/30' : ''
              }`}
              title={`Ver detalle del departamento ${dept.name}`}
              data-testid={`department-card-${dept.id}`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-indigo-600">category</span>
                    <h4 className="font-bold text-sm text-slate-900">{dept.name}</h4>
                  </div>
                  <p className="text-xs text-slate-500">
                    {dept.description || <span className="text-slate-300 italic">Sin descripción</span>}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    dept.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {dept.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">
                  Productos Asociados:{' '}
                  <strong className="font-mono text-indigo-700">{dept._count?.products || 0}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {allowManage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditDepartment(dept);
                      }}
                      className="text-[11px] text-indigo-600 font-semibold flex items-center gap-0.5 hover:underline cursor-pointer"
                      title="Editar departamento"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>Editar</span>
                    </button>
                  )}
                  <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                    <span>Ver detalle</span>
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
