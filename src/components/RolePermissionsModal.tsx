import React, { useState, useEffect } from 'react';
import { Role, Permission } from '../types';
import { api } from '../services/api';

interface RolePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionsUpdated?: () => void;
}

export const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({
  isOpen,
  onClose,
  onPermissionsUpdated,
}) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load roles & permissions on open
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedRoles, fetchedPerms] = await Promise.all([
        api.getRoles(),
        api.getAllPermissions(),
      ]);
      setRoles(fetchedRoles);
      setPermissions(fetchedPerms);

      // Default select Cajero or first role
      const defaultRole =
        fetchedRoles.find((r) => r.name === 'Cajero') ||
        fetchedRoles[0] ||
        null;

      if (defaultRole) {
        setSelectedRoleId(defaultRole.id);
        const codes = new Set(
          (defaultRole.permissions || []).map((rp) => rp.permission.code),
        );
        setSelectedPermissionCodes(codes);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar roles y permisos');
    } finally {
      setLoading(false);
    }
  };

  // Switch selected role
  const handleSelectRole = (role: Role) => {
    setSelectedRoleId(role.id);
    const codes = new Set(
      (role.permissions || []).map((rp) => rp.permission.code),
    );
    setSelectedPermissionCodes(codes);
    setError(null);
    setSuccessMessage(null);
  };

  // Toggle single permission checkbox
  const handleTogglePermission = (code: string) => {
    setSelectedPermissionCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
    setSuccessMessage(null);
  };

  // Select / Deselect all in module
  const handleToggleModule = (modulePerms: Permission[]) => {
    const allChecked = modulePerms.every((p) => selectedPermissionCodes.has(p.code));
    setSelectedPermissionCodes((prev) => {
      const next = new Set(prev);
      modulePerms.forEach((p) => {
        if (allChecked) {
          next.delete(p.code);
        } else {
          next.add(p.code);
        }
      });
      return next;
    });
    setSuccessMessage(null);
  };

  // Save updated permissions for current role
  const handleSave = async () => {
    if (!selectedRoleId || saving) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedRole = await api.updateRolePermissions(
        selectedRoleId,
        Array.from(selectedPermissionCodes),
      );

      // Update in local roles list
      setRoles((prev) =>
        prev.map((r) => (r.id === updatedRole.id ? updatedRole : r)),
      );

      setSuccessMessage('Permisos actualizados correctamente para el rol seleccionado.');
      onPermissionsUpdated?.();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error al guardar permisos del rol');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentRole = roles.find((r) => r.id === selectedRoleId);

  // Group permissions logically: Cash first, then Sales, Inventory, Catalog, Admin
  const moduleOrder = ['cash', 'sales', 'inventory', 'catalog', 'admin'];
  const moduleLabels: Record<string, { label: string; icon: string; description: string }> = {
    cash: {
      label: 'Caja',
      icon: 'point_of_sale',
      description: 'Control de apertura, cierre, ingresos y retiros de efectivo en gaveta',
    },
    sales: {
      label: 'Ventas',
      icon: 'receipt_long',
      description: 'Emisión, consulta y anulación de ventas en terminales POS',
    },
    inventory: {
      label: 'Inventario',
      icon: 'inventory_2',
      description: 'Gestión de existencias, entradas, ajustes y traslados de almacén',
    },
    catalog: {
      label: 'Productos y Catálogo',
      icon: 'category',
      description: 'Catálogo de artículos, categorías y maestros de proveedores',
    },
    admin: {
      label: 'Administración y Sedes',
      icon: 'store',
      description: 'Configuración general de tiendas, almacenes y parámetros de sistema',
    },
  };

  const groupedPermissions: Record<string, Permission[]> = {};
  permissions.forEach((p) => {
    const mod = p.module || 'other';
    if (!groupedPermissions[mod]) {
      groupedPermissions[mod] = [];
    }
    groupedPermissions[mod].push(p);
  });

  const sortedModules = Object.keys(groupedPermissions).sort((a, b) => {
    const idxA = moduleOrder.indexOf(a);
    const idxB = moduleOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <span className="material-symbols-outlined text-[24px]">shield_person</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Permisos del Sistema por Rol
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Configure los permisos explícitos de Caja y módulos operativos para cada perfil.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Notifications */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-start space-x-2">
              <span className="material-symbols-outlined text-base mt-0.5 text-rose-500">error</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl flex items-start space-x-2">
              <span className="material-symbols-outlined text-base mt-0.5 text-emerald-600">check_circle</span>
              <span className="flex-1">{successMessage}</span>
            </div>
          )}

          {/* Role Selector Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Seleccionar Rol a Configurar:
            </label>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => {
                const isSelected = r.id === selectedRoleId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {r.name === 'Administrador' ? 'admin_panel_settings' : r.name === 'Cajero' ? 'storefront' : 'badge'}
                    </span>
                    <span>{r.name}</span>
                    {r._count?.users !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {r._count.users} {r._count.users === 1 ? 'usuario' : 'usuarios'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role Context Helper Banner */}
          {currentRole && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-indigo-600 text-lg mt-0.5">info</span>
              <div className="flex-1">
                {currentRole.name === 'Cajero' ? (
                  <p className="leading-relaxed">
                    <strong>Rol Cajero:</strong> Opera turnos de venta y caja. Por seguridad, los retiros de efectivo (
                    <code className="text-rose-700 bg-rose-50 px-1 py-0.5 rounded font-mono text-[11px]">cash.cash_out</code>) y los ingresos manuales (
                    <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono text-[11px]">cash.cash_in</code>) son independientes y requieren asignación explícita.
                  </p>
                ) : currentRole.name === 'Administrador' ? (
                  <p className="leading-relaxed">
                    <strong>Rol Administrador:</strong> Posee autorización completa en el sistema por defecto. Puede personalizar qué operaciones aplican a este perfil.
                  </p>
                ) : (
                  <p className="leading-relaxed">
                    <strong>Rol {currentRole.name}:</strong> Perfil configurable para operadores y personal de soporte.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Grouped Permissions Matrix */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-2xl text-indigo-500">progress_activity</span>
              <span>Cargando matriz de permisos...</span>
            </div>
          ) : (
            <div className="space-y-5">
              {sortedModules.map((modKey) => {
                const perms = groupedPermissions[modKey] || [];
                const meta = moduleLabels[modKey] || {
                  label: modKey.toUpperCase(),
                  icon: 'lock',
                  description: 'Permisos del módulo',
                };
                const allModuleChecked = perms.every((p) => selectedPermissionCodes.has(p.code));
                const someModuleChecked = perms.some((p) => selectedPermissionCodes.has(p.code));

                return (
                  <div
                    key={modKey}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      modKey === 'cash'
                        ? 'border-indigo-200 bg-indigo-50/20 shadow-2xs'
                        : 'border-slate-200/80 bg-white'
                    }`}
                  >
                    {/* Module Header */}
                    <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[20px] text-indigo-600">
                          {meta.icon}
                        </span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span>{meta.label}</span>
                            {modKey === 'cash' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-bold uppercase tracking-normal">
                                Módulo Caja
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {meta.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleModule(perms)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer px-2 py-1 rounded hover:bg-indigo-50"
                      >
                        {allModuleChecked ? 'Desmarcar todos' : 'Marcar todos'}
                      </button>
                    </div>

                    {/* Permission Items List */}
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {perms.map((perm) => {
                        const isChecked = selectedPermissionCodes.has(perm.code);
                        return (
                          <label
                            key={perm.id || perm.code}
                            className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer select-none ${
                              isChecked
                                ? 'bg-white border-indigo-200 shadow-2xs'
                                : 'bg-slate-50/50 border-slate-200/70 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(perm.code)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900 block truncate">
                                  {perm.name}
                                </span>
                              </div>
                              {perm.description && (
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                  {perm.description}
                                </p>
                              )}
                              <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                                {perm.code}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Permisos marcados: <strong className="text-slate-900">{selectedPermissionCodes.size}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedRoleId}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Guardar Permisos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
