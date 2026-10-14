import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Location,
  CashRegister,
  CashSession,
  CashSessionSummary,
  CashMovement,
  CashMovementType,
  SalePaymentMethod,
} from '../../types';
import { api } from '../../services/api';
import { PageHeader } from '../PageHeader';
import { KpiGrid, KpiCard } from '../KpiCard';
import { OpenCashModal } from './OpenCashModal';
import { CloseCashModal } from './CloseCashModal';
import { CashMovementModal } from './CashMovementModal';
import { SessionDetailModal } from './SessionDetailModal';
import { canCashIn, canCashOut } from '../../utils/permissions';

interface CashViewProps {
  currentUser: User | null;
  stores: Location[];
  onNavigateToStoreRegisters?: (storeId: string) => void;
}

export const CashView: React.FC<CashViewProps> = ({
  currentUser,
  stores,
  onNavigateToStoreRegisters,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'registers'>('current');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  // Current session state
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [sessionSummary, setSessionSummary] = useState<CashSessionSummary | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState<boolean>(true);

  // Movements state
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState<boolean>(false);
  const [movementFilterType, setMovementFilterType] = useState<string>('all');
  const [movementFilterMethod, setMovementFilterMethod] = useState<string>('all');

  // History state
  const [historySessions, setHistorySessions] = useState<CashSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyTotalPages, setHistoryTotalPages] = useState<number>(1);

  // Registers state (Admin)
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loadingRegisters, setLoadingRegisters] = useState<boolean>(false);
  const [newRegCode, setNewRegCode] = useState<string>('');
  const [newRegName, setNewRegName] = useState<string>('');
  const [creatingRegister, setCreatingRegister] = useState<boolean>(false);

  // Modals state
  const [isOpenModalOpen, setIsOpenModalOpen] = useState<boolean>(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState<boolean>(false);
  const [movementModalType, setMovementModalType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [selectedHistorySessionId, setSelectedHistorySessionId] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const isAdmin = currentUser?.role === 'Administrador';
  const allowCashIn = canCashIn(currentUser);
  const allowCashOut = canCashOut(currentUser);

  // Initialize selected store
  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load current session
  const loadCurrentSession = useCallback(async () => {
    setLoadingCurrent(true);
    try {
      const sess = await api.getCurrentCashSession(selectedStoreId || undefined);
      setCurrentSession(sess);
      if (sess) {
        const sum = await api.getCashSessionSummary(sess.id);
        setSessionSummary(sum);
        loadSessionMovements(sess.id);
      } else {
        setSessionSummary(null);
        setMovements([]);
      }
    } catch {
      showToast('Error al cargar la sesión activa de caja', 'error');
    } finally {
      setLoadingCurrent(false);
    }
  }, [selectedStoreId]);

  // Load movements for current session
  const loadSessionMovements = async (sessionId: string) => {
    setLoadingMovements(true);
    try {
      const data = await api.getCashMovements({
        cashSessionId: sessionId,
        type: movementFilterType !== 'all' ? movementFilterType : undefined,
        paymentMethod: movementFilterMethod !== 'all' ? movementFilterMethod : undefined,
        limit: 100,
      });
      setMovements(data.items);
    } catch {
      // silently handle
    } finally {
      setLoadingMovements(false);
    }
  };

  // Load history
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await api.getCashSessionsHistory({
        storeId: selectedStoreId || undefined,
        page: historyPage,
        limit: 15,
      });
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? (data as any)
        : [];
      setHistorySessions(items);
      setHistoryTotalPages(data?.pagination?.totalPages || 1);
    } catch {
      showToast('Error al cargar el historial de turnos', 'error');
      setHistorySessions([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedStoreId, historyPage]);

  // Load registers
  const loadRegisters = useCallback(async () => {
    if (!selectedStoreId) return;
    setLoadingRegisters(true);
    try {
      const data = await api.getCashRegisters(selectedStoreId);
      setRegisters(data);
    } catch {
      showToast('Error al cargar las cajas de la tienda', 'error');
    } finally {
      setLoadingRegisters(false);
    }
  }, [selectedStoreId]);

  // Initial load
  useEffect(() => {
    if (activeTab === 'current') {
      loadCurrentSession();
    } else if (activeTab === 'history') {
      loadHistory();
    } else if (activeTab === 'registers') {
      loadRegisters();
    }
  }, [activeTab, selectedStoreId, loadCurrentSession, loadHistory, loadRegisters]);

  // Reload movements if filter changes
  useEffect(() => {
    if (currentSession && activeTab === 'current') {
      loadSessionMovements(currentSession.id);
    }
  }, [movementFilterType, movementFilterMethod]);

  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId || !newRegCode.trim() || !newRegName.trim() || creatingRegister) return;
    setCreatingRegister(true);
    try {
      await api.createCashRegister({
        storeId: selectedStoreId,
        code: newRegCode.trim(),
        name: newRegName.trim(),
      });
      setNewRegCode('');
      setNewRegName('');
      showToast('Caja registrada exitosamente');
      loadRegisters();
    } catch (err: any) {
      showToast(err.message || 'Error al crear la caja', 'error');
    } finally {
      setCreatingRegister(false);
    }
  };

  const handleToggleRegisterStatus = async (reg: CashRegister) => {
    const nextStatus = reg.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.updateCashRegister(reg.id, { status: nextStatus });
      showToast(`Caja ${nextStatus === 'ACTIVE' ? 'activada' : 'desactivada'}`);
      loadRegisters();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar estado de la caja', 'error');
    }
  };

  const formatMoney = (val?: number | string | null) => `S/ ${Number(val || 0).toFixed(2)}`;

  const formatDateTime = (val?: string | Date | null) => {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleString('es-PE', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center space-x-3 text-sm font-semibold transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          <span className="material-symbols-outlined">
            {notification.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        icon="point_of_sale"
        iconBgClass="bg-indigo-600"
        title="Gestión de Caja & Turnos"
        subtitle="Control de arqueo, movimientos, efectivo en gaveta y cierre diario."
        actions={
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="material-symbols-outlined text-[18px] text-slate-400">store</span>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Tienda:
            </label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-transparent border-none text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code || 'S/C'})
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('current')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'current'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">storefront</span>
          <span>Turno Actual</span>
          {currentSession && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          <span>Historial de Cierres</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('registers')}
            className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'registers'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Cajas por Tienda</span>
          </button>
        )}
      </div>

      {/* TAB 1: CURRENT SESSION */}
      {activeTab === 'current' && (
        <div className="space-y-6">
          {loadingCurrent ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <span className="material-symbols-outlined animate-spin text-4xl text-indigo-600">
                progress_activity
              </span>
              <p className="text-xs font-bold text-slate-500">Verificando estado de caja...</p>
            </div>
          ) : !currentSession ? (
            /* NO OPEN SESSION BANNER */
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-xs text-center max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs border border-amber-200/60">
                <span className="material-symbols-outlined text-3xl">lock</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">
                No tienes un turno de caja abierto
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Para registrar ventas en el POS, cobrar en efectivo o procesar pagos presenciales,
                debes abrir un turno indicando el fondo inicial de la gaveta.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpenModalOpen(true)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs shadow-indigo-600/30 transition-all flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">lock_open</span>
                  <span>Abrir Turno de Caja</span>
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE SESSION VIEW */
            <>
              {/* Active Session Info Banner */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      TURNO EN CURSO
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Abierto:{' '}
                      {new Date(currentSession.openedAt).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {currentSession.cashRegister?.name || 'Caja 01'}{' '}
                    <span className="text-slate-300 font-light">·</span>{' '}
                    <span className="text-indigo-600 font-bold text-xl">
                      {currentSession.store?.name}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
                    <span>Cajero: <strong className="text-slate-700 font-semibold">{currentSession.openedByUser?.name || 'Usuario'}</strong></span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span>Fondo Inicial: <strong className="font-mono font-bold text-slate-800">{formatMoney(currentSession.openingCashAmount)}</strong></span>
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!allowCashIn}
                    title={!allowCashIn ? 'No tienes permiso para registrar ingresos manuales de caja.' : undefined}
                    onClick={() => {
                      if (!allowCashIn) return;
                      setMovementModalType('CASH_IN');
                      setIsMovementModalOpen(true);
                    }}
                    className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                      !allowCashIn ? 'opacity-40 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : 'cursor-pointer'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Ingreso</span>
                  </button>

                  <button
                    type="button"
                    disabled={!allowCashOut}
                    title={!allowCashOut ? 'No tienes permiso para registrar retiros de caja.' : undefined}
                    onClick={() => {
                      if (!allowCashOut) return;
                      setMovementModalType('CASH_OUT');
                      setIsMovementModalOpen(true);
                    }}
                    className={`px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${
                      !allowCashOut ? 'opacity-40 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : 'cursor-pointer'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                    <span>Retiro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCloseModalOpen(true)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                    <span>Arqueo / Cerrar Turno</span>
                  </button>
                </div>
              </div>

              {/* Main Financial KPI Cards */}
              <KpiGrid>
                {/* 1. Physical Cash Expected */}
                <KpiCard
                  title="Efectivo Esperado en Gaveta"
                  value={formatMoney(sessionSummary?.expectedCashAmount)}
                  subtitle={`Inicial: ${formatMoney(sessionSummary?.openingCash)} · Efec: +${formatMoney(sessionSummary?.cashSales)} · Mov: ${
                    (sessionSummary?.cashIn || 0) - (sessionSummary?.cashOut || 0) >= 0 ? '+' : ''
                  }${formatMoney((sessionSummary?.cashIn || 0) - (sessionSummary?.cashOut || 0))}`}
                  icon="point_of_sale"
                  iconBgClass="bg-emerald-50"
                  iconColorClass="text-emerald-600"
                  valueColorClass="text-emerald-700"
                  subtitleColorClass="text-slate-500"
                  isMono
                />

                {/* 2. Total Turn Sales */}
                <KpiCard
                  title="Total Ventas del Turno"
                  value={formatMoney(sessionSummary?.totalSalesAmount)}
                  subtitle={`${sessionSummary?.salesCount || 0} comprobantes emitidos en este turno`}
                  icon="receipt_long"
                  iconBgClass="bg-indigo-50"
                  iconColorClass="text-indigo-600"
                  valueColorClass="text-slate-900"
                  isMono
                />

                {/* 3. Credit Sales */}
                <KpiCard
                  title="Ventas a Crédito (Deuda)"
                  value={formatMoney(sessionSummary?.creditSales)}
                  subtitle="Genera cuenta por cobrar (no ingresa efectivo)"
                  icon="shopping_bag"
                  iconBgClass="bg-rose-50"
                  iconColorClass="text-rose-600"
                  valueColorClass="text-rose-600"
                  subtitleColorClass="text-rose-600"
                  isMono
                />

                {/* 4. Digital payments sum */}
                <KpiCard
                  title="Cobros Digitales / Bancarios"
                  value={formatMoney(
                    (sessionSummary?.yapeSales || 0) +
                      (sessionSummary?.plinSales || 0) +
                      (sessionSummary?.cardSales || 0) +
                      (sessionSummary?.transferSales || 0),
                  )}
                  subtitle="Yape, Plin, Tarjetas y Transferencias"
                  icon="qr_code_2"
                  iconBgClass="bg-blue-50"
                  iconColorClass="text-blue-600"
                  valueColorClass="text-blue-700"
                  isMono
                />
              </KpiGrid>

              {/* Methods Breakdown Pill Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-slate-400">payments</span>
                  <span>Desglose de Ventas por Método de Pago</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
                    <span className="text-[11px] font-bold text-slate-600 block">Efectivo</span>
                    <strong className="text-sm font-mono font-bold text-slate-900">
                      {formatMoney(sessionSummary?.methodsSummary.CASH)}
                    </strong>
                  </div>
                  <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200/60">
                    <span className="text-[11px] font-bold text-purple-700 block">
                      Yape
                    </span>
                    <strong className="text-sm font-mono font-bold text-purple-900">
                      {formatMoney(sessionSummary?.methodsSummary.YAPE)}
                    </strong>
                  </div>
                  <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-200/60">
                    <span className="text-[11px] font-bold text-teal-700 block">
                      Plin
                    </span>
                    <strong className="text-sm font-mono font-bold text-teal-900">
                      {formatMoney(sessionSummary?.methodsSummary.PLIN)}
                    </strong>
                  </div>
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200/60">
                    <span className="text-[11px] font-bold text-blue-700 block">
                      Tarjetas
                    </span>
                    <strong className="text-sm font-mono font-bold text-blue-900">
                      {formatMoney(sessionSummary?.methodsSummary.CARD)}
                    </strong>
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-200/60">
                    <span className="text-[11px] font-bold text-indigo-700 block">
                      Transferencias
                    </span>
                    <strong className="text-sm font-mono font-bold text-indigo-900">
                      {formatMoney(sessionSummary?.methodsSummary.TRANSFER)}
                    </strong>
                  </div>
                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200/60">
                    <span className="text-[11px] font-bold text-rose-700 block">
                      Crédito
                    </span>
                    <strong className="text-sm font-mono font-bold text-rose-900">
                      {formatMoney(sessionSummary?.methodsSummary.CREDIT)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Movements Section */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600 text-[20px]">receipt_long</span>
                      <span>Movimientos de este Turno ({movements.length})</span>
                    </h3>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={movementFilterType}
                      onChange={(e) => setMovementFilterType(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="all">Todos los Tipos</option>
                      <option value="OPENING">Apertura</option>
                      <option value="SALE">Ventas</option>
                      <option value="SALE_REVERSAL">Anulaciones</option>
                      <option value="CASH_IN">Ingresos</option>
                      <option value="CASH_OUT">Retiros</option>
                      <option value="DEBT_PAYMENT">Cobro Deuda</option>
                      <option value="LOAN_PAYMENT">Cobro Préstamo</option>
                    </select>

                    <select
                      value={movementFilterMethod}
                      onChange={(e) => setMovementFilterMethod(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="all">Todos los Métodos</option>
                      <option value="CASH">Efectivo</option>
                      <option value="YAPE">Yape</option>
                      <option value="PLIN">Plin</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="TRANSFER">Transferencia</option>
                    </select>
                  </div>
                </div>

                {loadingMovements ? (
                  <div className="py-12 flex justify-center text-slate-400">
                    <span className="material-symbols-outlined animate-spin text-3xl text-indigo-600">
                      progress_activity
                    </span>
                  </div>
                ) : movements.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No se encontraron movimientos registrados en este turno.
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="py-3.5 px-4">Hora</th>
                            <th className="py-3.5 px-4">Tipo</th>
                            <th className="py-3.5 px-4">Método</th>
                            <th className="py-3.5 px-4">Descripción</th>
                            <th className="py-3.5 px-4 text-right">Ingreso</th>
                            <th className="py-3.5 px-4 text-right">Egreso</th>
                            <th className="py-3.5 px-4">Usuario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {movements.map((m) => {
                            const isOut =
                              m.type === 'CASH_OUT' ||
                              m.type === 'SALE_REVERSAL' ||
                              m.amount < 0;
                            const absAmount = Math.abs(m.amount);
                            return (
                              <tr
                                key={m.id}
                                className="hover:bg-slate-50/80 transition-colors"
                              >
                                <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                                  {new Date(m.createdAt).toLocaleTimeString('es-PE', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    m.type === 'OPENING'
                                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                      : m.type === 'SALE'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : m.type === 'CASH_IN'
                                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                      : m.type === 'CASH_OUT'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {m.type}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                    {m.paymentMethod}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-700 font-medium">
                                  {m.description || m.notes || <span className="text-slate-300">--</span>}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                                  {!isOut ? `+S/ ${absAmount.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                                  {isOut ? `-S/ ${absAmount.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                                  {m.createdByUser?.name || 'Usuario'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {movements.map((m) => {
                        const isOut =
                          m.type === 'CASH_OUT' ||
                          m.type === 'SALE_REVERSAL' ||
                          m.amount < 0;
                        const absAmount = Math.abs(m.amount);
                        return (
                          <div key={m.id} className="p-4 space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-900">
                                {m.type}
                              </span>
                              <span
                                className={`text-sm font-mono font-bold ${
                                  isOut
                                    ? 'text-rose-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {isOut ? '-' : '+'}S/ {absAmount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-[10px] text-slate-700">
                                {m.paymentMethod}
                              </span>
                              <span className="font-mono text-slate-400">
                                {new Date(m.createdAt).toLocaleTimeString('es-PE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {m.description && (
                              <p className="text-slate-600 text-xs">
                                {m.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: HISTORY OF SESSIONS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              Historial de Turnos de Caja
            </h3>
            <button
              onClick={loadHistory}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Actualizar</span>
            </button>
          </div>

          {loadingHistory ? (
            <div className="py-16 flex justify-center text-slate-400">
              <span className="material-symbols-outlined animate-spin text-3xl text-indigo-600">
                progress_activity
              </span>
            </div>
          ) : !Array.isArray(historySessions) || historySessions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No hay turnos registrados para esta tienda.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Caja</th>
                      <th className="py-3 px-3">Usuario Apertura</th>
                      <th className="py-3 px-3">Apertura</th>
                      <th className="py-3 px-3">Cierre</th>
                      <th className="py-3 px-3 text-right">Fondo Inicial</th>
                      <th className="py-3 px-3 text-right">Esperado</th>
                      <th className="py-3 px-3 text-right">Contado</th>
                      <th className="py-3 px-3 text-right">Diferencia</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                      <th className="py-3 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {historySessions.map((s) => {
                      const diff =
                        s.differenceAmount !== null && s.differenceAmount !== undefined
                          ? Number(s.differenceAmount)
                          : null;
                      const openingCash = Number(s.openingCashAmount || 0);
                      const expectedCash = Number(s.expectedCashAmount || 0);
                      const countedCash =
                        s.countedCashAmount !== null && s.countedCashAmount !== undefined
                          ? Number(s.countedCashAmount)
                          : null;

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          onClick={() => setSelectedHistorySessionId(s.id)}
                        >
                          <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {s.cashRegister?.name || 'Caja'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {s.openedByUser?.name || 'Usuario'}
                          </td>
                          <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {formatDateTime(s.openedAt)}
                          </td>
                          <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {formatDateTime(s.closedAt)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                            {formatMoney(openingCash)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatMoney(expectedCash)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {countedCash !== null ? formatMoney(countedCash) : '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                            {diff !== null && !isNaN(diff) ? (
                              <span
                                className={
                                  diff < 0
                                    ? 'text-rose-600'
                                    : diff > 0
                                    ? 'text-blue-600'
                                    : 'text-emerald-600'
                                }
                              >
                                {diff > 0 ? '+' : ''}
                                {diff.toFixed(2)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.status === 'OPEN'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {s.status === 'OPEN' ? 'ABIERTO' : 'CERRADO'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHistorySessionId(s.id);
                              }}
                              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                              title="Ver Detalle"
                            >
                              <span className="material-symbols-outlined text-base">visibility</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {historySessions.map((s) => {
                  const diff =
                    s.differenceAmount !== null && s.differenceAmount !== undefined
                      ? Number(s.differenceAmount)
                      : null;
                  const expectedCash = Number(s.expectedCashAmount || 0);
                  const countedCash =
                    s.countedCashAmount !== null && s.countedCashAmount !== undefined
                      ? Number(s.countedCashAmount)
                      : null;

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedHistorySessionId(s.id)}
                      className="p-4 bg-white rounded-xl border border-slate-200 space-y-2 text-xs cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <strong className="text-sm font-bold text-slate-900">
                          {s.cashRegister?.name || 'Caja'}
                        </strong>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === 'OPEN'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {s.status === 'OPEN' ? 'ABIERTO' : 'CERRADO'}
                        </span>
                      </div>
                      <div className="text-slate-500">
                        Cajero: {s.openedByUser?.name || 'Usuario'}
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Esperado</span>
                          <strong className="text-slate-900">
                            {formatMoney(expectedCash)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Contado</span>
                          <strong className="text-slate-900">
                            {countedCash !== null ? formatMoney(countedCash) : '-'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">Diferencia</span>
                          <strong
                            className={
                              diff !== null && !isNaN(diff) && diff < 0
                                ? 'text-rose-600'
                                : diff !== null && !isNaN(diff) && diff > 0
                                ? 'text-blue-600'
                                : 'text-emerald-600'
                            }
                          >
                            {diff !== null && !isNaN(diff)
                              ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`
                              : '-'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* History Pagination */}
              {historyTotalPages > 1 && (
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-500">
                    Página {historyPage} de {historyTotalPages}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      Anterior
                    </button>
                    <button
                      disabled={historyPage >= historyTotalPages}
                      onClick={() => setHistoryPage((p) => p + 1)}
                      className="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: REGISTERS MANAGEMENT (ADMIN) */}
      {activeTab === 'registers' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Register Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">add_box</span>
              <span>Nueva Caja en Tienda</span>
            </h3>

            <form onSubmit={handleCreateRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Código Identificador
                </label>
                <input
                  type="text"
                  value={newRegCode}
                  onChange={(e) => setNewRegCode(e.target.value)}
                  placeholder="Ej. CAJA-01, CAJA-NORTE"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Descriptivo
                </label>
                <input
                  type="text"
                  value={newRegName}
                  onChange={(e) => setNewRegName(e.target.value)}
                  placeholder="Ej. Caja Principal, Caja Mostrador 2"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={creatingRegister}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs shadow-indigo-600/30 transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                {creatingRegister ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    <span>Creando Caja...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">save</span>
                    <span>Registrar Caja</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* List of Registers */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Cajas Configuradas ({registers.length})</span>
              <button
                onClick={loadRegisters}
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Actualizar</span>
              </button>
            </h3>

            {loadingRegisters ? (
              <div className="py-12 flex justify-center text-slate-400">
                <span className="material-symbols-outlined animate-spin text-3xl text-indigo-600">
                  progress_activity
                </span>
              </div>
            ) : registers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No hay cajas registradas para esta tienda.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {registers.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <strong className="text-sm font-bold text-slate-900">
                          {r.name}
                        </strong>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold">
                          {r.code}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        Estado:{' '}
                        <span
                          className={`font-semibold ${
                            r.status === 'ACTIVE'
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {r.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                        </span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleRegisterStatus(r)}
                      className={`px-3 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                        r.status === 'ACTIVE'
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {r.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      <OpenCashModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        onSuccess={() => {
          showToast('Turno de caja abierto correctamente');
          loadCurrentSession();
        }}
        currentUser={currentUser}
        stores={stores}
        initialStoreId={selectedStoreId}
        onConfigureRegisters={(targetStoreId) => {
          setIsOpenModalOpen(false);
          onNavigateToStoreRegisters?.(targetStoreId);
        }}
      />

      <CloseCashModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onSuccess={() => {
          showToast('Turno de caja cerrado correctamente');
          loadCurrentSession();
        }}
        session={currentSession}
      />

      <CashMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        onSuccess={() => {
          showToast('Movimiento registrado en caja');
          loadCurrentSession();
        }}
        session={currentSession}
        summary={sessionSummary}
        defaultType={movementModalType}
        currentUser={currentUser}
      />

      <SessionDetailModal
        isOpen={!!selectedHistorySessionId}
        onClose={() => setSelectedHistorySessionId(null)}
        sessionId={selectedHistorySessionId}
      />
    </div>
  );
};
