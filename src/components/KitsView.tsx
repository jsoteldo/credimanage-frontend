import React, { useState } from 'react';
import { Product, User } from '../types';
import { PageHeader } from './PageHeader';
import { canCreateProduct, canEditProduct, canDeactivateProduct } from '../utils/permissions';

interface KitsViewProps {
  products: Product[];
  currentUser: User | null;
  onNewKit: () => void;
  onEditKit: (kit: Product) => void;
  onDeactivateKit: (kit: Product) => Promise<void>;
  onReactivateKit: (kit: Product) => Promise<void>;
  onRefreshData: () => void;
}

export const KitsView: React.FC<KitsViewProps> = ({
  products,
  currentUser,
  onNewKit,
  onEditKit,
  onDeactivateKit,
  onReactivateKit,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const allowCreate = canCreateProduct(currentUser);
  const allowEdit = canEditProduct(currentUser);
  const allowDeactivate = canDeactivateProduct(currentUser);

  // Filter only kits
  const kits = products.filter((p) => p.saleType === 'KIT');

  const filteredKits = kits.filter((k) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      k.sku.toLowerCase().includes(q) ||
      k.name.toLowerCase().includes(q) ||
      (k.components &&
        k.components.some(
          (c) =>
            c.componentSku.toLowerCase().includes(q) ||
            c.componentName.toLowerCase().includes(q),
        ))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon="widgets"
        iconBgClass="bg-purple-600"
        title="Kits y Productos Compuestos"
        subtitle="Combos y paquetes armados con múltiples productos unitarios o por peso."
        actions={
          <>
            <button
              onClick={onRefreshData}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Recargar combos"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>

            {allowCreate && (
              <button
                onClick={onNewKit}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>+ Nuevo Combo / Kit</span>
              </button>
            )}
          </>
        }
      />

      {/* Info notice about kit stock */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-3 text-purple-900 text-xs">
        <span className="material-symbols-outlined text-[20px] text-purple-600 shrink-0 mt-0.5">
          info
        </span>
        <div>
          <span className="font-bold">Regla de Dominio para Kits:</span>
          <p className="text-[11px] text-purple-800 mt-0.5">
            Los productos tipo KIT no mantienen stock físico independiente en almacén. Su disponibilidad
            se calculará de forma dinámica en la Entrega 2 mediante la fórmula matemática:{' '}
            <code className="font-mono bg-purple-100 px-1 py-0.5 rounded font-bold">
              min(floor(stock_componente / cantidad_requerida))
            </code>.
          </p>
        </div>
      </div>

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
            placeholder="Buscar combo o por componente..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
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

      {/* Kits Cards Grid */}
      {filteredKits.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <span className="material-symbols-outlined text-[36px] text-slate-300">widgets</span>
          <p className="font-semibold text-slate-600 mt-2">No hay kits registrados</p>
          <p className="text-xs text-slate-400">
            Haz clic en "+ Nuevo Combo / Kit" para registrar un producto compuesto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKits.map((kit) => (
            <div
              key={kit.id}
              className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {kit.sku}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      kit.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {kit.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <h4 className="text-base font-extrabold text-slate-900 leading-snug">{kit.name}</h4>
                {kit.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{kit.description}</p>
                )}

                <div className="mt-4 p-3 bg-purple-50/50 rounded-2xl border border-purple-100">
                  <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block mb-2">
                    Componentes del Combo ({kit.components?.length || 0}):
                  </span>
                  <div className="space-y-1.5">
                    {kit.components && kit.components.length > 0 ? (
                      kit.components.map((comp, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-xs text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-purple-100/60"
                        >
                          <span className="font-medium truncate mr-2">
                            {comp.componentName || comp.componentSku}
                          </span>
                          <span className="font-mono font-bold text-purple-700 shrink-0">
                            {comp.quantity} {comp.saleType === 'WEIGHT' ? 'Kg' : 'Ud'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">Sin componentes definidos</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">Precio de Venta:</span>
                  <span className="font-mono text-lg font-black text-indigo-600">
                    ${kit.salePrice.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {allowEdit && (
                    <button
                      onClick={() => onEditKit(kit)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Editar
                    </button>
                  )}
                  {allowDeactivate && (
                    <button
                      onClick={() =>
                        kit.active ? onDeactivateKit(kit) : onReactivateKit(kit)
                      }
                      className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                        kit.active
                          ? 'text-rose-500 hover:bg-rose-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={kit.active ? 'Desactivar combo' : 'Reactivar combo'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {kit.active ? 'block' : 'check_circle'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
