import React, { useState, useEffect } from 'react';
import { User, AuditLog, CreditPurchase, Payment, Client } from '../types';
import { api } from '../services/api';

interface AdminPanelProps {
  currentUser: User | null;
  onNavigateToClients: () => void;
  onNavigateToReports: () => void;
  onViewStatement: (client: Client) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  onNavigateToClients,
  onNavigateToReports,
  onViewStatement,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'users' | 'annulled' | 'portfolio' | 'pending_payments'>('audit');
  
  // Data state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [annulledOps, setAnnulledOps] = useState<{
    annulledPurchases: CreditPurchase[];
    annulledPayments: Payment[];
  }>({ annulledPurchases: [], annulledPayments: [] });
  const [portfolioData, setPortfolioData] = useState<Client[]>([]);

  // User form modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Administrador' | 'Cajero' | 'Generico'>('Cajero');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserApproved, setNewUserApproved] = useState(true);
  const [newUserActive, setNewUserActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'audit') {
        const logs = await api.getAuditLogs();
        setAuditLogs(logs);
      } else if (activeTab === 'users') {
        const usrList = await api.getUsers();
        setUsers(usrList);
      } else if (activeTab === 'annulled') {
        const ann = await api.getAnnulledOperations();
        setAnnulledOps(ann);
      } else if (activeTab === 'portfolio') {
        const res = await api.getClients();
        setPortfolioData(res);
      } else if (activeTab === 'pending_payments') {
        const pends = await api.getPendingPayments();
        setPendingPayments(pends);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos administrativos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    try {
      await api.createUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        password: newUserPassword ? newUserPassword : undefined,
        approved: newUserApproved,
        active: newUserActive,
      });
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('Cajero');
      setNewUserPassword('');
      setNewUserApproved(true);
      setNewUserActive(true);
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Error al crear usuario');
    }
  };

  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const nextRole = currentRole === 'Administrador' ? 'Cajero' : 'Administrador';
    try {
      await api.updateUserPermissions(userId, { role: nextRole });
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar rol');
    }
  };

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      await api.updateUserPermissions(userId, { active: !currentActive });
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado de usuario');
    }
  };

  if (!currentUser || currentUser.role !== 'Administrador') {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 bg-white rounded-2xl border border-rose-200 shadow-xl text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center font-bold">
          <span className="material-symbols-outlined text-[28px]">admin_panel_settings</span>
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">Acceso Restringido</h2>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Esta sección está protegida y destinada exclusivamente a usuarios con rol de <strong>Administrador</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1440px] mx-auto w-full space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">shield_person</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Panel Administrativo
            </h2>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Control de usuarios, bitácora de operaciones sensibles, auditoría y cancelación de abonos.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onNavigateToClients}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            Gestión Clientes
          </button>
          <button
            onClick={onNavigateToReports}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            Reporte Saldos
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-100/90 rounded-2xl p-1.5 flex flex-wrap gap-1 border border-slate-200/70">
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/70 font-semibold'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          Bitácora de Auditoría ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/70 font-semibold'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
          Usuarios del Sistema y Permisos
        </button>

        <button
          onClick={() => setActiveTab('pending_payments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
            activeTab === 'pending_payments'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/70 font-semibold'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">pending_actions</span>
          Aprobación de Abonos
        </button>

        <button
          onClick={() => setActiveTab('annulled')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
            activeTab === 'annulled'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/70 font-semibold'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">block</span>
          Operaciones Anuladas
        </button>

        <button
          onClick={() => setActiveTab('portfolio')}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
            activeTab === 'portfolio'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/70 font-semibold'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          Consultas de Deuda & Saldos a Favor
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 text-xs font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Bitácora de Auditoría */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50/70 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Bitácora de Operaciones Sensibles (Audit Trail)
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Historial cronológico completo e inalterable de acciones realizadas por el personal.
              </p>
            </div>
            <button
              onClick={loadAdminData}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all cursor-pointer"
              title="Actualizar bitácora"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Fecha y Hora</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Usuario</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Rol</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Acción Registrada</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Detalle de la Operación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                      No hay registros de auditoría disponibles.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('es-PE')}
                      </td>
                      <td className="py-3 px-5 font-bold text-slate-900 whitespace-nowrap">
                        {log.userName}
                      </td>
                      <td className="py-3 px-5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          log.userRole === 'Administrador'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {log.userRole}
                        </span>
                      </td>
                      <td className="py-3 px-5 font-mono font-extrabold text-indigo-600 whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="py-3 px-5 text-slate-700 font-medium leading-relaxed">
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Operaciones de Usuarios */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Administración de Usuarios y Permisos
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Configure roles de acceso al sistema POS, apruebe registros públicos y habilite/deshabilite cuentas.
              </p>
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Nuevo Usuario
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Usuario</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Correo Electrónico</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Rol / Permisos</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Aprobación</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Estado</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((usr) => (
                  <tr key={usr.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black border border-indigo-100">
                          {usr.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900">{usr.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 font-mono text-slate-600">
                      {usr.email}
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        usr.role === 'Administrador'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : usr.role === 'Cajero'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>
                        {usr.role}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        usr.approved
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {usr.approved ? 'Aprobado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        usr.active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {usr.active ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex justify-end gap-2">
                        {!usr.approved && (
                          <button
                            onClick={async () => {
                              try {
                                await api.approveUser(usr.id);
                                await loadAdminData();
                              } catch (err: any) {
                                alert(err.message || 'Error al aprobar usuario');
                              }
                            }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Aprobar
                          </button>
                        )}
                        <select
                          value={usr.role}
                          onChange={async (e) => {
                            try {
                              await api.updateUser(usr.id, { role: e.target.value });
                              await loadAdminData();
                            } catch (err: any) {
                              alert(err.message || 'Error al actualizar rol');
                            }
                          }}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                        >
                          <option value="Administrador">Administrador</option>
                          <option value="Cajero">Cajero</option>
                          <option value="Generico">Generico</option>
                        </select>
                        <button
                          onClick={async () => {
                            try {
                              if (usr.active) {
                                await api.disableUser(usr.id);
                              } else {
                                await api.enableUser(usr.id);
                              }
                              await loadAdminData();
                            } catch (err: any) {
                              alert(err.message || 'Error al cambiar estado');
                            }
                          }}
                          className={`px-3 py-1 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                            usr.active
                              ? 'text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100'
                              : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {usr.active ? 'Deshabilitar' : 'Habilitar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Operaciones Anuladas */}
      {activeTab === 'annulled' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50/70 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-base">
              Historial de Abonos Anulados
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Registro de abonos revertidos con auditoría del usuario responsable y motivo.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Fecha Anulación</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">ID Abono</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Importe Revertido</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Anulado Por</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Motivo Especificado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {annulledOps.annulledPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                      No hay abonos anulados en el historial.
                    </td>
                  </tr>
                ) : (
                  annulledOps.annulledPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5 font-mono text-slate-500">
                        {p.annulledAt ? new Date(p.annulledAt).toLocaleString('es-PE') : 'N/A'}
                      </td>
                      <td className="py-3 px-5 font-mono font-bold text-slate-900">{p.id}</td>
                      <td className="py-3 px-5 font-mono text-right font-black text-rose-600">
                        S/ {p.amount.toFixed(2)} PEN
                      </td>
                      <td className="py-3 px-5 font-bold text-slate-800">{p.annulledBy || 'Admin'}</td>
                      <td className="py-3 px-5 text-slate-600 font-medium">{p.annulmentReason || 'Sin motivo'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Consultas de Deuda & Saldos a Favor */}
      {activeTab === 'portfolio' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Auditoría de Deudores y Clientes con Saldo a Favor
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Supervisión de balances globales de la cartera de clientes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-rose-50/80 rounded-2xl border border-rose-200/80">
              <h4 className="text-xs font-extrabold text-rose-700 uppercase tracking-wider mb-1">CLIENTES CON DEUDA PENDIENTE</h4>
              <p className="text-2xl font-black text-slate-900 font-mono">
                {portfolioData.filter((c) => c.currentBalance > 0).length} clientes
              </p>
              <p className="text-xs font-bold text-rose-800 mt-1">
                Total acumulado por cobrar: S/ {portfolioData
                  .filter((c) => c.currentBalance > 0)
                  .reduce((sum, c) => sum + c.currentBalance, 0)
                  .toLocaleString('es-PE', { minimumFractionDigits: 2 })} PEN
              </p>
            </div>

            <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-200/80">
              <h4 className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider mb-1">CLIENTES CON SALDO A FAVOR</h4>
              <p className="text-2xl font-black text-slate-900 font-mono">
                {portfolioData.filter((c) => c.currentBalance < 0).length} clientes
              </p>
              <p className="text-xs font-bold text-indigo-800 mt-1">
                Total en saldo a favor (anticipos): S/ {Math.abs(
                  portfolioData
                    .filter((c) => c.currentBalance < 0)
                    .reduce((sum, c) => sum + c.currentBalance, 0)
                ).toLocaleString('es-PE', { minimumFractionDigits: 2 })} PEN
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Teléfono</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Saldo Actual</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">Condición Auditoría</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {portfolioData.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-5 font-bold text-slate-900">{c.name} ({c.clientNumber})</td>
                    <td className="py-3 px-5 font-mono text-slate-500">{c.phone || 'N/A'}</td>
                    <td className={`py-3 px-5 font-mono font-black text-right ${c.currentBalance > 0 ? 'text-rose-600' : c.currentBalance < 0 ? 'text-indigo-600' : 'text-slate-500'}`}>
                      S/ {c.currentBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-5 text-center">
                      {c.currentBalance > 0 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-extrabold text-[10px] border border-rose-200">
                          Requiere Cobro
                        </span>
                      ) : c.currentBalance < 0 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-[10px] border border-indigo-200">
                          Saldo a Favor
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[10px] border border-emerald-200">
                          Cuenta Saldada (S/ 0.00)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => onViewStatement(c)}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        Ver Estado
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Aprobación de Abonos Pendientes */}
      {activeTab === 'pending_payments' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50/70 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Abonos Registrados por Cajeros Pendientes de Aprobación
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Revise y apruebe o rechace abonos para actualizar los saldos reales de los clientes.
              </p>
            </div>
            <button
              onClick={loadAdminData}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all cursor-pointer"
              title="Actualizar abonos pendientes"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Fecha y Hora</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Monto</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Registrado Por</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Notas / Detalles</th>
                  <th className="py-3 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pendingPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                      No hay abonos pendientes de aprobación en este momento.
                    </td>
                  </tr>
                ) : (
                  pendingPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(p.date).toLocaleString('es-PE')}
                      </td>
                      <td className="py-3 px-5 font-bold text-slate-900 whitespace-nowrap">
                        {p.client?.name || 'Cliente Desconocido'} ({p.client?.clientNumber || 'N/A'})
                      </td>
                      <td className="py-3 px-5 font-mono text-right font-black text-emerald-600 whitespace-nowrap">
                        S/ {p.amount.toFixed(2)} PEN
                      </td>
                      <td className="py-3 px-5 font-medium text-slate-700 whitespace-nowrap">
                        {p.registeredBy}
                      </td>
                      <td className="py-3 px-5 text-slate-600 font-medium">
                        {p.notes || 'Abono registrado'}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={async () => {
                              if (window.confirm('¿Está seguro de aprobar este abono de S/ ' + p.amount.toFixed(2) + '?')) {
                                try {
                                  await api.approvePayment(p.id);
                                  await loadAdminData();
                                } catch (err: any) {
                                  alert(err.message || 'Error al aprobar abono');
                                }
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={async () => {
                              const reason = window.prompt('Ingrese el motivo del rechazo del abono:');
                              if (reason !== null) {
                                try {
                                  await api.rejectPayment(p.id, reason);
                                  await loadAdminData();
                                } catch (err: any) {
                                  alert(err.message || 'Error al rechazar abono');
                                }
                              }
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New User */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-900 text-base">Añadir Usuario del Sistema</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ana Beltrán"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  placeholder="usuario@credimanage.pos"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Rol de Acceso *</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="Cajero">Cajero / Operador POS</option>
                  <option value="Administrador">Administrador del Sistema</option>
                  <option value="Generico">Generico</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Contraseña (Por defecto '123456')</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full h-10 px-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUserApproved}
                    onChange={(e) => setNewUserApproved(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-indigo-500"
                  />
                  Aprobado
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUserActive}
                    onChange={(e) => setNewUserActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-indigo-500"
                  />
                  Habilitado
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

