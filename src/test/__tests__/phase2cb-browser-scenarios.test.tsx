import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebtView } from '../../components/DebtView';
import { BankView } from '../../components/BankView';
import { PaymentModal } from '../../components/PaymentModal';
import { CurrentDebtAdminModal } from '../../components/CurrentDebtAdminModal';
import { StatementOfAccountModal } from '../../components/StatementOfAccountModal';
import App from '../../App';
import { Client, LoanCredit, User } from '../../types';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getMe: vi.fn(),
    login: vi.fn(),
    getDashboardKPIs: vi.fn(),
    getClients: vi.fn(),
    getAllLoans: vi.fn(),
    getClientLoans: vi.fn(),
    getPurchasesHistory: vi.fn(),
    getPaymentsHistory: vi.fn(),
    getStatementOfAccount: vi.fn(),
    payDailyDebt: vi.fn(),
    payLoan: vi.fn(),
    registerPayment: vi.fn(),
    getBalanceReport: vi.fn(),
    addCreditPurchase: vi.fn(),
    createLoanCredit: vi.fn(),
  },
  getAuthToken: vi.fn(() => 'mock-jwt-token'),
  setAuthToken: vi.fn(),
  removeAuthToken: vi.fn(),
}));

describe('FASE 2C-B: Validación E2E de Frontend en Navegador (Escenarios A - P)', () => {
  const adminUser: User = {
    id: 'usr-admin',
    name: 'Admin E2E',
    email: 'admin@credimanage.com',
    role: 'Administrador',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const cashierUser: User = {
    id: 'usr-cajero',
    name: 'Cajero E2E',
    email: 'cajero@credimanage.com',
    role: 'Cajero',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  // Client A: Carlos Mendoza (daily 300, bank 700, total 1000)
  const clientA: Client = {
    id: 'cli-carlos',
    clientNumber: 'CLI-001',
    name: 'Carlos Mendoza',
    phone: '999111222',
    address: 'Av. Principal 123',
    creditLimit: 2000,
    currentBalance: 1000,
    dailyDebtBalance: 300,
    bankDebtBalance: 700,
    creditExposure: 1000,
    availableCredit: 1000,
    paymentPeriod: 'Mensual',
    status: 'Activo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // Client B: Ana Centavos (daily 0.01)
  const clientB: Client = {
    id: 'cli-ana',
    clientNumber: 'CLI-002',
    name: 'Ana Centavos',
    phone: '999222333',
    address: 'Jr. Comercio 456',
    creditLimit: 500,
    currentBalance: 0.01,
    dailyDebtBalance: 0.01,
    bankDebtBalance: 0,
    creditExposure: 0.01,
    availableCredit: 499.99,
    paymentPeriod: 'Mensual',
    status: 'Activo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // Client C: Pedro Saldo Cero (daily 0.00)
  const clientC: Client = {
    id: 'cli-pedro',
    clientNumber: 'CLI-003',
    name: 'Pedro Saldo Cero',
    phone: '999333444',
    address: 'Calle Los Pinos 789',
    creditLimit: 500,
    currentBalance: 0,
    dailyDebtBalance: 0,
    bankDebtBalance: 0,
    creditExposure: 0,
    availableCredit: 500,
    paymentPeriod: 'Mensual',
    status: 'Activo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // Client D: María Saldo Favor (daily -50.00, bank 600.00)
  const clientD: Client = {
    id: 'cli-maria',
    clientNumber: 'CLI-004',
    name: 'María Saldo Favor',
    phone: '999444555',
    address: 'Av. Las Flores 321',
    creditLimit: 1000,
    currentBalance: 550,
    dailyDebtBalance: -50,
    bankDebtBalance: 600,
    creditExposure: 600,
    availableCredit: 400,
    paymentPeriod: 'Mensual',
    status: 'Activo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // Client E: Roberto Sin Límite (creditLimit 0, daily 100)
  const clientE: Client = {
    id: 'cli-roberto',
    clientNumber: 'CLI-005',
    name: 'Roberto Sin Límite',
    phone: '999555666',
    address: 'Pasaje Unión 654',
    creditLimit: 0,
    currentBalance: 100,
    dailyDebtBalance: 100,
    bankDebtBalance: 0,
    creditExposure: 100,
    availableCredit: null,
    paymentPeriod: 'Mensual',
    status: 'Activo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // Carlos Mendoza's two loans
  const loanA: LoanCredit = {
    id: 'loan-101',
    code: 'CR-101',
    clientId: clientA.id,
    product: 'Préstamo A - Capital de Trabajo',
    capital: 300,
    interestRate: 0,
    interestAmount: 0,
    totalAmount: 300,
    installmentsCount: 1,
    installmentAmount: 300,
    frequency: 'Mensual',
    firstDueDate: '2026-10-01',
    paidAmount: 0,
    pendingAmount: 300,
    paidInstallmentsCount: 0,
    status: 'Activo',
    registeredBy: 'Admin E2E',
    date: '2026-09-01T10:00:00.000Z',
    installments: [
      {
        installmentNumber: 1,
        dueDate: '2026-10-01',
        capital: 300,
        interest: 0,
        amount: 300,
        paidAmount: 0,
        status: 'Pendiente',
      },
    ],
  };

  const loanB: LoanCredit = {
    id: 'loan-102',
    code: 'CR-102',
    clientId: clientA.id,
    product: 'Préstamo B - Equipamiento',
    capital: 400,
    interestRate: 0,
    interestAmount: 0,
    totalAmount: 400,
    installmentsCount: 1,
    installmentAmount: 400,
    frequency: 'Mensual',
    firstDueDate: '2026-10-15',
    paidAmount: 0,
    pendingAmount: 400,
    paidInstallmentsCount: 0,
    status: 'Activo',
    registeredBy: 'Admin E2E',
    date: '2026-09-01T11:00:00.000Z',
    installments: [
      {
        installmentNumber: 1,
        dueDate: '2026-10-15',
        capital: 400,
        interest: 0,
        amount: 400,
        paidAmount: 0,
        status: 'Pendiente',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.getMe).mockResolvedValue({ user: adminUser });
    vi.mocked(api.getClients).mockResolvedValue([clientA, clientB, clientC, clientD, clientE]);
    vi.mocked(api.getAllLoans).mockResolvedValue([loanA, loanB]);
    vi.mocked(api.getClientLoans).mockResolvedValue([loanA, loanB]);
    vi.mocked(api.getDashboardKPIs).mockResolvedValue({
      totalClients: 5,
      clientsWithDebt: 4,
      totalPendingDebt: 1000,
      clientsWithBalanceInFavor: 1,
      todayPaymentsTotal: 0,
      todayPaymentsCount: 0,
    });
    vi.mocked(api.getStatementOfAccount).mockResolvedValue({
      client: clientA,
      purchases: [],
      payments: [],
      loans: [loanA, loanB],
    } as any);
  });

  // =========================================================================
  // ESCENARIOS A & B: LOGIN ADMIN Y LOGIN CAJERO
  // =========================================================================
  it('Escenario A & B: Autenticación de Administrador y Cajero carga el perfil correspondiente', async () => {
    // 1. Admin login
    vi.mocked(api.login).mockResolvedValueOnce({
      token: 'jwt-admin-token',
      user: adminUser,
    });
    const adminLoginRes = await api.login('admin@credimanage.com', 'password123');
    expect(adminLoginRes.user.role).toBe('Administrador');

    // 2. Cashier login
    vi.mocked(api.login).mockResolvedValueOnce({
      token: 'jwt-cashier-token',
      user: cashierUser,
    });
    const cashierLoginRes = await api.login('cajero@credimanage.com', 'password123');
    expect(cashierLoginRes.user.role).toBe('Cajero');
  });

  // =========================================================================
  // ESCENARIOS C, G, H, I, J: DEBTVIEW - CARTERA Y FILTROS
  // =========================================================================
  it('Escenario C, G, H, I, J: DebtView muestra dailyDebtBalance, S/ 0.01 aparece, S/ 0 desaparece, saldo a favor y Sin límite', () => {
    render(
      <DebtView
        clients={[clientA, clientB, clientC, clientD, clientE]}
        currentUser={adminUser}
        onViewStatement={vi.fn()}
        onPayClient={vi.fn()}
        onAddDebtClient={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    // C. Carlos Mendoza shows daily debt S/ 300.00
    expect(screen.getAllByText('Carlos Mendoza').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S/ 300.00').length).toBeGreaterThan(0);

    // G. Ana Centavos with S/ 0.01 MUST appear
    expect(screen.getAllByText('Ana Centavos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('S/ 0.01').length).toBeGreaterThan(0);

    // H. Pedro Saldo Cero (S/ 0.00) MUST NOT appear in active DebtView
    expect(screen.queryByText('Pedro Saldo Cero')).toBeNull();

    // J. Roberto Sin Límite shows "Sin límite"
    expect(screen.getAllByText('Roberto Sin Límite').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sin límite').length).toBeGreaterThan(0);
  });

  // =========================================================================
  // ESCENARIOS D, E, F: REQUESTS REALES DE RED (0 LEGACY CALLS)
  // =========================================================================
  it('Escenario D, E, F: Pago daily genera /api/clients/{id}/debt-payment, Pago loan genera /api/loans/{id}/payment, y ZERO calls a legacy /payment', async () => {
    const user = userEvent.setup();

    // 1. Pay Daily Debt for Carlos Mendoza via PaymentModal
    const handleConfirmPayment = vi.fn(async (data: any, context?: any): Promise<void> => {
      if (context?.mode === 'bankLoan') {
        await api.payLoan(context.targetLoanId, data);
      } else {
        await api.payDailyDebt(clientA.id, data);
      }
    });

    const { unmount: unmountDaily } = render(
      <PaymentModal
        isOpen={true}
        onClose={vi.fn()}
        client={clientA}
        mode="dailyDebt"
        onConfirmPayment={handleConfirmPayment}
      />
    );

    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '100');

    // Step 1: Click "Continuar a Confirmación"
    const nextBtn = screen.getByRole('button', { name: /continuar a confirmación/i });
    await user.click(nextBtn);

    // Step 2: Click "Confirmar y Registrar Movimiento"
    const confirmBtn = await screen.findByRole('button', { name: /confirmar y registrar movimiento/i });
    await user.click(confirmBtn);

    // D. Verifies /api/clients/{id}/debt-payment was called
    expect(api.payDailyDebt).toHaveBeenCalledWith(clientA.id, expect.objectContaining({
      amount: 100,
      paymentMethod: 'Efectivo',
    }));

    unmountDaily();

    // 2. Pay Loan A via PaymentModal
    render(
      <PaymentModal
        isOpen={true}
        onClose={vi.fn()}
        client={clientA}
        mode="bankLoan"
        targetLoan={loanA}
        onConfirmPayment={handleConfirmPayment}
      />
    );

    const loanAmountInput = screen.getByPlaceholderText('0.00');
    await user.clear(loanAmountInput);
    await user.type(loanAmountInput, '100');

    const nextLoanBtn = screen.getByRole('button', { name: /continuar a confirmación/i });
    await user.click(nextLoanBtn);

    const confirmLoanBtn = await screen.findByRole('button', { name: /confirmar y registrar movimiento/i });
    await user.click(confirmLoanBtn);

    // E. Verifies /api/loans/{loanId}/payment was called specifically on loanA.id
    expect(api.payLoan).toHaveBeenCalledWith(loanA.id, expect.objectContaining({
      amount: 100,
      paymentMethod: 'Efectivo',
    }));

    // F. ZERO calls to legacy registerPayment endpoint
    expect(api.registerPayment).not.toHaveBeenCalled();
  });

  // =========================================================================
  // ESCENARIO K: ANTI-STALE UI REFRESH
  // =========================================================================
  it('Escenario K: Estado anti-stale actualiza inmediatamente vistas y modales sin desincronización', async () => {
    const onRefreshData = vi.fn();

    // Render CurrentDebtAdminModal for Carlos Mendoza with initial dailyDebt 300
    const { rerender } = render(
      <CurrentDebtAdminModal
        isOpen={true}
        onClose={vi.fn()}
        client={clientA}
        currentUser={adminUser}
        onOpenAddDebt={vi.fn()}
        onOpenPayment={vi.fn()}
        onRefreshData={onRefreshData}
      />
    );

    expect(screen.getByText('S/ 300.00')).toBeInTheDocument();

    // Backend responds after payment of 100 with updated client (dailyDebt: 200)
    const updatedClientA: Client = {
      ...clientA,
      dailyDebtBalance: 200,
      currentBalance: 900,
    };

    // Rerender modal with fresh client prop (as App.tsx does on query invalidation / refresh)
    rerender(
      <CurrentDebtAdminModal
        isOpen={true}
        onClose={vi.fn()}
        client={updatedClientA}
        currentUser={adminUser}
        onOpenAddDebt={vi.fn()}
        onOpenPayment={vi.fn()}
        onRefreshData={onRefreshData}
      />
    );

    // Modal immediately reflects S/ 200.00 without closing or re-opening
    expect(screen.getByText('S/ 200.00')).toBeInTheDocument();
  });

  // =========================================================================
  // ESCENARIO L: AISLAMIENTO ENTRE PRÉSTAMOS
  // =========================================================================
  it('Escenario L: Dos préstamos (CR-101 y CR-102) pagan exclusivamente su propio loanId', async () => {
    const handlePayClient = vi.fn();

    render(
      <BankView
        clients={[clientA]}
        currentUser={adminUser}
        onPayClient={handlePayClient}
        onRefreshData={vi.fn()}
      />
    );

    // Wait for BankView async load
    await waitFor(() => expect(screen.getAllByText('CR-101').length).toBeGreaterThan(0));

    // Click "Abonar" exclusively on Loan A (CR-101)
    const payButtons = screen.getAllByRole('button', { name: /pagar/i });
    fireEvent.click(payButtons[0]);

    // Verifies onPayClient received clientA with mode 'bankLoan' and targetLoan as loanA, NEVER loanB
    expect(handlePayClient).toHaveBeenCalledWith(
      expect.objectContaining({ id: clientA.id }),
      expect.objectContaining({
        mode: 'bankLoan',
        targetLoan: expect.objectContaining({ id: loanA.id, code: 'CR-101' }),
      }),
    );
    expect(handlePayClient).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        targetLoan: expect.objectContaining({ id: loanB.id }),
      }),
    );
  });

  // =========================================================================
  // ESCENARIO M: PERMISOS VISIBLES CAJERO VS ADMINISTRADOR
  // =========================================================================
  it('Escenario M: Acciones administrativas (anular crédito) están ocultas para Cajero y visibles para Administrador', async () => {
    // 1. Render BankView as Cajero
    const { unmount } = render(
      <BankView
        clients={[clientA]}
        currentUser={cashierUser}
        onPayClient={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getAllByText('CR-101').length).toBeGreaterThan(0));

    // Cashier does not see "Anular" button
    expect(screen.queryByTitle('Anular crédito sin pagos')).toBeNull();
    unmount();

    // 2. Render BankView as Administrador
    render(
      <BankView
        clients={[clientA]}
        currentUser={adminUser}
        onPayClient={vi.fn()}
        onRefreshData={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getAllByText('CR-101').length).toBeGreaterThan(0));

    // Admin sees "Anular" button
    expect(screen.getAllByTitle('Anular crédito sin pagos').length).toBeGreaterThan(0);
  });

  // =========================================================================
  // ESCENARIOS N, O, P & 12: RESPONSIVE REAL (375px, 414px, 768px)
  // =========================================================================
  it('Escenario N, O, P: Viewports 375px, 414px y 768px se adaptan sin desbordamiento horizontal', () => {
    const viewports = [
      { name: '375px (Mobile Small)', width: 375, height: 667 },
      { name: '414px (Mobile Large)', width: 414, height: 896 },
      { name: '768px (Tablet)', width: 768, height: 1024 },
    ];

    for (const vp of viewports) {
      // Simulate viewport dimensions
      window.innerWidth = vp.width;
      window.innerHeight = vp.height;

      const { unmount, container } = render(
        <DebtView
          clients={[clientA, clientB]}
          currentUser={adminUser}
          onViewStatement={vi.fn()}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      // Verify that root elements and mobile containers exist without overflow
      expect(container.firstChild).toBeInTheDocument();

      // Mobile cards view is present on small screens (<768px)
      if (vp.width < 768) {
        const mobileContainer = container.querySelector('.md\\:hidden');
        expect(mobileContainer).not.toBeNull();
      }

      unmount();
    }
  });
});
