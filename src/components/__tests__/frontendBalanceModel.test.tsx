import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebtView } from '../DebtView';
import { CurrentDebtAdminModal } from '../CurrentDebtAdminModal';
import { PaymentModal } from '../PaymentModal';
import { BankView } from '../BankView';
import { StatementOfAccountModal } from '../StatementOfAccountModal';
import { ClientSelector } from '../ClientSelector';
import App from '../../App';
import { Client, LoanCredit } from '../../types';
import { mockClients, mockAdminUser, mockLoans } from '../../test/mocks/apiMock';
import { api } from '../../services/api';

vi.mock('../../services/api', () => ({
  api: {
    getMe: vi.fn(),
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

describe('FASE 2B.2: Frontend Balance Model Adaptations', () => {
  const defaultClient: Client = {
    id: 'cli-101',
    clientNumber: 'CLI-0101',
    name: 'Juan Perez',
    phone: '999888777',
    address: 'Calle Real 123',
    creditLimit: 1000,
    currentBalance: 300,
    dailyDebtBalance: 300,
    bankDebtBalance: 0,
    creditExposure: 300,
    availableCredit: 700,
    paymentPeriod: 'Semanal',
    status: 'Activo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const clientWithBankOnly: Client = {
    ...defaultClient,
    id: 'cli-bank-only',
    clientNumber: 'CLI-0102',
    name: 'Carlos Prestamo',
    currentBalance: 1000,
    dailyDebtBalance: 0,
    bankDebtBalance: 1000,
    creditExposure: 1000,
    availableCredit: 0,
  };

  const clientNoDebt: Client = {
    ...defaultClient,
    id: 'cli-clean',
    clientNumber: 'CLI-0103',
    name: 'Maria Limpia',
    currentBalance: 0,
    dailyDebtBalance: 0,
    bankDebtBalance: 0,
    creditExposure: 0,
    availableCredit: 1000,
  };

  const clientSaldoFavor: Client = {
    ...defaultClient,
    id: 'cli-favor',
    clientNumber: 'CLI-0104',
    name: 'Pedro Con Favor',
    currentBalance: -50,
    dailyDebtBalance: -50,
    bankDebtBalance: 0,
    creditExposure: 0,
    availableCredit: 1000,
  };

  const clientPennyDebt: Client = {
    ...defaultClient,
    id: 'cli-penny',
    clientNumber: 'CLI-0105',
    name: 'Lucia Un Centavo',
    currentBalance: 0.01,
    dailyDebtBalance: 0.01,
    bankDebtBalance: 0,
    creditExposure: 0.01,
    availableCredit: 999.99,
  };

  const loanA: LoanCredit = {
    id: 'loan-A',
    code: 'CR-000001',
    clientId: 'cli-multi-loan',
    date: '2026-02-01',
    capital: 300,
    interestRate: 0,
    interestAmount: 0,
    totalAmount: 300,
    paidAmount: 0,
    registeredBy: 'Admin Test',
    installmentsCount: 1,
    installmentAmount: 300,
    frequency: 'Mensual',
    firstDueDate: '2026-03-01',
    pendingAmount: 300,
    status: 'Activo',
    installments: [],
  };

  const loanB: LoanCredit = {
    id: 'loan-B',
    code: 'CR-000002',
    clientId: 'cli-multi-loan',
    date: '2026-02-05',
    capital: 700,
    interestRate: 0,
    interestAmount: 0,
    totalAmount: 700,
    paidAmount: 0,
    registeredBy: 'Admin Test',
    installmentsCount: 1,
    installmentAmount: 700,
    frequency: 'Mensual',
    firstDueDate: '2026-03-05',
    pendingAmount: 700,
    status: 'Activo',
    installments: [],
  };

  const clientMultiLoan: Client = {
    ...defaultClient,
    id: 'cli-multi-loan',
    clientNumber: 'CLI-0200',
    name: 'Cliente Con Dos Prestamos',
    currentBalance: 1200,
    dailyDebtBalance: 200,
    bankDebtBalance: 1000, // Loan A (300) + Loan B (700)
    creditExposure: 1200,
    availableCredit: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getPurchasesHistory).mockResolvedValue({ purchases: [], summary: { count: 0, totalAmount: 0 } });
    vi.mocked(api.getPaymentsHistory).mockResolvedValue({ payments: [], summary: { count: 0, totalAmount: 0 } });
  });

  // =========================================================================
  // 1. ORIGINAL BUG & DEBTVIEW CHARACTERIZATION (A, B, C, D, E, P + Bug)
  // =========================================================================
  describe('DebtView: Elimination of race condition and dailyDebtBalance rules', () => {
    it('Elimination of Loans Race Condition: DebtView does not call getAllLoans and renders instantly', () => {
      render(
        <DebtView
          clients={[defaultClient, clientWithBankOnly]}
          currentUser={mockAdminUser}
          onViewStatement={vi.fn()}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      // getAllLoans is NOT called
      expect(api.getAllLoans).not.toHaveBeenCalled();

      // Client with daily debt is shown
      expect(screen.getAllByText('Juan Perez').length).toBeGreaterThanOrEqual(1);

      // Client with only bank debt is NOT falsely shown as daily debtor even if loans are not loaded
      expect(screen.queryByText('Carlos Prestamo')).not.toBeInTheDocument();
    });

    it('A. Client with dailyDebtBalance > 0 appears in DebtView', () => {
      render(
        <DebtView
          clients={[defaultClient]}
          currentUser={mockAdminUser}
          onViewStatement={vi.fn()}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );
      expect(screen.getAllByText('Juan Perez').length).toBeGreaterThanOrEqual(1);
    });

    it('B. Client with dailyDebtBalance === 0 and bankDebtBalance > 0 does NOT appear in DebtView', () => {
      render(
        <DebtView
          clients={[clientWithBankOnly]}
          currentUser={mockAdminUser}
          onViewStatement={vi.fn()}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );
      expect(screen.queryByText('Carlos Prestamo')).not.toBeInTheDocument();
      expect(screen.getByText('No hay clientes con deuda corriente pendiente.')).toBeInTheDocument();
    });

    it('C. Client with dailyDebtBalance === 0 and bankDebtBalance === 0 does NOT appear in DebtView', () => {
      render(
        <DebtView
          clients={[clientNoDebt]}
          currentUser={mockAdminUser}
          onViewStatement={vi.fn()}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );
      expect(screen.queryByText('Maria Limpia')).not.toBeInTheDocument();
    });

    it('D. Client with dailyDebtBalance < 0 (saldo a favor) does NOT appear in DebtView', () => {
      render(
        <DebtView
          clients={[clientSaldoFavor]}
          currentUser={mockAdminUser}
          onViewStatement={vi.fn()}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );
      expect(screen.queryByText('Pedro Con Favor')).not.toBeInTheDocument();
    });

    it('E. DebtView displays client.dailyDebtBalance as daily debt amount (not currentBalance)', () => {
      // Client with daily debt = 200, currentBalance = 1200
      render(
        <DebtView
          clients={[clientMultiLoan]}
          currentUser={mockAdminUser}
          onViewStatement={vi.fn()}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );
      expect(screen.getAllByText('Cliente Con Dos Prestamos').length).toBeGreaterThanOrEqual(1);
      // Table displays S/ 200.00
      expect(screen.getAllByText('S/ 200.00').length).toBeGreaterThanOrEqual(1);
      // Does not display S/ 1,200.00 as daily debt
      expect(screen.queryByText('S/ 1,200.00')).not.toBeInTheDocument();
    });

    it('P. Client with dailyDebtBalance = 0.01 appears in DebtView (S/ 0.01 es deuda válida)', () => {
      render(
        <DebtView
          clients={[clientPennyDebt]}
          currentUser={mockAdminUser}
          onViewStatement={vi.fn()}
          onPayClient={vi.fn()}
          onAddDebtClient={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );
      expect(screen.getAllByText('Lucia Un Centavo').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('S/ 0.01').length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 2. CURRENT DEBT ADMIN MODAL (F)
  // =========================================================================
  describe('CurrentDebtAdminModal', () => {
    it('F. Displays dailyDebtBalance as "Deuda Corriente Pendiente" and currentBalance as "Saldo total"', async () => {
      vi.mocked(api.getStatementOfAccount).mockResolvedValue({
        client: clientMultiLoan,
        availableCredit: 0,
        purchases: [],
        payments: [],
        loans: [loanA, loanB],
      });

      render(
        <CurrentDebtAdminModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan}
          currentUser={mockAdminUser}
          onOpenAddDebt={vi.fn()}
          onOpenPayment={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(api.getStatementOfAccount).toHaveBeenCalledWith('cli-multi-loan');
      });

      expect(screen.getByText('Deuda Corriente Pendiente')).toBeInTheDocument();
      // Displays S/ 200.00 as daily debt
      expect(screen.getByText('S/ 200.00')).toBeInTheDocument();
      // Displays S/ 1,200.00 as saldo total consolidado
      expect(screen.getByText(/Saldo total:/i)).toBeInTheDocument();
      expect(screen.getByText('S/ 1,200.00')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. PAYMENT MODAL SEPARATION & VALIDATION (G, H, I, J, K, Q, R)
  // =========================================================================
  describe('PaymentModal: Explicit modes and loan restrictions', () => {
    it('G. In mode dailyDebt, full payoff initializes with dailyDebtBalance', async () => {
      const user = userEvent.setup();
      render(
        <PaymentModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan} // dailyDebt = 200, currentBalance = 1200
          mode="dailyDebt"
          onConfirmPayment={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Registrar Abono a Deuda Corriente' })).toBeInTheDocument();
      expect(screen.getByText('Liquidar adeudo corriente completo (S/ 200.00 Soles Peruanos)')).toBeInTheDocument();

      const checkbox = screen.getByRole('checkbox', { name: /Liquidar adeudo corriente completo/i });
      await user.click(checkbox);

      const amountInput = screen.getByPlaceholderText('0.00');
      expect(amountInput).toHaveValue(200);
    });

    it('H. In mode dailyDebt, confirming payment passes context { mode: "dailyDebt" }', async () => {
      const user = userEvent.setup();
      const onConfirmPayment = vi.fn().mockResolvedValue(undefined);

      render(
        <PaymentModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan}
          mode="dailyDebt"
          onConfirmPayment={onConfirmPayment}
        />
      );

      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '150');

      const submitBtn = screen.getByRole('button', { name: /Continuar a Confirmación/i });
      await user.click(submitBtn);

      const confirmBtn = screen.getByRole('button', { name: /Confirmar y Registrar Movimiento/i });
      await user.click(confirmBtn);

      expect(onConfirmPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 150,
          paymentMethod: 'Efectivo',
        }),
        expect.objectContaining({
          mode: 'dailyDebt',
        })
      );
    });

    it('I. In mode bankLoan, full payoff initializes with targetLoan.pendingAmount', async () => {
      const user = userEvent.setup();
      render(
        <PaymentModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan} // bankDebtBalance = 1000
          mode="bankLoan"
          targetLoan={loanA} // pendingAmount = 300
          onConfirmPayment={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Abonar a Préstamo Bancario' })).toBeInTheDocument();
      expect(screen.getByText('Liquidar préstamo completo (S/ 300.00 Soles Peruanos)')).toBeInTheDocument();

      const checkbox = screen.getByRole('checkbox', { name: /Liquidar préstamo completo/i });
      await user.click(checkbox);

      const amountInput = screen.getByPlaceholderText('0.00');
      // Full payoff is 300, NEVER 1000
      expect(amountInput).toHaveValue(300);
    });

    it('J. In mode bankLoan, confirming payment passes { mode: "bankLoan", targetLoanId: loanA.id }', async () => {
      const user = userEvent.setup();
      const onConfirmPayment = vi.fn().mockResolvedValue(undefined);

      render(
        <PaymentModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan}
          mode="bankLoan"
          targetLoan={loanA}
          onConfirmPayment={onConfirmPayment}
        />
      );

      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '100');

      const submitBtn = screen.getByRole('button', { name: /Continuar a Confirmación/i });
      await user.click(submitBtn);

      const confirmBtn = screen.getByRole('button', { name: /Confirmar y Registrar Movimiento/i });
      await user.click(confirmBtn);

      expect(onConfirmPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          paymentMethod: 'Efectivo',
        }),
        expect.objectContaining({
          mode: 'bankLoan',
          targetLoanId: 'loan-A',
        })
      );
    });

    it('K. In mode bankLoan, prevents overpayment beyond targetLoan.pendingAmount', async () => {
      const user = userEvent.setup();
      render(
        <PaymentModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan}
          mode="bankLoan"
          targetLoan={loanA} // pendingAmount = 300
          onConfirmPayment={vi.fn()}
        />
      );

      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '350'); // 350 > 300

      const submitBtn = screen.getByRole('button', { name: /Continuar a Confirmación/i });
      await user.click(submitBtn);

      expect(
        screen.getByText(/El importe a abonar \(S\/ 350.00\) no puede superar el saldo pendiente del préstamo \(S\/ 300.00\)/i)
      ).toBeInTheDocument();
    });

    it('Q & R. Two loans: Selecting Loan A pays only Loan A, payoff max is 300, NEVER 1000', async () => {
      const user = userEvent.setup();
      const onConfirmPayment = vi.fn().mockResolvedValue(undefined);

      // Client has Loan A = 300, Loan B = 700, bankDebtBalance = 1000
      render(
        <PaymentModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan}
          mode="bankLoan"
          targetLoan={loanA}
          onConfirmPayment={onConfirmPayment}
        />
      );

      // Check displayed target loan
      expect(screen.getAllByText('CR-000001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/300\.00/).length).toBeGreaterThanOrEqual(1);

      // Check full payoff checkbox
      const checkbox = screen.getByRole('checkbox', { name: /Liquidar préstamo completo/i });
      await user.click(checkbox);

      const amountInput = screen.getByPlaceholderText('0.00');
      // Full payoff must be 300, never 1000
      expect(amountInput).toHaveValue(300);

      const submitBtn = screen.getByRole('button', { name: /Continuar a Confirmación/i });
      await user.click(submitBtn);

      const confirmBtn = screen.getByRole('button', { name: /Confirmar y Registrar Movimiento/i });
      await user.click(confirmBtn);

      expect(onConfirmPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 300,
          isFullPayoff: true,
        }),
        {
          mode: 'bankLoan',
          targetLoanId: 'loan-A',
        }
      );
    });
  });

  // =========================================================================
  // 4. BANK VIEW INDIVIDUAL LOAN ABONO (L)
  // =========================================================================
  describe('BankView: Loan payment handling', () => {
    it('L. Clicking "Pagar" in BankView passes target loan and mode "bankLoan" to onPayClient', async () => {
      const user = userEvent.setup();
      const onPayClient = vi.fn();
      vi.mocked(api.getAllLoans).mockResolvedValue([loanA]);

      render(
        <BankView
          clients={[clientMultiLoan]}
          currentUser={mockAdminUser}
          onPayClient={onPayClient}
          onRefreshData={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(api.getAllLoans).toHaveBeenCalled();
      });

      const pagarBtn = screen.getAllByRole('button', { name: /Pagar/i })[0];
      await user.click(pagarBtn);

      expect(onPayClient).toHaveBeenCalledWith(clientMultiLoan, {
        mode: 'bankLoan',
        targetLoan: loanA,
      });
    });
  });

  // =========================================================================
  // 5. STATEMENT OF ACCOUNT MODAL (M + Precision 2)
  // =========================================================================
  describe('StatementOfAccountModal: Multi-loan breakdown and separate categories', () => {
    it('M. Displays separated cards for dailyDebtBalance, bankDebtBalance, and currentBalance', async () => {
      vi.mocked(api.getStatementOfAccount).mockResolvedValue({
        client: clientMultiLoan,
        availableCredit: 0,
        purchases: [],
        payments: [],
        loans: [loanA, loanB],
      });

      render(
        <StatementOfAccountModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan}
          currentUser={mockAdminUser}
          onOpenPaymentModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(api.getStatementOfAccount).toHaveBeenCalledWith('cli-multi-loan');
      });

      expect(screen.getByText('DEUDA CORRIENTE (TIENDA)')).toBeInTheDocument();
      expect(screen.getByText('S/ 200.00')).toBeInTheDocument();

      expect(screen.getByText('DEUDA BANCARIA (PRÉSTAMOS)')).toBeInTheDocument();
      expect(screen.getByText('S/ 1,000.00')).toBeInTheDocument();

      expect(screen.getByText('SALDO TOTAL CONSOLIDADO')).toBeInTheDocument();
      expect(screen.getByText('S/ 1,200.00')).toBeInTheDocument();
    });

    it('Precision 2: StatementOfAccount renders each loan with individual Abonar button triggering bankLoan mode for that specific loan', async () => {
      const user = userEvent.setup();
      const onOpenPaymentModal = vi.fn();

      vi.mocked(api.getStatementOfAccount).mockResolvedValue({
        client: clientMultiLoan,
        availableCredit: 0,
        purchases: [],
        payments: [],
        loans: [loanA, loanB],
      });

      render(
        <StatementOfAccountModal
          isOpen={true}
          onClose={vi.fn()}
          client={clientMultiLoan}
          currentUser={mockAdminUser}
          onOpenPaymentModal={onOpenPaymentModal}
          onRefreshData={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(api.getStatementOfAccount).toHaveBeenCalledWith('cli-multi-loan');
      });

      // Switch to Préstamos Bancarios tab
      const loansTab = screen.getByRole('button', { name: /Préstamos Bancarios/i });
      await user.click(loansTab);

      // Both loans should be displayed
      expect(screen.getByText('CR-000001')).toBeInTheDocument();
      expect(screen.getByText('CR-000002')).toBeInTheDocument();

      // Click Abonar on Loan A
      const abonarButtons = screen.getAllByRole('button', { name: 'Abonar' });
      await user.click(abonarButtons[0]);

      expect(onOpenPaymentModal).toHaveBeenCalledWith(
        clientMultiLoan,
        false,
        expect.objectContaining({
          mode: 'bankLoan',
          targetLoan: loanA,
        })
      );
    });
  });

  // =========================================================================
  // 6. CLIENT SELECTOR (N)
  // =========================================================================
  describe('ClientSelector: Contextual balance display', () => {
    it('N. In debt mode shows dailyDebtBalance; in bank mode shows bankDebtBalance', () => {
      const { rerender } = render(
        <ClientSelector
          clients={[clientMultiLoan]}
          selectedClient={clientMultiLoan}
          onSelectClient={vi.fn()}
          mode="debt"
        />
      );

      // In debt mode: shows "Debe: S/ 200.00"
      expect(screen.getByText(/Debe:/i)).toBeInTheDocument();
      expect(screen.getByText('S/ 200.00')).toBeInTheDocument();

      // Rerender in bank mode
      rerender(
        <ClientSelector
          clients={[clientMultiLoan]}
          selectedClient={clientMultiLoan}
          onSelectClient={vi.fn()}
          mode="bank"
        />
      );

      // In bank mode: shows "Deuda banco: S/ 1,000.00"
      expect(screen.getByText(/Deuda banco:/i)).toBeInTheDocument();
      expect(screen.getAllByText('S/ 1,000.00').length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 7. ENDPOINT CALL SITES & ANTI-STALE CLIENT STATE (O, S)
  // =========================================================================
  describe('App Call Sites & Anti-Stale Selected Client', () => {
    it('O. Modern UI invokes payDailyDebt and payLoan, NEVER legacy registerPayment', async () => {
      const user = userEvent.setup();
      vi.mocked(api.getMe).mockResolvedValue({ user: mockAdminUser });
      vi.mocked(api.getDashboardKPIs).mockResolvedValue({
        totalClients: 1,
        clientsWithDebt: 1,
        totalPendingDebt: 300,
        clientsWithBalanceInFavor: 0,
        todayPaymentsTotal: 0,
        todayPaymentsCount: 0,
      });
      vi.mocked(api.getClients).mockResolvedValue([defaultClient, clientMultiLoan]);
      vi.mocked(api.getAllLoans).mockResolvedValue([loanA]);
      vi.mocked(api.getBalanceReport).mockResolvedValue({
        report: [defaultClient],
        summary: { totalClientsDebt: 1, totalPortfolioAmount: 300 },
      });
      vi.mocked(api.payDailyDebt).mockResolvedValue({
        message: 'Abono procesado con éxito',
        payment: {} as any,
        client: { ...defaultClient, dailyDebtBalance: 200, currentBalance: 200 },
      });
      vi.mocked(api.payLoan).mockResolvedValue({
        message: 'Abono bancario procesado con éxito',
        payment: {} as any,
        client: { ...defaultClient, bankDebtBalance: 200, currentBalance: 200 },
      });

      // Render App on reports route where BalanceReportView has direct Abonar action
      window.history.pushState({}, '', '/reports');
      render(<App />);

      await waitFor(() => {
        expect(api.getBalanceReport).toHaveBeenCalled();
      });

      // 1) Test Daily Debt payment call site
      const abonarBtn = await screen.findAllByTitle('Abonar / Liquidar');
      await user.click(abonarBtn[0]);

      expect(await screen.findByRole('heading', { name: /Registrar Abono a Deuda Corriente/i })).toBeInTheDocument();

      const amountInput = screen.getByPlaceholderText('0.00');
      await user.type(amountInput, '100');

      const nextBtn = screen.getByRole('button', { name: /Continuar a Confirmación/i });
      await user.click(nextBtn);

      const confirmBtn = screen.getByRole('button', { name: /Confirmar y Registrar Movimiento/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(api.payDailyDebt).toHaveBeenCalledWith('cli-101', expect.objectContaining({ amount: 100 }));
      });

      // 2) Test Bank Loan payment call site
      window.history.pushState({}, '', '/bank');
      window.dispatchEvent(new PopStateEvent('popstate'));

      const pagarLoanBtns = await screen.findAllByRole('button', { name: /Pagar/i });
      await user.click(pagarLoanBtns[0]);

      expect(await screen.findByRole('heading', { name: /Abonar a Préstamo Bancario/i })).toBeInTheDocument();

      const nextBtnLoan = screen.getByRole('button', { name: /Continuar a Confirmación/i });
      const amountLoanInput = screen.getByPlaceholderText('0.00');
      await user.type(amountLoanInput, '100');
      await user.click(nextBtnLoan);

      const confirmBtnLoan = screen.getByRole('button', { name: /Confirmar y Registrar Movimiento/i });
      await user.click(confirmBtnLoan);

      await waitFor(() => {
        expect(api.payLoan).toHaveBeenCalledWith('loan-A', expect.objectContaining({ amount: 100 }));
      });

      // Legacy endpoint registerPayment was NEVER called by any modern flow
      expect(api.registerPayment).not.toHaveBeenCalled();
    });

    it('S. Anti-Stale Client: After backend response, selectedClient/modal immediately reflects new balance', async () => {
      const initialClient: Client = {
        ...defaultClient,
        id: 'cli-stale-test',
        name: 'Cliente Anti Stale',
        dailyDebtBalance: 300,
        currentBalance: 300,
      };

      const backendUpdatedClient: Client = {
        ...initialClient,
        dailyDebtBalance: 200,
        currentBalance: 200,
      };

      vi.mocked(api.getStatementOfAccount).mockResolvedValue({
        client: initialClient,
        availableCredit: 700,
        purchases: [],
        payments: [],
        loans: [],
      });

      // Verify modal immediately displays updated client without retaining stale reference
      const { rerender } = render(
        <StatementOfAccountModal
          isOpen={true}
          onClose={vi.fn()}
          client={initialClient}
          currentUser={mockAdminUser}
          onOpenPaymentModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      expect((await screen.findAllByText('S/ 300.00')).length).toBeGreaterThanOrEqual(1);

      // Parent receives backend update and passes fresh client
      rerender(
        <StatementOfAccountModal
          isOpen={true}
          onClose={vi.fn()}
          client={backendUpdatedClient}
          currentUser={mockAdminUser}
          onOpenPaymentModal={vi.fn()}
          onRefreshData={vi.fn()}
        />
      );

      // Immediately reflects new balance (200) and no longer displays stale 300
      expect((await screen.findAllByText('S/ 200.00')).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('S/ 300.00')).not.toBeInTheDocument();
    });
  });
});
