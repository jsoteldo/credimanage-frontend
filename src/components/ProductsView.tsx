import React, { useState, useMemo } from 'react';
import { Product, Department, User } from '../types';
import { PageHeader } from './PageHeader';
import { KpiGrid, KpiCard } from './KpiCard';
import { FilterPills } from './FilterPills';
import { canCreateProduct, canEditProduct, canDeactivateProduct, canImportProducts } from '../utils/permissions';

interface ProductsViewProps {
  products: Product[];
  departments: Department[];
  currentUser: User | null;
  onNewProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeactivateProduct: (product: Product) => Promise<void>;
  onReactivateProduct: (product: Product) => Promise<void>;
  onOpenImportModal: () => void;
  onRefreshData: () => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  departments,
  currentUser,
  onNewProduct,
  onEditProduct,
  onDeactivateProduct,
  onReactivateProduct,
  onOpenImportModal,
  onRefreshData,
}) => {
  const [statusFilter, setStatusFilter] = useState<'todos' | 'unit' | 'weight' | 'kit' | 'inactivos'>('todos');
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Permissions
  const allowCreate = canCreateProduct(currentUser);
  const allowEdit = canEditProduct(currentUser);
  const allowDeactivate = canDeactivateProduct(currentUser);
  const allowImport = canImportProducts(currentUser);

  // Metrics
  const totalCount = products.length;
  const unitCount = products.filter((p) => p.saleType === 'UNIT' && p.active).length;
  const weightCount = products.filter((p) => p.saleType === 'WEIGHT' && p.active).length;
  const kitCount = products.filter((p) => p.saleType === 'KIT' && p.active).length;
  const inactivosCount = products.filter((p) => !p.active).length;

  // Filter options
  const filterOptions: { key: 'todos' | 'unit' | 'weight' | 'kit' | 'inactivos'; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: totalCount },
    { key: 'unit', label: 'Unidades', count: unitCount },
    { key: 'weight', label: 'A Granel / Peso', count: weightCount },
    { key: 'kit', label: 'Kits / Combos', count: kitCount },
    { key: 'inactivos', label: 'Desactivados', count: inactivosCount },
  ];

  const displayedProducts = useMemo(() => {
    return products.filter((p) => {
      // Status / type filter
      if (statusFilter === 'unit' && (p.saleType !== 'UNIT' || !p.active)) return false;
      if (statusFilter === 'weight' && (p.saleType !== 'WEIGHT' || !p.active)) return false;
      if (statusFilter === 'kit' && (p.saleType !== 'KIT' || !p.active)) return false;
      if (statusFilter === 'inactivos' && p.active) return false;

      // Department filter
      if (departmentFilter !== 'todos' && p.departmentId !== departmentFilter) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          p.name.toLowerCase().includes(q) ||
          (p.departmentName && p.departmentName.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [products, statusFilter, departmentFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon="inventory_2"
        iconBgClass="bg-indigo-600"
        title="Catálogo de Productos"
        subtitle="Administra artículos unitarios, ventas a granel y combos compuestos."
        actions={
          <>
            <button
              onClick={onRefreshData}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Recargar catálogo"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>

            {allowImport && (
              <button
                onClick={onOpenImportModal}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Importar productos desde Excel o CSV"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-600">upload_file</span>
                <span>Importar Excel</span>
              </button>
            )}

            {allowCreate && (
              <button
                onClick={onNewProduct}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
                title="Registrar nuevo producto en el catálogo"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>+ Nuevo Producto</span>
              </button>
            )}
          </>
        }
      />

      {/* KPI Cards */}
      <KpiGrid columnsClass="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Total Catálogo"
          value={totalCount}
          subtitle="Productos registrados"
          icon="inventory_2"
          iconBgClass="bg-indigo-50"
          iconColorClass="text-indigo-600"
        />
        <KpiCard
          title="Venta Unitaria"
          value={unitCount}
          subtitle="Artículos enteros"
          icon="shopping_bag"
          iconBgClass="bg-blue-50"
          iconColorClass="text-blue-600"
        />
        <KpiCard
          title="A Granel / Peso"
          value={weightCount}
          subtitle="Cantidades fraccionadas"
          icon="scale"
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-600"
        />
        <KpiCard
          title="Kits / Combos"
          value={kitCount}
          subtitle="Productos compuestos"
          icon="widgets"
          iconBgClass="bg-purple-50"
          iconColorClass="text-purple-600"
        />
      </KpiGrid>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <FilterPills
          options={filterOptions}
          activeKey={statusFilter}
          onSelect={(key) => setStatusFilter(key as any)}
          activeColor="indigo"
        />

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Department dropdown filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none cursor-pointer"
          >
            <option value="todos">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar SKU, barras o nombre..."
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
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Código / SKU</th>
              <th className="py-3.5 px-4">Descripción</th>
              <th className="py-3.5 px-4">Departamento</th>
              <th className="py-3.5 px-4">Tipo</th>
              <th className="py-3.5 px-4 text-right">P. Costo</th>
              <th className="py-3.5 px-4 text-right">P. Venta</th>
              <th className="py-3.5 px-4 text-center">Inv.</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              <th className="py-3.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {displayedProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[36px] text-slate-300">
                      inventory_2
                    </span>
                    <p className="font-semibold text-slate-600">No se encontraron productos</p>
                    <p className="text-[11px] text-slate-400">
                      Ajusta los filtros o haz clic en "+ Nuevo Producto" para registrar uno.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              displayedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    <div>{product.sku}</div>
                    {product.barcode && (
                      <div className="text-[10px] text-slate-400 font-normal font-mono flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">barcode_scanner</span>
                        <span>{product.barcode}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{product.name}</div>
                    {product.saleType === 'KIT' && product.components && (
                      <div className="text-[10px] text-purple-700 font-medium mt-0.5">
                        Kit: {product.components.length} componente(s)
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-medium">
                    {product.departmentName ? (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[11px]">
                        {product.departmentName}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">General</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {product.saleType === 'KIT' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                        <span className="material-symbols-outlined text-[12px]">widgets</span>
                        <span>KIT</span>
                      </span>
                    ) : product.saleType === 'WEIGHT' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <span className="material-symbols-outlined text-[12px]">scale</span>
                        <span>PESO</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        <span>UNIDAD</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500 font-medium">
                    ${product.costPrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 text-sm">
                    ${product.salePrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {product.saleType === 'KIT' ? (
                      <span className="text-[11px] text-slate-400 font-medium">Auto (Kit)</span>
                    ) : product.tracksInventory ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        <span>Sí</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <span>No</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        product.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {product.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {allowEdit && (
                        <button
                          onClick={() => onEditProduct(product)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar producto"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      )}
                      {allowDeactivate && (
                        product.active ? (
                          <button
                            onClick={() => onDeactivateProduct(product)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Desactivar producto"
                          >
                            <span className="material-symbols-outlined text-[18px]">block</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onReactivateProduct(product)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Reactivar producto"
                          >
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {displayedProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            No se encontraron productos.
          </div>
        ) : (
          displayedProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{product.sku}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        product.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {product.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 mt-0.5">{product.name}</h4>
                  {product.barcode && (
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[12px]">barcode_scanner</span>
                      <span>{product.barcode}</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-indigo-600 text-lg">
                    ${product.salePrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Costo: ${product.costPrice.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium">
                  {product.departmentName || 'General'} • {product.saleType}
                </span>

                <div className="flex items-center gap-1">
                  {allowEdit && (
                    <button
                      onClick={() => onEditProduct(product)}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      Editar
                    </button>
                  )}
                  {allowDeactivate && (
                    <button
                      onClick={() =>
                        product.active ? onDeactivateProduct(product) : onReactivateProduct(product)
                      }
                      className={`px-2 py-1 text-xs font-bold rounded-lg ${
                        product.active ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {product.active ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
