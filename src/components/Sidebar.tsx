import React from 'react';
import { User, CurrentView } from '../types';

interface SidebarProps {
  currentView: CurrentView;
  setCurrentView: (view: CurrentView) => void;
  user: User | null;
  onLogout: () => void;
  onExportData: () => void;
  onOpenLogin: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  user,
  onLogout,
  onExportData,
  onOpenLogin,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const handleNavClick = (view: CurrentView) => {
    setCurrentView(view);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  // Shared Nav Links definitions
  const navItems: { id: CurrentView; label: string; icon: string; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Inicio', icon: 'dashboard' },
    { id: 'clients', label: 'Clientes', icon: 'group' },
    { id: 'debt', label: 'Deuda', icon: 'shopping_bag' },
    { id: 'bank', label: 'Banco', icon: 'account_balance' },
    { id: 'reports', label: 'Reportes', icon: 'analytics' },
    { id: 'admin', label: 'Administración', icon: 'admin_panel_settings', adminOnly: true },
  ];

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. DESKTOP SIDEBAR (Collapsible between w-64 and w-20)                    */}
      {/* ========================================================================= */}
      <aside
        className={`hidden md:flex flex-col h-screen fixed left-0 top-0 py-6 bg-white/95 backdrop-blur-md border-r border-slate-200/80 shadow-xs z-40 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20 px-2' : 'w-64 px-4'
        }`}
      >
        {/* Business Logo & Collapse Control */}
        <div className={`mb-8 flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between px-3'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20 shrink-0">
              <span className="material-symbols-outlined text-[24px]">point_of_sale</span>
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="font-extrabold text-slate-900 text-lg leading-tight tracking-tight truncate">
                  CrediManage
                </h1>
                <p className="text-xs font-medium text-slate-500">POS & Crédito</p>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ${
                isCollapsed ? 'mt-1' : ''
              }`}
              title={isCollapsed ? 'Desplegar barra lateral' : 'Contraer barra lateral'}
              aria-label={isCollapsed ? 'Desplegar barra lateral' : 'Contraer barra lateral'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isCollapsed ? 'chevron_right' : 'chevron_left'}
              </span>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            if (item.adminOnly && (!user || user.role !== 'Administrador')) {
              return null;
            }

            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5'
                } ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>
                  {item.icon}
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Role & Footer Actions */}
        <div className="mt-auto space-y-3 pt-4 border-t border-slate-100">
          {user ? (
            isCollapsed ? (
              <div
                className="w-10 h-10 mx-auto rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-2xs"
                title={`${user.name} (${user.role})`}
              >
                {user.name.charAt(0)}
              </div>
            ) : (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      user.role === 'Administrador'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              </div>
            )
          ) : (
            <button
              onClick={onOpenLogin}
              title={isCollapsed ? 'Iniciar Sesión' : undefined}
              className={`w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer animate-pulse ${
                isCollapsed ? 'p-2.5' : 'py-2.5'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              {!isCollapsed && <span>Iniciar Sesión</span>}
            </button>
          )}

          {/* Export Data */}
          <button
            onClick={onExportData}
            title={isCollapsed ? 'Exportar Datos' : undefined}
            className={`w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-100 transition-colors cursor-pointer ${
              isCollapsed ? 'p-2.5' : 'py-2'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {!isCollapsed && <span>Exportar Datos</span>}
          </button>

          {/* Logout */}
          {user && (
            <button
              onClick={onLogout}
              title={isCollapsed ? 'Cerrar Sesión' : undefined}
              className={`w-full flex items-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 text-xs font-medium cursor-pointer ${
                isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              {!isCollapsed && <span>Cerrar Sesión</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE DRAWER (Slide-over drawer with backdrop, Req 11)                */}
      {/* ========================================================================= */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col p-6 shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {/* Header with Close */}
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base leading-tight">
                    CrediManage
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500">POS & Crédito</p>
                </div>
              </div>

              <button
                onClick={onCloseMobile}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                title="Cerrar menú lateral"
                aria-label="Cerrar menú lateral"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                if (item.adminOnly && (!user || user.role !== 'Administrador')) {
                  return null;
                }

                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[20px] ${isActive ? 'fill' : ''}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Footer Actions */}
            <div className="mt-auto space-y-3 pt-4 border-t border-slate-100 shrink-0">
              {user && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        user.role === 'Administrador'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  onExportData();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                <span>Exportar Datos</span>
              </button>

              {user && (
                <button
                  onClick={() => {
                    onLogout();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors text-xs font-medium cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
