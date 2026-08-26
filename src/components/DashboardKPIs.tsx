import React from 'react';
import { DashboardMetrics } from '../types';

interface DashboardKPIsProps {
  metrics: DashboardMetrics;
  onFilterClick?: (filter: string) => void;
  onViewPaymentsHistory?: () => void;
  onViewPurchasesHistory?: () => void;
}

export const DashboardKPIs: React.FC<DashboardKPIsProps> = ({
  metrics,
  onFilterClick,
  onViewPaymentsHistory,
  onViewPurchasesHistory,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Card 1: Clientes Registrados */}
      <div
        onClick={() => onFilterClick && onFilterClick('todos')}
        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
      >
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes Registrados</h3>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[20px]">group</span>
          </div>
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
          {metrics.totalClients}
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-indigo-600">
          <span className="material-symbols-outlined text-[14px]">trending_up</span>
          <span>Ver catálogo de clientes</span>
        </div>
      </div>

      {/* Card 2: Clientes con Deuda */}
      <div
        onClick={() => onFilterClick && onFilterClick('con_deuda')}
        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
      >
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes con Deuda</h3>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[20px]">warning</span>
          </div>
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
          {metrics.clientsWithDebt}
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-rose-600">
          <span className="material-symbols-outlined text-[14px]">filter_alt</span>
          <span>Filtrar lista con deuda</span>
        </div>
      </div>

      {/* Card 3: Cuentas y Deudas Registradas */}
      <div
        onClick={() => onViewPurchasesHistory && onViewPurchasesHistory()}
        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-amber-400 transition-all cursor-pointer group relative overflow-hidden"
        title="Clic para ver detalle de cuentas y deudas registradas por fecha y hora"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuentas Registradas</h3>
            <span className="text-[10px] text-amber-600 font-bold group-hover:underline flex items-center gap-0.5 mt-0.5">
              <span>Ver detalle con horas</span>
              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
          S/ {metrics.totalPendingDebt.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="flex items-center justify-between text-xs font-medium text-amber-700">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">history</span>
            <span>Historial por días y horas</span>
          </div>
          <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
            Clic aquí 🔍
          </span>
        </div>
      </div>

      {/* Card 4: Abonos Recibidos Hoy */}
      <div
        onClick={() => onViewPaymentsHistory && onViewPaymentsHistory()}
        className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer group relative overflow-hidden"
        title="Clic para ver detalle de abonos recibidos por fecha y cliente"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Abonos Recibidos Hoy</h3>
            <span className="text-[10px] text-emerald-600 font-bold group-hover:underline flex items-center gap-0.5 mt-0.5">
              <span>Ver detalle con horas</span>
              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
            <span className="material-symbols-outlined text-[20px]">payments</span>
          </div>
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">
          S/ {metrics.todayPaymentsTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="flex items-center justify-between text-xs font-medium text-emerald-600">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            <span>{metrics.todayPaymentsCount} transacciones hoy</span>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
            Clic aquí 🔍
          </span>
        </div>
      </div>
    </div>
  );
};
