import React, { useState, useEffect } from 'react';
import { User, Client, DashboardMetrics } from './types';
import { api, getAuthToken, removeAuthToken, setAuthToken } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardKPIs } from './components/DashboardKPIs';
import { ClientsTable } from './components/ClientsTable';
import { ClientFormModal } from './components/ClientFormModal';
import { StatementOfAccountModal } from './components/StatementOfAccountModal';
import { PaymentModal } from './components/PaymentModal';
import { AddDebtModal } from './components/AddDebtModal';
import { PaymentRemindersModal } from './components/PaymentRemindersModal';
import { BalanceReportView } from './components/BalanceReportView';
import { AdminPanel } from './components/AdminPanel';
import { LoginModal } from './components/LoginModal';
import { PaymentsHistoryModal } from './components/PaymentsHistoryModal';
import { PurchasesHistoryModal } from './components/PurchasesHistoryModal';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<
    'dashboard' | 'clients' | 'reports' | 'admin' | 'settings'
  >('dashboard');

  const [pathname, setPathname] = useState(window.location.pathname);

  // listen to navigation changes
  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (toPath: string) => {
    window.history.pushState({}, '', toPath);
    setPathname(toPath);
  };

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Data State
  const [clients, setClients] = useState<Client[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalClients: 0,
    clientsWithDebt: 0,
    totalPendingDebt: 0,
    clientsWithBalanceInFavor: 0,
    todayPaymentsTotal: 0,
    todayPaymentsCount: 0,
  });

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Modal Control States
  const [showClientFormModal, setShowClientFormModal] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<Client | null>(null);

  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedClientForStatement, setSelectedClientForStatement] = useState<Client | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedClientForPayment, setSelectedClientForPayment] = useState<Client | null>(null);
  const [isFullPayoffPayment, setIsFullPayoffPayment] = useState(false);

  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [selectedClientForDebt, setSelectedClientForDebt] = useState<Client | null>(null);

  const [showRemindersModal, setShowRemindersModal] = useState(false);
  const [showPaymentsHistoryModal, setShowPaymentsHistoryModal] = useState(false);
  const [showPurchasesHistoryModal, setShowPurchasesHistoryModal] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Alert Modal for Deletion / Deactivation Business Rules
  const [alertData, setAlertData] = useState<{
    title: string;
    message: string;
    type: 'error' | 'info' | 'warning' | 'success';
    suggestDeactivate?: boolean;
    clientToDeactivate?: Client;
  } | null>(null);

  // Initialize auth check on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const { user } = await api.getMe();
          setCurrentUser(user);
          if (window.location.pathname === '/login' || window.location.pathname === '/register') {
            navigate('/dashboard');
            setCurrentView('dashboard');
          } else {
            // sync view name based on path
            const viewName = window.location.pathname.replace('/', '') || 'dashboard';
            if (['dashboard', 'clients', 'reports', 'admin', 'settings'].includes(viewName)) {
              setCurrentView(viewName as any);
            }
          }
        } catch (err) {
          removeAuthToken();
          setCurrentUser(null);
          if (window.location.pathname !== '/register') {
            navigate('/login');
          }
        }
      } else {
        setCurrentUser(null);
        if (window.location.pathname !== '/register') {
          navigate('/login');
        }
      }
    };
    initAuth();
  }, []);

  // Load clients and dashboard metrics
  const loadData = async () => {
    try {
      const clientsData = await api.getClients(searchQuery, 'todos');
      setClients(clientsData);

      const kpis = await api.getDashboardKPIs();
      setMetrics(kpis);
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, searchQuery]);

  // Handlers
  const handleOpenNewClient = () => {
    setSelectedClientForEdit(null);
    setShowClientFormModal(true);
  };

  const handleOpenEditClient = (client: Client) => {
    setSelectedClientForEdit(client);
    setShowClientFormModal(true);
  };

  const handleSaveClient = async (
    clientData: Partial<Client>,
    initialCredit?: {
      debtType: 'none' | 'simple' | 'credit';
      simpleAmount?: number;
      simpleConcept?: string;
      capital?: number;
      interestRate?: number;
      interestAmount?: number;
      totalAmount?: number;
      installmentsCount?: number;
      installmentAmount?: number;
      frequency?: string;
      firstDueDate?: string;
    }
  ) => {
    if (selectedClientForEdit) {
      await api.updateClient(selectedClientForEdit.id, clientData);
    } else {
      const createdClient = await api.createClient(clientData);
      if (initialCredit && createdClient && createdClient.id) {
        if (initialCredit.debtType === 'credit' && initialCredit.capital && initialCredit.installmentsCount) {
          await api.createLoanCredit(createdClient.id, {
            capital: initialCredit.capital,
            interestRate: initialCredit.interestRate || 0,
            interestAmount: initialCredit.interestAmount || 0,
            totalAmount: initialCredit.totalAmount || initialCredit.capital,
            installmentsCount: initialCredit.installmentsCount,
            installmentAmount: initialCredit.installmentAmount || 0,
            frequency: initialCredit.frequency || 'Mensual',
            firstDueDate: initialCredit.firstDueDate || new Date().toISOString().split('T')[0],
            notes: 'Crédito inicial otorgado al registrar cliente',
          });
        } else if (initialCredit.debtType === 'simple' && initialCredit.simpleAmount) {
          await api.addCreditPurchase(createdClient.id, {
            product: initialCredit.simpleConcept || 'Saldo inicial de apertura',
            unitPrice: initialCredit.simpleAmount,
            quantity: 1,
          });
        }
      }
    }
    await loadData();
  };

  const handleOpenStatement = (client: Client) => {
    setSelectedClientForStatement(client);
    setShowStatementModal(true);
  };

  const handleOpenPayment = (client: Client, isFullPayoff: boolean = false) => {
    setSelectedClientForPayment(client);
    setIsFullPayoffPayment(isFullPayoff);
    setShowPaymentModal(true);
  };

  const handleOpenAddDebt = (client: Client) => {
    setSelectedClientForDebt(client);
    setShowAddDebtModal(true);
  };

  const handleConfirmAddDebt = async (
    clientId: string,
    debtData: {
      product: string;
      unitPrice: number;
      quantity: number;
      ticketNumber?: string;
      date?: string;
      debtType?: 'simple' | 'credit';
      capital?: number;
      interestRate?: number;
      interestAmount?: number;
      totalAmount?: number;
      installmentsCount?: number;
      installmentAmount?: number;
      frequency?: string;
      firstDueDate?: string;
      notes?: string;
    }
  ) => {
    if (debtData.debtType === 'credit' && debtData.capital && debtData.installmentsCount) {
      await api.createLoanCredit(clientId, {
        capital: debtData.capital,
        interestRate: debtData.interestRate || 0,
        interestAmount: debtData.interestAmount || 0,
        totalAmount: debtData.totalAmount || debtData.unitPrice,
        installmentsCount: debtData.installmentsCount,
        installmentAmount: debtData.installmentAmount || 0,
        frequency: debtData.frequency || 'Mensual',
        firstDueDate: debtData.firstDueDate || new Date().toISOString().split('T')[0],
        product: debtData.product,
        ticketNumber: debtData.ticketNumber,
        notes: debtData.notes,
        date: debtData.date,
      });
    } else {
      await api.addCreditPurchase(clientId, {
        product: debtData.product,
        unitPrice: debtData.unitPrice,
        quantity: debtData.quantity || 1,
        ticketNumber: debtData.ticketNumber,
        date: debtData.date,
      });
    }
    await loadData();
    if (selectedClientForStatement && selectedClientForStatement.id === clientId) {
      const updated = await api.getClients(selectedClientForStatement.name);
      if (updated.length > 0) setSelectedClientForStatement(updated[0]);
    }
  };

  const handleConfirmPayment = async (paymentData: {
    amount: number;
    paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
    notes?: string;
    isFullPayoff?: boolean;
  }) => {
    if (!selectedClientForPayment) return;
    await api.registerPayment(selectedClientForPayment.id, paymentData);
    await loadData();
    // Update active statement client if open
    if (selectedClientForStatement && selectedClientForStatement.id === selectedClientForPayment.id) {
      const updated = await api.getClients(selectedClientForPayment.name);
      if (updated.length > 0) setSelectedClientForStatement(updated[0]);
    }
  };

  // Business Rules for Deactivation
  const handleDeactivateClient = async (client: Client) => {
    try {
      await api.deactivateClient(client.id);
      setAlertData({
        title: 'Cliente Desactivado',
        message: `El cliente ${client.name} fue desactivado con éxito. Su historial contable y trazabilidad de operaciones se han conservado intactos.`,
        type: 'success',
      });
      await loadData();
    } catch (err: any) {
      setAlertData({
        title: 'No se puede Desactivar',
        message: err.message || 'Error al desactivar cliente',
        type: 'error',
      });
    }
  };

  const handleReactivateClient = async (client: Client) => {
    try {
      await api.reactivateClient(client.id);
      setAlertData({
        title: 'Cliente Reactivado',
        message: `El cliente ${client.name} ha sido reactivado para operaciones normales en POS.`,
        type: 'success',
      });
      await loadData();
    } catch (err: any) {
      setAlertData({
        title: 'Error',
        message: err.message || 'Error al reactivar cliente',
        type: 'error',
      });
    }
  };

  // Business Rules for Physical Deletion
  const handleDeleteClient = async (client: Client) => {
    // Frontend Pre-Validation
    if (Math.abs(client.currentBalance) > 0.01) {
      if (client.currentBalance > 0) {
        setAlertData({
          title: 'Regla de Negocio: Saldo Pendiente',
          message: `No se permite eliminar al cliente "${client.name}" porque tiene un saldo pendiente de S/ ${client.currentBalance.toFixed(2)} PEN. La cuenta debe estar exactamente en S/ 0.00 para proceder.`,
          type: 'error',
        });
      } else {
        setAlertData({
          title: 'Regla de Negocio: Saldo a Favor',
          message: `No se permite eliminar al cliente "${client.name}" porque tiene un saldo a favor de S/ ${Math.abs(client.currentBalance).toFixed(2)} PEN. La cuenta debe estar exactamente en S/ 0.00 para proceder.`,
          type: 'error',
        });
      }
      return;
    }

    try {
      await api.deleteClient(client.id);
      setAlertData({
        title: 'Cliente Eliminado',
        message: `El cliente ${client.name} no tenía movimientos ni saldo pendiente y fue eliminado físicamente del sistema.`,
        type: 'success',
      });
      await loadData();
    } catch (err: any) {
      if (err.message?.includes('trazabilidad') || err.message?.includes('auditoría') || err.message?.includes('Desactivar')) {
        setAlertData({
          title: 'Conservación de Trazabilidad Histórica',
          message: err.message,
          type: 'warning',
          suggestDeactivate: true,
          clientToDeactivate: client,
        });
      } else {
        setAlertData({
          title: 'Validación de Borrado Fallida',
          message: err.message || 'Error al eliminar cliente',
          type: 'error',
        });
      }
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
    setClients([]);
    setMetrics({
      totalClients: 0,
      clientsWithDebt: 0,
      totalPendingDebt: 0,
      clientsWithBalanceInFavor: 0,
      todayPaymentsTotal: 0,
      todayPaymentsCount: 0,
      clientsAtLimitCount: 0,
      clientsAtLimitNames: [],
    });
    navigate('/login');
  };

  const handleExportDataCSV = () => {
    const csvHeader = 'Codigo,Nombre,Telefono,Direccion,LimiteCredito,SaldoActual,Estado\n';
    const csvRows = clients
      .map(
        (c) =>
          `"${c.clientNumber}","${c.name}","${c.phone}","${c.address}",${c.creditLimit},${c.currentBalance},"${c.status}"`
      )
      .join('\n');
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credimanage_clientes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!currentUser) {
    if (pathname === '/register') {
      return (
        <RegisterPage
          onRegisterSuccess={(msg) => {
            alert(msg);
            navigate('/login');
          }}
          onNavigateToLogin={() => navigate('/login')}
        />
      );
    }
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          navigate('/dashboard');
          setCurrentView('dashboard');
        }}
        onNavigateToRegister={() => navigate('/register')}
      />
    );
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex font-body-md">
      {/* Desktop SideNavBar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
          if (view === 'settings') {
            setShowSettingsModal(true);
          } else {
            setCurrentView(view);
          }
        }}
        user={currentUser}
        onLogout={handleLogout}
        onExportData={handleExportDataCSV}
        onOpenLogin={() => setShowLoginModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen pb-16 md:pb-0">
        {/* Top Header Bar */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onNewClient={handleOpenNewClient}
          user={currentUser}
          onOpenLogin={() => setShowLoginModal(true)}
          onLogout={handleLogout}
          onNavigateToAdminSecret={() => setCurrentView('admin')}
          onFilterClientsWithDebt={() => {
            setStatusFilter('con_deuda');
            setCurrentView('clients');
          }}
          onViewPaymentsHistory={() => setShowPaymentsHistoryModal(true)}
          todayPaymentsCount={metrics.todayPaymentsCount}
          todayPaymentsTotal={metrics.todayPaymentsTotal}
          clientsAtLimitCount={metrics.clientsAtLimitCount}
          clientsAtLimitNames={metrics.clientsAtLimitNames}
        />

        {/* Main View Router */}
        <main className="flex-1 p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full">
          {/* VIEW 1: Dashboard or Clients */}
          {/* VIEW 1: Dashboard */}
          {currentView === 'dashboard' && (
            <>
              {/* Page Title Header */}
              <div className="mb-lg flex flex-col md:flex-row justify-between items-start md:items-end gap-md">
                <div>
                  <h2 className="font-display-lg text-display-lg text-on-surface mb-xs">
                    Gestión de Clientes
                  </h2>
                  <p className="font-body-md text-body-md text-secondary">
                    Monitoreo de crédito, abonos y cartera de deudores en punto de venta.
                  </p>
                </div>
              </div>

              {/* KPI Cards Grid */}
              <DashboardKPIs
                metrics={metrics}
                onFilterClick={(filterKey) => {
                  setStatusFilter(filterKey);
                  setCurrentView('clients');
                }}
                onViewPaymentsHistory={() => setShowPaymentsHistoryModal(true)}
                onViewPurchasesHistory={() => setShowPurchasesHistoryModal(true)}
              />
            </>
          )}

          {/* VIEW 1.5: Clients List */}
          {currentView === 'clients' && (
            <ClientsTable
              clients={clients}
              onViewStatement={handleOpenStatement}
              onEditClient={handleOpenEditClient}
              onPayClient={(c) => handleOpenPayment(c, false)}
              onAddDebtClient={handleOpenAddDebt}
              onDeactivateClient={handleDeactivateClient}
              onReactivateClient={handleReactivateClient}
              onDeleteClient={handleDeleteClient}
              onOpenRemindersModal={() => setShowRemindersModal(true)}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}

          {/* VIEW 2: Reporte de Saldos */}
          {currentView === 'reports' && (
            <BalanceReportView
              onViewStatement={handleOpenStatement}
              onEditClient={handleOpenEditClient}
              onPayClient={(c) => handleOpenPayment(c, false)}
            />
          )}

          {/* VIEW 3: Protected Admin Panel */}
          {currentView === 'admin' && (
            <AdminPanel
              currentUser={currentUser}
              onNavigateToClients={() => setCurrentView('clients')}
              onNavigateToReports={() => setCurrentView('reports')}
              onViewStatement={handleOpenStatement}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Bar Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center py-2 z-40 shadow-lg">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`flex flex-col items-center p-1 cursor-pointer ${
            currentView === 'dashboard' ? 'text-indigo-600 font-bold' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">dashboard</span>
          <span className="text-[10px] font-semibold mt-0.5">Inicio</span>
        </button>

        <button
          onClick={() => setCurrentView('clients')}
          className={`flex flex-col items-center p-1 cursor-pointer ${
            currentView === 'clients' ? 'text-indigo-600 font-bold' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">group</span>
          <span className="text-[10px] font-semibold mt-0.5">Clientes</span>
        </button>

        <button
          onClick={() => setCurrentView('reports')}
          className={`flex flex-col items-center p-1 cursor-pointer ${
            currentView === 'reports' ? 'text-indigo-600 font-bold' : 'text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">analytics</span>
          <span className="text-[10px] font-semibold mt-0.5">Reportes</span>
        </button>


      </nav>

      {/* --- MODALS --- */}

      {/* Client Form Modal */}
      <ClientFormModal
        isOpen={showClientFormModal}
        onClose={() => setShowClientFormModal(false)}
        onSubmit={handleSaveClient}
        initialClient={selectedClientForEdit}
      />

      {/* Statement of Account Modal */}
      <StatementOfAccountModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        client={selectedClientForStatement}
        currentUser={currentUser}
        onOpenPaymentModal={(client, isFullPayoff) => {
          handleOpenPayment(client, isFullPayoff);
        }}
        onOpenAddDebtModal={handleOpenAddDebt}
        onRefreshData={loadData}
      />

      {/* Payment / Abono Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        client={selectedClientForPayment}
        onConfirmPayment={handleConfirmPayment}
        isFullPayoffDefault={isFullPayoffPayment}
      />

      {/* Add Debt / Cargo Modal */}
      <AddDebtModal
        isOpen={showAddDebtModal}
        onClose={() => setShowAddDebtModal(false)}
        client={selectedClientForDebt}
        onSubmit={handleConfirmAddDebt}
      />

      {/* Payment Reminders / Cobranzas Modal */}
      <PaymentRemindersModal
        isOpen={showRemindersModal}
        onClose={() => setShowRemindersModal(false)}
        clients={clients}
        onPayClient={(c) => handleOpenPayment(c, false)}
        onAddDebtClient={handleOpenAddDebt}
        onViewStatement={handleOpenStatement}
      />

      {/* JWT Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadData();
        }}
      />

      {/* Business Rules Alert Modal */}
      {alertData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`material-symbols-outlined text-[28px] ${
                  alertData.type === 'error'
                    ? 'text-rose-600'
                    : alertData.type === 'warning'
                    ? 'text-amber-600'
                    : alertData.type === 'success'
                    ? 'text-emerald-600'
                    : 'text-indigo-600'
                }`}
              >
                {alertData.type === 'error'
                  ? 'cancel'
                  : alertData.type === 'warning'
                  ? 'warning'
                  : alertData.type === 'success'
                  ? 'check_circle'
                  : 'info'}
              </span>
              <h3 className="text-lg font-extrabold text-slate-900">{alertData.title}</h3>
            </div>

            <p className="text-xs font-medium text-slate-600 mb-5 leading-relaxed">{alertData.message}</p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              {alertData.suggestDeactivate && alertData.clientToDeactivate && (
                <button
                  onClick={async () => {
                    const client = alertData.clientToDeactivate!;
                    setAlertData(null);
                    await handleDeactivateClient(client);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Desactivar Cliente
                </button>
              )}
              <button
                onClick={() => setAlertData(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payments History Modal */}
      {showPaymentsHistoryModal && (
        <PaymentsHistoryModal
          isOpen={showPaymentsHistoryModal}
          onClose={() => setShowPaymentsHistoryModal(false)}
          onViewClientStatement={(clientId) => {
            const foundClient = clients.find((c) => c.id === clientId);
            if (foundClient) {
              setShowPaymentsHistoryModal(false);
              handleOpenStatement(foundClient);
            }
          }}
          clients={clients}
        />
      )}

      {/* Purchases / Account Debts History Modal */}
      {showPurchasesHistoryModal && (
        <PurchasesHistoryModal
          isOpen={showPurchasesHistoryModal}
          onClose={() => setShowPurchasesHistoryModal(false)}
          onViewClientStatement={(clientId) => {
            const foundClient = clients.find((c) => c.id === clientId);
            if (foundClient) {
              setShowPurchasesHistoryModal(false);
              handleOpenStatement(foundClient);
            }
          }}
          clients={clients}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-[22px]">settings</span>
                <h3 className="text-lg font-extrabold text-slate-900">Configuración POS</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <p className="font-bold text-slate-900 text-sm">Módulo de Crédito CrediManage</p>
                <p className="text-indigo-700 font-medium text-[11px] mt-0.5">Versión 2.4.0 • Producción POS</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Moneda del Sistema</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    payments
                  </span>
                  <input
                    type="text"
                    disabled
                    value="PEN (S/ Soles Peruanos)"
                    className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono font-bold text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Moneda predeterminada para todos los cálculos de saldo y reportes de crédito.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Servicio Backend API</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    dns
                  </span>
                  <input
                    type="text"
                    disabled
                    value="Express REST API con Tokens JWT"
                    className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-mono text-xs font-medium"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-700">Cuenta activa</label>
                {currentUser ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Nombre:</span>
                      <span className="font-bold text-slate-900">{currentUser.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Correo electrónico:</span>
                      <span className="font-mono font-semibold text-slate-900">{currentUser.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Rol:</span>
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                        {currentUser.role}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center text-slate-400 font-medium">
                    Sin iniciar sesión
                  </div>
                )}
                
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    handleLogout();
                    setShowLoginModal(true);
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer text-center mt-2"
                >
                  Cambiar Cuenta
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Guardar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
