import React from 'react';
import { User } from '../types';

interface SidebarProps {
  currentView: 'dashboard' | 'clients' | 'reports' | 'admin' | 'settings';
  setCurrentView: (view: 'dashboard' | 'clients' | 'reports' | 'admin' | 'settings') => void;
  user: User | null;
  onLogout: () => void;
  onExportData: () => void;
  onOpenLogin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  user,
  onLogout,
  onExportData,
  onOpenLogin,
}) => {
  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 py-6 px-4 bg-white/95 backdrop-blur-md border-r border-slate-200/80 shadow-xs z-40">
      {/* Business Logo & Title */}
      <div className="px-3 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20">
          <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
        </div>
        <div>
          <h1 className="font-extrabold text-slate-900 text-lg leading-tight tracking-tight">
            CrediManage
          </h1>
          <p className="text-xs font-medium text-slate-500">POS & Crédito</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer ${
            currentView === 'dashboard'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className={`material-symbols-outlined text-[20px] ${currentView === 'dashboard' ? 'fill' : ''}`}>
            dashboard
          </span>
          Inicio
        </button>

        <button
          onClick={() => setCurrentView('clients')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer ${
            currentView === 'clients'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className={`material-symbols-outlined text-[20px] ${currentView === 'clients' ? 'fill' : ''}`}>
            group
          </span>
          Clientes
        </button>

        <button
          onClick={() => setCurrentView('reports')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer ${
            currentView === 'reports'
              ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className={`material-symbols-outlined text-[20px] ${currentView === 'reports' ? 'fill' : ''}`}>
            analytics
          </span>
          Reportes
        </button>

        {user && user.role === 'Administrador' && (
          <button
            onClick={() => setCurrentView('admin')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer ${
              currentView === 'admin'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className={`material-symbols-outlined text-[20px] ${currentView === 'admin' ? 'fill' : ''}`}>
              admin_panel_settings
            </span>
            Administración
          </button>
        )}
      </nav>

      {/* User Role & Footer Actions */}
      <div className="mt-auto space-y-3 pt-4 border-t border-slate-100">
        {user ? (
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
              <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                user.role === 'Administrador' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {user.role}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer animate-pulse"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Iniciar Sesión
          </button>
        )}

        <button
          onClick={onExportData}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Exportar Datos
        </button>

        {user && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 text-xs font-medium cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Cerrar Sesión
          </button>
        )}
      </div>
    </aside>
  );
};
