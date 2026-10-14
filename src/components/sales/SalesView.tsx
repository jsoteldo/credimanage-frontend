import React, { useState } from 'react';
import { Location, Product, Client, User, Sale } from '../../types';
import { PageHeader } from '../PageHeader';
import { PosScreen } from './PosScreen';
import { SalesHistoryTab } from './SalesHistoryTab';

interface SalesViewProps {
  locations: Location[];
  products: Product[];
  clients: Client[];
  currentUser: User | null;
  onRefreshData?: () => void;
  onNavigateToStoreRegisters?: (storeId: string) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  locations,
  products,
  clients,
  currentUser,
  onRefreshData,
  onNavigateToStoreRegisters,
}) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos');
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState<number>(0);

  const handleSaleCreated = (sale: Sale) => {
    setHistoryRefreshTrigger((prev) => prev + 1);
    if (onRefreshData) {
      onRefreshData();
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Ventas / Punto de Venta (POS)"
        subtitle="Registro de ventas en mostrador, pagos mixtos y control de inventario en tiempo real"
        icon="point_of_sale"
      />

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('pos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'pos'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
          <span>POS / Nueva Venta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          <span>Historial de Ventas</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'pos' ? (
        <PosScreen
          locations={locations}
          products={products}
          clients={clients}
          currentUser={currentUser}
          onSaleCreated={handleSaleCreated}
          onViewSalesHistory={() => setActiveTab('history')}
          onRefreshData={onRefreshData}
          onNavigateToStoreRegisters={onNavigateToStoreRegisters}
        />
      ) : (
        <SalesHistoryTab
          locations={locations}
          clients={clients}
          currentUser={currentUser}
          onRefreshTrigger={historyRefreshTrigger}
        />
      )}
    </div>
  );
};
