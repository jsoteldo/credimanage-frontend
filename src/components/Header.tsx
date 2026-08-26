import React, { useState } from 'react';
import { User } from '../types';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onNewClient: () => void;
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onNavigateToAdminSecret?: () => void;
  onFilterClientsWithDebt?: () => void;
  onViewPaymentsHistory?: () => void;
  todayPaymentsCount?: number;
  todayPaymentsTotal?: number;
  clientsAtLimitCount?: number;
  clientsAtLimitNames?: string[];
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onNewClient,
  user,
  onOpenLogin,
  onLogout,
  onNavigateToAdminSecret,
  onFilterClientsWithDebt,
  onViewPaymentsHistory,
  todayPaymentsCount = 0,
  todayPaymentsTotal = 0,
  clientsAtLimitCount = 0,
  clientsAtLimitNames = [],
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const getClientsAtLimitMessage = () => {
    if (clientsAtLimitCount === 0) {
      return "Ningún cliente requiere revisión de saldo actualmente.";
    }
    if (clientsAtLimitNames.length === 0) {
      return `${clientsAtLimitCount} cliente(s) requiere(n) revisión de saldo.`;
    }
    const maxNamesToShow = 2;
    const showingNames = clientsAtLimitNames.slice(0, maxNamesToShow);
    const extraCount = clientsAtLimitCount - showingNames.length;
    
    let namesStr = '';
    if (showingNames.length === 1) {
      namesStr = showingNames[0];
    } else if (showingNames.length === 2) {
      namesStr = `${showingNames[0]} y ${showingNames[1]}`;
    }
    
    if (extraCount > 0) {
      return `${namesStr} y ${extraCount} más requieren revisión de saldo.`;
    } else {
      return `${namesStr} requiere(n) revisión de saldo.`;
    }
  };

  return (
    <>
      <header className="flex justify-between items-center px-4 md:px-8 py-3 w-full sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 h-16 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
              POS
            </span>
            <span>CrediManage</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 relative">
          <div className="flex gap-1">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer relative"
              title="Notificaciones"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {user && (clientsAtLimitCount > 0 || todayPaymentsCount > 0) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              )}
            </button>

            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              title="Ayuda y Operaciones POS"
            >
              <span className="material-symbols-outlined text-[20px]">help</span>
            </button>
          </div>

          <button
            onClick={onNewClient}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs shadow-indigo-600/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nuevo Cliente
          </button>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative">
            {user ? (
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-1.5 p-1 rounded-full border border-slate-200 hover:ring-2 hover:ring-indigo-500/20 transition-all cursor-pointer"
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {user.name.charAt(0)}
                  </div>
                )}
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="bg-slate-100 text-slate-700 font-semibold text-xs px-3.5 py-2 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Iniciar Sesión
              </button>
            )}

            {/* Profile Menu Dropdown */}
            {showProfileMenu && user && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-lg py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="font-bold text-slate-900 text-xs">{user.name}</p>
                  <p className="text-slate-500 text-[11px] truncate">{user.email}</p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold text-[10px] rounded-full">
                    Rol: {user.role}
                  </span>
                </div>

                {/* Admin panel option hidden by request while retaining underlying functionality */}
                {/* {user.role === 'Administrador' && onNavigateToAdminSecret && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigateToAdminSecret();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-indigo-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-semibold"
                  >
                    <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                    Panel Administrativo
                  </button>
                )} */}

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant shadow-xl max-w-lg w-full p-lg">
            <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Manual Operativo CrediManage POS
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-sm font-body-md text-body-md text-on-surface">
              <p><strong>1. Buscar Cliente:</strong> Utilice la barra superior para buscar por nombre, teléfono o código CLI-XXXX.</p>
              <p><strong>2. Estado de Cuenta:</strong> Presione el icono <span className="material-symbols-outlined text-[16px] inline-block align-middle">visibility</span> en la tabla de clientes para ver el límite de crédito, compras y abonos.</p>
              <p><strong>3. Registrar Abono:</strong> Dentro del Estado de Cuenta, haga clic en "Registrar Abono" o "Liquidar Adeudo". Pre-visualizará el nuevo saldo antes de confirmar.</p>
              <p><strong>4. Reglas de Borrado:</strong> No se permite eliminar clientes con saldo diferente de 0. Para preservar el historial contable, el sistema desactiva automáticamente a clientes con movimientos.</p>
              <p><strong>5. Credenciales Demo:</strong></p>
              <ul className="list-disc pl-md text-body-sm text-secondary">
                <li>Administrador: <code>admin@credimanage.pos</code> / <code>admin123</code></li>
                <li>Cajero: <code>cajero@credimanage.pos</code> / <code>cajero123</code></li>
              </ul>
            </div>
            <div className="mt-lg flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="bg-primary text-on-primary px-md py-sm rounded font-label-md text-label-md cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      {showNotifications && (
        <div className="absolute right-4 md:right-8 top-16 w-80 bg-white rounded-2xl border border-slate-200/80 shadow-xl p-4 z-50">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <h4 className="font-bold text-xs text-slate-900">Notificaciones del Sistema</h4>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs font-semibold"
            >
              Cerrar
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <button
              onClick={() => {
                setShowNotifications(false);
                if (onFilterClientsWithDebt) onFilterClientsWithDebt();
              }}
              className="w-full text-left p-2.5 bg-rose-50 hover:bg-rose-100/90 text-rose-900 rounded-xl border border-rose-200/80 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <p className="font-bold group-hover:underline">
                  {clientsAtLimitCount} {clientsAtLimitCount === 1 ? 'Cliente' : 'Clientes'} al límite de crédito
                </p>
                <span className="material-symbols-outlined text-[16px] text-rose-600 group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">{getClientsAtLimitMessage()}</p>
            </button>

            <button
              onClick={() => {
                setShowNotifications(false);
                if (onViewPaymentsHistory) onViewPaymentsHistory();
              }}
              className="w-full text-left p-2.5 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-900 rounded-xl border border-emerald-200/80 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <p className="font-bold group-hover:underline">
                  {todayPaymentsCount} {todayPaymentsCount === 1 ? 'Abono registrado' : 'Abonos registrados'} hoy
                </p>
                <span className="material-symbols-outlined text-[16px] text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Total acumulado en caja: S/ {todayPaymentsTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Soles Peruanos.
              </p>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
