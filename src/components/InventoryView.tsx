import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Location,
  Product,
  Department,
  User,
  InventoryStockItem,
  InventoryKpis,
  StockState,
} from '../types';
import { api } from '../services/api';
import { PageHeader } from './PageHeader';
import { KpiGrid, KpiCard } from './KpiCard';
import { FilterPills } from './FilterPills';
import {
  canAddInventory,
  canAdjustInventory,
  canTransferInventory,
  canManageMinStock,
} from '../utils/permissions';
import { AddInventoryModal } from './AddInventoryModal';
import { AdjustInventoryModal } from './AdjustInventoryModal';
import { TransferInventoryModal } from './TransferInventoryModal';
import { SetMinimumStockModal } from './SetMinimumStockModal';
import { InventoryProductDetailModal } from './InventoryProductDetailModal';
import { InventoryMovementsTable } from './InventoryMovementsTable';

interface InventoryViewProps {
  locations: Location[];
  products: Product[];
  departments: Department[];
  currentUser: User | null;
  onRefreshData?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  locations,
  products,
  departments,
  currentUser,
  onRefreshData,
}) => {
  // Tabs: 'stocks' | 'movements'
  const [activeTab, setActiveTab] = useState<'stocks' | 'movements'>('stocks');

  // Location selector (Top bar)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  // Filters
  const [statusFilter, setStatusFilter] = useState<'todos' | 'normal' | 'bajo' | 'sin_stock' | 'negativo'>('todos');
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data state
  const [stockItems, setStockItems] = useState<InventoryStockItem[]>([]);
  const [kpis, setKpis] = useState<InventoryKpis>({
    totalProducts: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    negativeStockCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showMinStockModal, setShowMinStockModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Modal context product/location
  const [selectedModalProduct, setSelectedModalProduct] = useState<Product | null>(null);
  const [modalLocationId, setModalLocationId] = useState<string>('');
  const [modalInitialMinStock, setModalInitialMinStock] = useState<number>(0);
  const [modalCurrentStock, setModalCurrentStock] = useState<number>(0);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // User permissions
  const allowAdd = canAddInventory(currentUser);
  const allowAdjust = canAdjustInventory(currentUser);
  const allowTransfer = canTransferInventory(currentUser);
  const allowMinStock = canManageMinStock(currentUser);

  const activeLocations = locations.filter((l) => l.active);

  // Auto-select first store if only one exists and not 'all'
  useEffect(() => {
    if (activeLocations.length > 0 && selectedLocationId === 'all') {
      // Default can remain 'all' or first location. 'all' is useful for general overview, but allow switching
    }
  }, [activeLocations]);

  // Load stocks and KPIs
  const loadInventoryData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stocksData, kpisData] = await Promise.all([
        api.getInventoryStock({
          locationId: selectedLocationId,
          departmentId: departmentFilter !== 'todos' ? departmentFilter : undefined,
          q: searchQuery.trim() || undefined,
        }),
        api.getInventoryKpis(selectedLocationId),
      ]);

      setStockItems(stocksData);
      setKpis(kpisData);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar existencias de inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryData();
  }, [selectedLocationId, departmentFilter, searchQuery]);

  // Handle Barcode Scan / Quick Search with Enter
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = searchQuery.trim().toLowerCase();
      if (!code) return;

      const exactMatch = stockItems.find(
        (s) =>
          (s.barcode && s.barcode.toLowerCase() === code) ||
          s.sku.toLowerCase() === code,
      );

      if (exactMatch) {
        // Find product and open detail
        const prod = products.find((p) => p.id === exactMatch.productId);
        if (prod) {
          handleOpenProductDetail(prod.id);
        }
      }
    }
  };

  // Filter items in memory based on statusFilter
  const displayedItems = useMemo(() => {
    return stockItems.filter((item) => {
      if (statusFilter === 'normal' && item.state !== 'NORMAL') return false;
      if (statusFilter === 'bajo' && item.state !== 'LOW') return false;
      if (statusFilter === 'sin_stock' && item.state !== 'OUT_OF_STOCK') return false;
      if (statusFilter === 'negativo' && item.state !== 'NEGATIVE') return false;
      return true;
    });
  }, [stockItems, statusFilter]);

  // Filter pills configuration
  const filterOptions = [
    { key: 'todos', label: 'Todos', count: stockItems.length },
    { key: 'normal', label: 'Stock Normal', count: kpis.inStockCount },
    { key: 'bajo', label: 'Stock Bajo', count: kpis.lowStockCount },
    { key: 'sin_stock', label: 'Sin Stock', count: kpis.outOfStockCount },
    { key: 'negativo', label: 'Stock Negativo', count: kpis.negativeStockCount },
  ];

  // Modal Launchers
  const handleOpenProductDetail = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setSelectedModalProduct(prod || null);
    setShowDetailModal(true);
  };

  const handleOpenAdd = (product?: Product, locId?: string) => {
    setSelectedModalProduct(product || null);
    setModalLocationId(locId || (selectedLocationId !== 'all' ? selectedLocationId : ''));
    setShowAddModal(true);
  };

  const handleOpenAdjust = (product?: Product, locId?: string) => {
    setSelectedModalProduct(product || null);
    setModalLocationId(locId || (selectedLocationId !== 'all' ? selectedLocationId : ''));
    setShowAdjustModal(true);
  };

  const handleOpenTransfer = (product?: Product, fromLocId?: string) => {
    setSelectedModalProduct(product || null);
    setModalLocationId(fromLocId || (selectedLocationId !== 'all' ? selectedLocationId : ''));
    setShowTransferModal(true);
  };

  const handleOpenSetMinStock = (
    product: Product,
    locId: string,
    currentMin: number,
    currentStock: number,
  ) => {
    setSelectedModalProduct(product);
    setModalLocationId(locId);
    setModalInitialMinStock(currentMin);
    setModalCurrentStock(currentStock);
    setShowMinStockModal(true);
  };

  // Helper for status badge rendering
  const renderStatusBadge = (state: StockState) => {
    switch (state) {
      case 'NEGATIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 ring-1 ring-rose-200">
            <span className="material-symbols-outlined text-[12px] text-rose-600">warning</span>
            <span>Stock Negativo</span>
          </span>
        );
      case 'OUT_OF_STOCK':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Sin Stock
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Stock Bajo
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Stock Normal
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        icon="warehouse"
        iconBgClass="bg-indigo-600"
        title="Inventario Multi-Tienda"
        subtitle="Monitoreo de existencias por tienda y almacén, trazabilidad de movimientos y transferencias atómicas."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {allowAdd && (
              <button
                onClick={() => handleOpenAdd()}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_box</span>
                <span>Agregar Stock</span>
              </button>
            )}

            {allowTransfer && (
              <button
                onClick={() => handleOpenTransfer()}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                <span>Transferir</span>
              </button>
            )}

            {allowAdjust && (
              <button
                onClick={() => handleOpenAdjust()}
                className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>Ajustar</span>
              </button>
            )}
          </div>
        }
      />

      {/* Top Location Selector Bar (Section 20) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Location Dropdown */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <span className="material-symbols-outlined text-[20px]">storefront</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
              Ubicación de Consulta
            </span>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="mt-0.5 bg-slate-50 border border-slate-200 hover:border-indigo-400 text-xs font-bold text-slate-900 rounded-xl px-3 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer min-w-[220px]"
            >
              <option value="all">Todas las ubicaciones (Vista Global)</option>
              <optgroup label="Tiendas y Puntos de Venta">
                {activeLocations
                  .filter((l) => l.type === 'STORE')
                  .map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.code ? `[${loc.code}]` : ''}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Almacenes y Depósitos">
                {activeLocations
                  .filter((l) => l.type === 'WAREHOUSE')
                  .map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.code ? `[${loc.code}]` : ''}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start md:self-center">
          <button
            onClick={() => setActiveTab('stocks')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'stocks'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span>Existencias</span>
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'movements'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Movimientos / Kardex</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (Section 19: reactive to location) */}
      <KpiGrid>
        <KpiCard
          icon="check_circle"
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-600"
          value={kpis.inStockCount}
          title="Stock Normal"
          subtitle="Existencias sobre el mínimo"
          onClick={() => setStatusFilter('normal')}
          isActive={statusFilter === 'normal'}
          activeColor="emerald"
        />
        <KpiCard
          icon="warning"
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-600"
          value={kpis.lowStockCount}
          title="Stock Bajo"
          subtitle="En o bajo el stock mínimo"
          onClick={() => setStatusFilter('bajo')}
          isActive={statusFilter === 'bajo'}
          activeColor="indigo"
        />
        <KpiCard
          icon="block"
          iconBgClass="bg-slate-100"
          iconColorClass="text-slate-600"
          value={kpis.outOfStockCount}
          title="Sin Stock"
          subtitle="0 unidades registradas"
          onClick={() => setStatusFilter('sin_stock')}
          isActive={statusFilter === 'sin_stock'}
          activeColor="indigo"
        />
        <KpiCard
          icon="error"
          iconBgClass="bg-rose-50"
          iconColorClass="text-rose-600"
          value={kpis.negativeStockCount}
          title="Stock Negativo"
          subtitle="Faltantes físicos por reponer"
          onClick={() => setStatusFilter('negativo')}
          isActive={statusFilter === 'negativo'}
          activeColor="rose"
        />
      </KpiGrid>

      {/* TAB 1: EXISTENCIAS */}
      {activeTab === 'stocks' && (
        <div className="space-y-4">
          {/* Filters Bar: Pills, Department, and Barcode / Search Input */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
            <FilterPills
              options={filterOptions}
              activeKey={statusFilter}
              onSelect={(k) => setStatusFilter(k as any)}
              activeColor="indigo"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Department filter */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="todos">Todos los departamentos</option>
                {departments
                  .filter((d) => d.active)
                  .map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
              </select>

              {/* Barcode and Search Input (Section 25) */}
              <div className="relative w-full sm:w-80">
                <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  barcode_scanner
                </span>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder="Buscar o escanear código (Enter)..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-[28px] text-indigo-600">
                progress_activity
              </span>
              <p className="text-xs font-medium">Cargando existencias...</p>
            </div>
          )}

          {!loading && displayedItems.length === 0 && (
            <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[36px] text-slate-300">inventory</span>
              <p className="text-xs font-bold text-slate-600">No se encontraron existencias</p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                No hay productos que coincidan con la ubicación o filtros seleccionados.
              </p>
            </div>
          )}

          {/* Desktop Table View (>= md) (Section 21) */}
          {!loading && displayedItems.length > 0 && (
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200/80">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Código / Barcode</th>
                    <th className="px-4 py-3">Departamento</th>
                    <th className="px-4 py-3">Ubicación</th>
                    <th className="px-4 py-3 text-right">Stock Actual</th>
                    <th className="px-4 py-3 text-right">Stock Mínimo</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3">Último Movimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedItems.map((item) => (
                    <tr
                      key={`${item.productId}-${item.locationId}`}
                      onClick={() => handleOpenProductDetail(item.productId)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer select-none"
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block truncate max-w-[220px]">
                          {item.productName}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {item.saleType === 'WEIGHT' ? 'Venta por peso / granel' : 'Unidad'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{item.sku}</span>
                        {item.barcode && (
                          <span className="text-[10px] text-slate-400 block font-normal">
                            {item.barcode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {item.departmentName || <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {item.locationName}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={`text-sm ${
                            item.state === 'NEGATIVE'
                              ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200'
                              : item.state === 'OUT_OF_STOCK'
                              ? 'text-slate-400'
                              : item.state === 'LOW'
                              ? 'text-amber-700 font-bold'
                              : 'text-slate-900'
                          }`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                        {item.minimumStock}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {renderStatusBadge(item.state)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {item.lastMovement ? (
                          <div>
                            <span className="font-medium text-slate-700 block">
                              {item.lastMovement.type.replace('_', ' ')} (
                              {item.lastMovement.quantity > 0 ? '+' : ''}
                              {item.lastMovement.quantity})
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(item.lastMovement.createdAt).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Sin movimientos</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Cards View (< md) (Section 22) */}
          {!loading && displayedItems.length > 0 && (
            <div className="md:hidden space-y-3">
              {displayedItems.map((item) => (
                <div
                  key={`mobile-${item.productId}-${item.locationId}`}
                  onClick={() => handleOpenProductDetail(item.productId)}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2.5 cursor-pointer active:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">{item.productName}</h4>
                      <p className="text-[10px] font-mono text-slate-400">
                        SKU: {item.sku} {item.barcode ? `| ${item.barcode}` : ''}
                      </p>
                    </div>
                    {renderStatusBadge(item.state)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Ubicación
                      </span>
                      <span className="font-medium text-slate-800">{item.locationName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Stock Actual / Mínimo
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          item.state === 'NEGATIVE' ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {item.quantity} / {item.minimumStock}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MOVIMIENTOS / KARDEX (Section 24) */}
      {activeTab === 'movements' && (
        <InventoryMovementsTable
          locations={locations}
          products={products}
          selectedLocationId={selectedLocationId !== 'all' ? selectedLocationId : undefined}
        />
      )}

      {/* MODALS */}
      <AddInventoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        locations={locations}
        products={products}
        selectedLocationId={modalLocationId || selectedLocationId}
        preselectedProduct={selectedModalProduct}
        onSuccess={loadInventoryData}
      />

      <AdjustInventoryModal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        locations={locations}
        products={products}
        selectedLocationId={modalLocationId || selectedLocationId}
        preselectedProduct={selectedModalProduct}
        onSuccess={loadInventoryData}
      />

      <TransferInventoryModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        locations={locations}
        products={products}
        selectedLocationId={modalLocationId || selectedLocationId}
        preselectedProduct={selectedModalProduct}
        onSuccess={loadInventoryData}
      />

      <SetMinimumStockModal
        isOpen={showMinStockModal}
        onClose={() => setShowMinStockModal(false)}
        locations={locations}
        product={selectedModalProduct}
        locationId={modalLocationId}
        initialMinStock={modalInitialMinStock}
        currentStock={modalCurrentStock}
        onSuccess={loadInventoryData}
      />

      <InventoryProductDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        productId={selectedModalProduct?.id || null}
        locations={locations}
        currentUser={currentUser}
        onOpenAddInventory={(p, locId) => handleOpenAdd(p, locId)}
        onOpenAdjustInventory={(p, locId) => handleOpenAdjust(p, locId)}
        onOpenTransferInventory={(p, fromLocId) => handleOpenTransfer(p, fromLocId)}
        onOpenSetMinStock={(p, locId, curMin, curStock) =>
          handleOpenSetMinStock(p, locId, curMin, curStock)
        }
      />
    </div>
  );
};
