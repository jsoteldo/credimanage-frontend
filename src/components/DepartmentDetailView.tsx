import React, { useState, useMemo } from 'react';
import { Department, Product, User } from '../types';
import { PageHeader } from './PageHeader';
import { canCreateProduct, canEditProduct, canManageDepartments } from '../utils/permissions';

export interface DepartmentDetailViewProps {
  department: Department;
  products: Product[];
  currentUser: User | null;
  onBack: () => void;
  onEditDepartment?: (dept: Department) => void;
  onEditProduct?: (product: Product) => void;
  onNewProduct?: () => void;
  onNavigateToProducts?: () => void;
  onRefreshData?: () => void;
  isLoading?: boolean;
}

export const DepartmentDetailView: React.FC<DepartmentDetailViewProps> = ({
  department,
  products,
  currentUser,
  onBack,
  onEditDepartment,
  onEditProduct,
  onNewProduct,
  onNavigateToProducts,
  onRefreshData,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const allowManageDepartment = canManageDepartments(currentUser);
  const allowCreate = canCreateProduct(currentUser);
  const allowEdit = canEditProduct(currentUser);

  // Semantics: all products associated with this department (active and inactive)
  const allDeptProducts = useMemo(() => {
    return products.filter((p) => p.departmentId === department.id);
  }, [products, department.id]);

  // Total count matches department._count?.products or total associated products
  const totalAssociatedCount = department._count?.products ?? allDeptProducts.length;

  // Filter products by search query (name or code/sku/barcode)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return allDeptProducts;
    const q = searchQuery.toLowerCase().trim();
    return allDeptProducts.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
      return matchName || matchSku || matchBarcode;
    });
  }, [allDeptProducts, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <button
          onClick={onBack}
          aria-label="Volver a Departamentos"
          title="Volver a Departamentos"
          className="hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1 focus:outline-none focus:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Departamentos</span>
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-bold truncate max-w-xs">{department.name}</span>
      </nav>

      {/* Header */}
      <PageHeader
        icon="category"
        iconBgClass={department.active ? 'bg-indigo-600' : 'bg-slate-600'}
        title={department.name}
        subtitle="Catálogo y administración de productos asociados a esta categoría."
        actions={
          <>
            {allowManageDepartment && onEditDepartment && (
              <button
                onClick={() => onEditDepartment(department)}
                className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Editar este departamento"
              >
                <span className="material-symbols-outlined text-[18px] text-indigo-600">edit</span>
                <span>Editar Departamento</span>
              </button>
            )}

            {allowCreate && onNewProduct && (
              <button
                onClick={onNewProduct}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
                title="Registrar nuevo producto"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>Nuevo Producto</span>
              </button>
            )}
          </>
        }
      />

      {/* Department Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
                department.active
                  ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
            >
              <span className="material-symbols-outlined text-[26px]">category</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{department.name}</h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    department.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                  data-testid="department-status-badge"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      department.active ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  {department.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {department.description ? (
                  <span>{department.description}</span>
                ) : (
                  <span className="text-slate-400 italic">Sin descripción registrada</span>
                )}
              </p>
            </div>
          </div>

          {/* KPI / Counter */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-2xl border border-slate-200/80 px-4 py-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100/70 flex items-center justify-center text-indigo-700">
              <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Productos Asociados
              </span>
              <span
                className="font-mono text-xl font-black text-slate-900"
                data-testid="associated-products-count"
              >
                {totalAssociatedCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar & Counter */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar producto en este departamento..."
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

        <div data-testid="showing-products-counter" className="text-xs text-slate-500 font-medium">
          Mostrando <span className="font-bold text-slate-900">{filteredProducts.length}</span> de{' '}
          <span className="font-bold text-slate-900">{totalAssociatedCount}</span> producto(s)
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80">
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[32px] text-indigo-500 animate-spin">
              progress_activity
            </span>
            <p className="text-xs font-semibold text-slate-600">Cargando productos del departamento...</p>
          </div>
        </div>
      ) : allDeptProducts.length === 0 ? (
        /* Empty State: No products assigned to department */
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400">
            <span className="material-symbols-outlined text-[32px]">inventory_2</span>
          </div>
          <p className="font-bold text-slate-700 text-sm">
            No hay productos asignados a este departamento.
          </p>
          <p className="text-xs text-slate-400 max-w-sm">
            Puedes registrar un nuevo producto o asignar productos existentes editando su departamento en el catálogo.
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
            {onNavigateToProducts && (
              <button
                onClick={onNavigateToProducts}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                <span>Ver Productos</span>
              </button>
            )}
            {allowCreate && onNewProduct && (
              <button
                onClick={onNewProduct}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Crear Producto</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Empty Search State */
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[28px] text-slate-300">search_off</span>
          <p className="font-semibold text-slate-600 text-xs">
            No se encontraron productos que coincidan con &ldquo;{searchQuery}&rdquo; en este departamento.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer mt-1"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Producto</th>
                  <th className="py-3.5 px-4">Código / SKU</th>
                  <th className="py-3.5 px-4">Tipo de Venta</th>
                  <th className="py-3.5 px-4 text-right">Precio Venta</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEditProduct && onEditProduct(product)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEditProduct && onEditProduct(product);
                      }
                    }}
                    className={`hover:bg-slate-50/90 active:bg-slate-100 transition-colors select-none ${
                      onEditProduct ? 'cursor-pointer' : ''
                    } focus:outline-none focus:bg-indigo-50/40 ${
                      !product.active ? 'opacity-60 bg-slate-50/30' : ''
                    }`}
                    title={
                      allowEdit
                        ? `Clic para editar producto ${product.name}`
                        : `Ver producto ${product.name}`
                    }
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{product.name}</div>
                      {product.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {product.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      <div>{product.sku}</div>
                      {product.barcode && (
                        <div className="text-[10px] text-slate-400 font-normal font-mono flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">barcode_scanner</span>
                          <span>{product.barcode}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {product.saleType === 'KIT' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          <span className="material-symbols-outlined text-[12px]">widgets</span>
                          <span>KIT</span>
                        </span>
                      ) : product.saleType === 'WEIGHT' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <span className="material-symbols-outlined text-[12px]">scale</span>
                          <span>PESO</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          <span>UNIDAD</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 text-sm">
                      ${Number(product.salePrice).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          product.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {product.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => onEditProduct && onEditProduct(product)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEditProduct && onEditProduct(product);
                  }
                }}
                className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 select-none transition-colors ${
                  onEditProduct ? 'cursor-pointer hover:bg-slate-50/90 active:bg-slate-100' : ''
                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                  !product.active ? 'opacity-60 bg-slate-50/30' : ''
                }`}
                title={
                  allowEdit
                    ? `Toca para editar producto ${product.name}`
                    : `Ver producto ${product.name}`
                }
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{product.sku}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          product.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {product.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900">{product.name}</h4>
                    {product.barcode && (
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">barcode_scanner</span>
                        <span>{product.barcode}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-indigo-600 text-base">
                      ${Number(product.salePrice).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {product.saleType === 'KIT'
                        ? 'Kit'
                        : product.saleType === 'WEIGHT'
                        ? 'A granel'
                        : 'Unidad'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span className="text-[11px]">
                    {product.saleType === 'KIT'
                      ? 'Combo compuesto'
                      : product.saleType === 'WEIGHT'
                      ? 'Venta por peso'
                      : 'Venta unitaria'}
                  </span>
                  {allowEdit && onEditProduct && (
                    <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>Editar</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
