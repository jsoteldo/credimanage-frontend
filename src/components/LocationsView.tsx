import React, { useState } from 'react';
import { Location, User } from '../types';
import { PageHeader } from './PageHeader';
import { FilterPills } from './FilterPills';
import { canManageLocations } from '../utils/permissions';

interface LocationsViewProps {
  locations: Location[];
  currentUser: User | null;
  onNewLocation: () => void;
  onEditLocation: (loc: Location) => void;
  onDeactivateLocation: (loc: Location) => Promise<void>;
  onReactivateLocation: (loc: Location) => Promise<void>;
  onRefreshData: () => void;
}

export const LocationsView: React.FC<LocationsViewProps> = ({
  locations,
  currentUser,
  onNewLocation,
  onEditLocation,
  onDeactivateLocation,
  onReactivateLocation,
  onRefreshData,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'STORE' | 'WAREHOUSE'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const allowManage = canManageLocations(currentUser);

  const filterOptions = [
    { key: 'all', label: 'Todas', count: locations.length },
    { key: 'STORE', label: 'Tiendas', count: locations.filter((l) => l.type === 'STORE').length },
    { key: 'WAREHOUSE', label: 'Almacenes', count: locations.filter((l) => l.type === 'WAREHOUSE').length },
  ];

  const filtered = locations.filter((l) => {
    if (filterType !== 'all' && l.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        l.name.toLowerCase().includes(q) ||
        (l.code && l.code.toLowerCase().includes(q)) ||
        (l.address && l.address.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon="store"
        iconBgClass="bg-indigo-600"
        title="Tiendas y Almacenes"
        subtitle="Configuración de puntos de venta y depósitos físicos de la empresa."
        actions={
          <>
            <button
              onClick={onRefreshData}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Recargar ubicaciones"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>

            {allowManage && (
              <button
                onClick={onNewLocation}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>+ Nueva Ubicación</span>
              </button>
            )}
          </>
        }
      />

      {/* Filter and Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <FilterPills
          options={filterOptions}
          activeKey={filterType}
          onSelect={(k) => setFilterType(k as any)}
          activeColor="indigo"
        />

        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tienda o almacén..."
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
              <th className="py-3.5 px-4">Código</th>
              <th className="py-3.5 px-4">Nombre de Ubicación</th>
              <th className="py-3.5 px-4">Tipo</th>
              <th className="py-3.5 px-4">Dirección</th>
              <th className="py-3.5 px-4 text-center">Estado</th>
              <th className="py-3.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  No hay ubicaciones registradas.
                </td>
              </tr>
            ) : (
              filtered.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    {loc.code || <span className="text-slate-300 font-normal">--</span>}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{loc.name}</td>
                  <td className="py-3 px-4">
                    {loc.type === 'STORE' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                        <span className="material-symbols-outlined text-[12px]">storefront</span>
                        <span>Tienda</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800">
                        <span className="material-symbols-outlined text-[12px]">warehouse</span>
                        <span>Almacén</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {loc.address || <span className="text-slate-300">Sin dirección especificada</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        loc.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {loc.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {allowManage && (
                        <>
                          <button
                            onClick={() => onEditLocation(loc)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar ubicación"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          {loc.active ? (
                            <button
                              onClick={() => onDeactivateLocation(loc)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Desactivar ubicación"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onReactivateLocation(loc)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Reactivar ubicación"
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
