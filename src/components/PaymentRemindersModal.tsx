import React, { useState } from 'react';
import { Client } from '../types';

interface PaymentRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onPayClient: (client: Client) => void;
  onAddDebtClient: (client: Client) => void;
  onViewStatement: (client: Client) => void;
}

export const PaymentRemindersModal: React.FC<PaymentRemindersModalProps> = ({
  isOpen,
  onClose,
  clients,
  onPayClient,
  onAddDebtClient,
  onViewStatement,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<string>('TODOS');
  const [statusFilter, setStatusFilter] = useState<'HOY_VENCIDO' | 'PROXIMOS' | 'TODOS'>('HOY_VENCIDO');

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter clients with debt (> 0) and active status
  const debtClients = clients.filter((c) => c.status === 'Activo' && c.currentBalance > 0);

  // Categorize based on due date
  const dueTodayOrOverdue = debtClients.filter((c) => {
    if (!c.nextDueDate) return false;
    return c.nextDueDate <= todayStr;
  });

  const upcoming7Days = debtClients.filter((c) => {
    if (!c.nextDueDate) return false;
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureStr = future.toISOString().split('T')[0];
    return c.nextDueDate > todayStr && c.nextDueDate <= futureStr;
  });

  // Filtered list for current selection
  let displayedClients = debtClients;
  if (statusFilter === 'HOY_VENCIDO') {
    displayedClients = dueTodayOrOverdue;
  } else if (statusFilter === 'PROXIMOS') {
    displayedClients = upcoming7Days;
  }

  if (filterPeriod !== 'TODOS') {
    displayedClients = displayedClients.filter((c) => c.paymentPeriod === filterPeriod);
  }

  // Send WhatsApp reminder helper
  const handleWhatsAppReminder = (client: Client) => {
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `Hola ${client.name}, le saludamos de CrediManage. Le recordamos amablemente que cuenta con un saldo pendiente de S/ ${client.currentBalance.toFixed(
        2
      )} PEN. Su fecha de pago programada (${client.paymentPeriod || 'Mensual'}) es ${
        client.nextDueDate || 'próxima'
      }. ¡Agradecemos su preferencia!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl my-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[24px]">notifications_active</span>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Recordatorios y Calendario de Cobranzas
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Gestión de fechas límite y periodos de cobro de clientes con deuda activa.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Top Summary Badges */}
        <div className="px-6 py-3 bg-slate-50/60 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <button
            onClick={() => setStatusFilter('HOY_VENCIDO')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'HOY_VENCIDO'
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">
                Cobrar Hoy / Vencidos
              </div>
              <div className="text-lg font-black text-rose-600 font-mono">
                {dueTodayOrOverdue.length} Clientes
              </div>
            </div>
            <span className="material-symbols-outlined text-rose-500 text-[24px]">priority_high</span>
          </button>

          <button
            onClick={() => setStatusFilter('PROXIMOS')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'PROXIMOS'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                Próximos 7 Días
              </div>
              <div className="text-lg font-black text-amber-700 font-mono">
                {upcoming7Days.length} Clientes
              </div>
            </div>
            <span className="material-symbols-outlined text-amber-600 text-[24px]">event_upcoming</span>
          </button>

          <button
            onClick={() => setStatusFilter('TODOS')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'TODOS'
                ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                Total con Deuda Activa
              </div>
              <div className="text-lg font-black text-indigo-700 font-mono">
                {debtClients.length} Clientes
              </div>
            </div>
            <span className="material-symbols-outlined text-indigo-600 text-[24px]">groups</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <span>Periodo de Pago:</span>
            <div className="flex gap-1">
              {['TODOS', 'Semanal', 'Quincenal', 'Mensual', 'Día Fijo'].map((period) => (
                <button
                  key={period}
                  onClick={() => setFilterPeriod(period)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    filterPeriod === period
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="text-slate-400 font-medium">
            Mostrando {displayedClients.length} de {debtClients.length} clientes pendientes
          </div>
        </div>

        {/* Client List Table */}
        <div className="overflow-y-auto flex-1 p-6">
          {displayedClients.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <span className="material-symbols-outlined text-slate-300 text-[48px] mb-2">
                check_circle
              </span>
              <p className="text-slate-700 font-bold text-sm">Sin cobranzas pendientes en este filtro</p>
              <p className="text-slate-400 text-xs mt-1">
                No hay clientes con deuda registrados para la categoría seleccionada.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedClients.map((client) => {
                const isOverdue = client.nextDueDate && client.nextDueDate < todayStr;
                const isToday = client.nextDueDate === todayStr;

                return (
                  <div
                    key={client.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isOverdue
                        ? 'bg-rose-50/50 border-rose-200/80 hover:bg-rose-50'
                        : isToday
                        ? 'bg-amber-50/50 border-amber-200/80 hover:bg-amber-50'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Left: Client Info & Due Status */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          {client.clientNumber}
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-sm">{client.name}</h4>

                        {/* Status badge */}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-extrabold">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            ¡Vencido!
                          </span>
                        )}
                        {isToday && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                            <span className="material-symbols-outlined text-[12px]">today</span>
                            ¡Cobrar Hoy!
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                        <span className="flex items-center gap-1 text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md">
                          <span className="material-symbols-outlined text-[14px]">event_repeat</span>
                          {client.paymentPeriod || 'Mensual'}: {client.paymentDay || 'No definido'}
                        </span>
                        {client.nextDueDate && (
                          <span className="font-mono text-slate-500">
                            Próximo cobro: <strong>{client.nextDueDate}</strong>
                          </span>
                        )}
                        {client.phone && (
                          <span className="flex items-center gap-1 text-slate-500 font-mono">
                            <span className="material-symbols-outlined text-[14px]">call</span>
                            {client.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Debt Amount */}
                    <div className="text-left md:text-right shrink-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Deuda Total
                      </div>
                      <div className="text-base font-black text-rose-600 font-mono">
                        S/ {client.currentBalance.toLocaleString('es-PE', { minimumFractionDigits: 2 })} PEN
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                      {client.phone && (
                        <button
                          onClick={() => handleWhatsAppReminder(client)}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Enviar Recordatorio por WhatsApp"
                        >
                          <span className="material-symbols-outlined text-[16px]">chat</span>
                          <span className="hidden sm:inline">WhatsApp</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          onPayClient(client);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">payments</span>
                        <span>Cobrar</span>
                      </button>

                      <button
                        onClick={() => {
                          onClose();
                          onAddDebtClient(client);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Añadir más deuda o cargo"
                      >
                        <span className="material-symbols-outlined text-[16px]">post_add</span>
                        <span className="hidden sm:inline">+ Deuda</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs shrink-0">
          <span className="text-slate-500 font-medium">
            CrediManage POS &bull; Módulo de Gestión de Cobranzas
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
