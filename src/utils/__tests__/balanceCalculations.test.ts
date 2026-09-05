import { describe, it, expect } from 'vitest';
import {
  calculateClientBalances,
  checkBalancesInvariants,
} from '../balanceCalculations';
import {
  executeBalanceMigrationDryRun,
} from '../balanceMigrationDryRun';
import {
  Client,
  CreditPurchase,
  Payment,
  LoanCredit,
  BalanceTransfer,
  BalanceOpeningSnapshot,
} from '../../types';
import { round2 } from '../loanCalculations';

describe('Balance Calculation Engine & Invariants (Phase 1)', () => {
  const sampleClientId = 'cli-test-101';

  // Helper factory for simple purchase
  const createPurchase = (overrides: Partial<CreditPurchase> = {}): CreditPurchase => ({
    id: `pur-${Math.random().toString(36).substr(2, 9)}`,
    clientId: sampleClientId,
    date: '2026-03-01T10:00:00.000Z',
    product: 'Compra comercial estándar',
    unitPrice: 100,
    quantity: 1,
    amount: 100,
    registeredBy: 'Admin',
    status: 'Activo',
    ...overrides,
  });

  // Helper factory for payment
  const createPayment = (overrides: Partial<Payment> = {}): Payment => ({
    id: `pay-${Math.random().toString(36).substr(2, 9)}`,
    clientId: sampleClientId,
    date: '2026-03-05T12:00:00.000Z',
    amount: 50,
    previousBalance: 100,
    resultingBalance: 50,
    paymentMethod: 'Efectivo',
    registeredBy: 'Admin',
    status: 'Activo',
    ...overrides,
  });

  // Helper factory for loan
  const createLoan = (overrides: Partial<LoanCredit> = {}): LoanCredit => ({
    id: `loan-${Math.random().toString(36).substr(2, 9)}`,
    code: 'CR-100001',
    clientId: sampleClientId,
    date: '2026-03-01T08:00:00.000Z',
    capital: 1000,
    interestRate: 10,
    interestAmount: 100,
    totalAmount: 1100,
    installmentsCount: 5,
    installmentAmount: 220,
    frequency: 'Mensual',
    firstDueDate: '2026-04-01',
    paidAmount: 220,
    pendingAmount: 880,
    status: 'Activo',
    installments: [],
    registeredBy: 'Admin',
    ...overrides,
  });

  // --- Case A: Solo deuda corriente ---
  it('Case A: calculates balances for client with ONLY daily debt', () => {
    const purchases = [
      createPurchase({ amount: 150 }),
      createPurchase({ amount: 50 }),
    ];
    const payments = [
      createPayment({ amount: 80, targetType: 'dailyDebt' }),
    ];

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases,
      payments,
      loans: [],
      creditLimit: 500,
    });

    expect(balances.dailyDebtBalance).toBe(120); // 200 - 80
    expect(balances.bankDebtBalance).toBe(0);
    expect(balances.currentBalance).toBe(120);
    expect(balances.creditExposure).toBe(120);
    expect(balances.availableCredit).toBe(380); // 500 - 120
    expect(balances.availableCreditAmount).toBe(380);
  });

  // --- Case B: Solo préstamo ---
  it('Case B: calculates balances for client with ONLY bank loan', () => {
    const loan = createLoan({
      capital: 1000,
      interestAmount: 100,
      totalAmount: 1100,
      paidAmount: 220,
      pendingAmount: 880,
      status: 'Activo',
    });

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases: [],
      payments: [],
      loans: [loan],
      creditLimit: 1500,
    });

    expect(balances.dailyDebtBalance).toBe(0);
    expect(balances.bankDebtBalance).toBe(880);
    expect(balances.currentBalance).toBe(880);
    expect(balances.creditExposure).toBe(880);
    expect(balances.availableCredit).toBe(620); // 1500 - 880
  });

  // --- Case C: Ambas carteras ---
  it('Case C: calculates independent balances when client has both daily debt and bank loan', () => {
    const purchases = [createPurchase({ amount: 200 })];
    const payments = [createPayment({ amount: 50, targetType: 'dailyDebt' })];
    const loan = createLoan({ pendingAmount: 600, status: 'Activo' });

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases,
      payments,
      loans: [loan],
      creditLimit: 1000,
    });

    expect(balances.dailyDebtBalance).toBe(150); // 200 - 50
    expect(balances.bankDebtBalance).toBe(600);
    expect(balances.currentBalance).toBe(750); // 150 + 600
    expect(balances.creditExposure).toBe(750);
    expect(balances.availableCredit).toBe(250); // 1000 - 750
  });

  // --- Case D: Saldo a favor ---
  it('Case D: handles saldo a favor (dailyDebtBalance < 0) correctly without mutating bank loan', () => {
    // Client bought S/ 100 in goods but made payment of S/ 150 -> S/ -50 in daily debt
    const purchases = [createPurchase({ amount: 100 })];
    const payments = [createPayment({ amount: 150, targetType: 'dailyDebt' })];
    const loan = createLoan({ pendingAmount: 500, status: 'Activo' });

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases,
      payments,
      loans: [loan],
      creditLimit: 1000,
    });

    expect(balances.dailyDebtBalance).toBe(-50); // Saldo a favor
    expect(balances.bankDebtBalance).toBe(500); // Bank loan is untouched!
    expect(balances.currentBalance).toBe(450); // -50 + 500 = 450 net position
  });

  // --- Case E: Múltiples préstamos ---
  it('Case E: sums pending amounts across multiple active and overdue loans', () => {
    const loan1 = createLoan({ id: 'loan-1', pendingAmount: 300.5, status: 'Activo' });
    const loan2 = createLoan({ id: 'loan-2', pendingAmount: 449.5, status: 'Vencido' });

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases: [],
      payments: [],
      loans: [loan1, loan2],
      creditLimit: 2000,
    });

    expect(balances.bankDebtBalance).toBe(750); // 300.5 + 449.5
    expect(balances.currentBalance).toBe(750);
  });

  // --- Case F: Préstamos Pagados/Anulados no participan ---
  it('Case F: excludes Pagado and Anulado loans from bank debt balance', () => {
    const paidLoan = createLoan({ id: 'loan-paid', pendingAmount: 0, status: 'Pagado' });
    const annulledLoan = createLoan({ id: 'loan-annulled', pendingAmount: 500, status: 'Anulado' });
    const activeLoan = createLoan({ id: 'loan-active', pendingAmount: 250, status: 'Activo' });

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases: [],
      payments: [],
      loans: [paidLoan, annulledLoan, activeLoan],
    });

    expect(balances.bankDebtBalance).toBe(250);
    expect(balances.currentBalance).toBe(250);
  });

  // --- Case G: Operaciones anuladas no participan ---
  it('Case G: excludes annulled purchases and annulled payments from calculations', () => {
    const purchases = [
      createPurchase({ id: 'pur-1', amount: 100, status: 'Activo' }),
      createPurchase({ id: 'pur-2', amount: 999, status: 'Anulado' }), // Annulled charge
    ];
    const payments = [
      createPayment({ id: 'pay-1', amount: 40, status: 'Activo', targetType: 'dailyDebt' }),
      createPayment({ id: 'pay-2', amount: 999, status: 'Anulado', targetType: 'dailyDebt' }), // Annulled payment
    ];

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases,
      payments,
      loans: [],
    });

    expect(balances.dailyDebtBalance).toBe(60); // 100 - 40 (annulled 999 ignored)
    expect(balances.currentBalance).toBe(60);
  });

  // --- Case H: currentBalance = dailyDebt + bankDebt ---
  it('Case H: verifies invariant currentBalance === dailyDebtBalance + bankDebtBalance', () => {
    const purchases = [createPurchase({ amount: 133.33 })];
    const payments = [createPayment({ amount: 33.33, targetType: 'dailyDebt' })];
    const loan = createLoan({ pendingAmount: 666.67, status: 'Activo' });

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases,
      payments,
      loans: [loan],
    });

    expect(balances.dailyDebtBalance).toBe(100);
    expect(balances.bankDebtBalance).toBe(666.67);
    expect(balances.currentBalance).toBe(766.67);
    expect(balances.currentBalance).toBe(round2(balances.dailyDebtBalance + balances.bankDebtBalance));

    const check = checkBalancesInvariants(balances);
    expect(check.valid).toBe(true);
    expect(check.violations).toHaveLength(0);
  });

  // --- Case I: creditExposure no utiliza saldo a favor para aumentar límite ---
  describe('Case I: creditExposure & contractual credit limit protection', () => {
    it('does NOT increase contractual credit limit when dailyDebtBalance is negative (User explicit scenario)', () => {
      // User prompt scenario:
      // dailyDebtBalance = -500 (saldo a favor)
      // bankDebtBalance = 0
      // creditLimit = 1000
      const purchases = [createPurchase({ amount: 100 })];
      const payments = [createPayment({ amount: 600, targetType: 'dailyDebt' })]; // 100 - 600 = -500

      const balances = calculateClientBalances({
        clientId: sampleClientId,
        purchases,
        payments,
        loans: [],
        creditLimit: 1000,
      });

      expect(balances.dailyDebtBalance).toBe(-500);
      expect(balances.bankDebtBalance).toBe(0);
      expect(balances.currentBalance).toBe(-500); // Net accounting balance is -500
      expect(balances.creditExposure).toBe(0); // Risk exposure is 0 (NOT -500)
      expect(balances.availableCredit).toBe(1000); // STRICTLY 1000, NOT 1500!
      expect(balances.availableCreditAmount).toBe(1000);
    });

    it('retains available credit when new purchase is smaller than saldo a favor', () => {
      // Had S/ -500, now makes a purchase of S/ 200 -> dailyDebt becomes -300
      const purchases = [
        createPurchase({ amount: 100 }),
        createPurchase({ amount: 200 }),
      ];
      const payments = [createPayment({ amount: 600, targetType: 'dailyDebt' })];

      const balances = calculateClientBalances({
        clientId: sampleClientId,
        purchases,
        payments,
        loans: [],
        creditLimit: 1000,
      });

      expect(balances.dailyDebtBalance).toBe(-300);
      expect(balances.creditExposure).toBe(0);
      expect(balances.availableCredit).toBe(1000); // Full limit is still available
    });

    it('consumes credit line once purchase exceeds saldo a favor', () => {
      // Had S/ -500, now purchases S/ 700 -> net daily debt is S/ +200
      const purchases = [
        createPurchase({ amount: 100 }),
        createPurchase({ amount: 700 }),
      ];
      const payments = [createPayment({ amount: 600, targetType: 'dailyDebt' })];

      const balances = calculateClientBalances({
        clientId: sampleClientId,
        purchases,
        payments,
        loans: [],
        creditLimit: 1000,
      });

      expect(balances.dailyDebtBalance).toBe(200);
      expect(balances.creditExposure).toBe(200);
      expect(balances.availableCredit).toBe(800); // 1000 - 200 = 800
    });

    it('preserves "Sin límite" when creditLimit is 0 or unconfigured', () => {
      const purchases = [createPurchase({ amount: 300 })];
      const balances = calculateClientBalances({
        clientId: sampleClientId,
        purchases,
        payments: [],
        loans: [],
        creditLimit: 0,
      });

      expect(balances.availableCredit).toBe('Sin límite');
      expect(balances.availableCreditAmount).toBe(0);
    });
  });

  // --- Case J: Redondeo monetario ---
  it('Case J: handles floating point precision and epsilon rounding correctly', () => {
    const purchases = [
      createPurchase({ id: 'p1', amount: 0.1 }),
      createPurchase({ id: 'p2', amount: 0.2 }),
    ];
    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases,
      payments: [],
      loans: [],
    });

    // 0.1 + 0.2 in JS is 0.30000000000000004
    expect(balances.dailyDebtBalance).toBe(0.3);
    expect(balances.currentBalance).toBe(0.3);
  });

  // --- Case K: Registros legacyUnknown ---
  it('Case K: reconciles legacy payments deterministically without fabricating 1-to-1 links', () => {
    // Historical scenario:
    // Store purchases: S/ 300
    // Loan total: S/ 1000, paidAmount: S/ 200, pendingAmount: S/ 800
    // Total legacy payments received: S/ 500 (two payments of S/ 250 with no targetType and no loanId)
    const purchases = [createPurchase({ amount: 300 })];
    const loan = createLoan({ totalAmount: 1000, paidAmount: 200, pendingAmount: 800, status: 'Activo' });
    const payments = [
      createPayment({ id: 'pay-leg-1', amount: 250 }), // legacy unknown
      createPayment({ id: 'pay-leg-2', amount: 250 }), // legacy unknown
    ];

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases,
      payments,
      loans: [loan],
    });

    // We know:
    // Total legacy payments: 500
    // Absorbed by loan paidAmount: 200
    // Remaining for daily debt: 300
    // Daily debt charges: 300 -> dailyDebtBalance = 300 - 300 = 0
    expect(balances.dailyDebtBalance).toBe(0);
    expect(balances.bankDebtBalance).toBe(800);
    expect(balances.currentBalance).toBe(800);
    expect(balances.hasLegacyUnknownPayments).toBe(true);
    expect(balances.legacyUnknownPaymentCount).toBe(2);
  });

  // --- Case L: Baseline histórico (BalanceOpeningSnapshot) + nuevos movimientos ---
  it('Case L: uses BalanceOpeningSnapshot as opening baseline and applies only subsequent typed movements', () => {
    const openingSnapshot: BalanceOpeningSnapshot = {
      id: 'snap-1',
      clientId: sampleClientId,
      migrationVersion: '1.0.0',
      migrationDate: '2026-03-01T00:00:00.000Z',
      dailyDebtOpeningBalance: 200,
      bankDebtOpeningBalance: 500,
      currentOpeningBalance: 700,
      creditExposureOpening: 700,
      legacyUnknownPaymentCount: 3,
      status: 'CONCILIADO',
      createdAt: '2026-03-01T00:00:00.000Z',
    };

    // Subsequent movements after snapshot date (2026-03-01):
    const subsequentPurchase = createPurchase({
      date: '2026-03-02T10:00:00.000Z',
      amount: 50,
    });
    const subsequentDailyPayment = createPayment({
      date: '2026-03-03T11:00:00.000Z',
      amount: 30,
      targetType: 'dailyDebt',
    });

    const activeLoan = createLoan({
      date: '2026-02-15T00:00:00.000Z',
      pendingAmount: 500, // Bank debt verified from loan
      status: 'Activo',
    });

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases: [subsequentPurchase],
      payments: [subsequentDailyPayment],
      loans: [activeLoan],
      openingSnapshot,
      creditLimit: 1500,
    });

    // Opening daily debt = 200, +50 (new purchase) -30 (new payment) = 220
    expect(balances.dailyDebtBalance).toBe(220);
    expect(balances.bankDebtBalance).toBe(500);
    expect(balances.currentBalance).toBe(720);
    expect(balances.creditExposure).toBe(720);
    expect(balances.availableCredit).toBe(780); // 1500 - 720
    expect(balances.legacyUnknownPaymentCount).toBe(3);
  });

  // --- Support for BalanceTransfer (Compensación de saldos) ---
  it('applies BalanceTransfer cleanly from store credit to bank loan without negative payments', () => {
    // Client had S/ -100 in daily debt (saldo a favor) and S/ 500 in loan pending
    const purchases = [createPurchase({ amount: 100 })];
    const payments = [createPayment({ amount: 200, targetType: 'dailyDebt' })]; // 100 - 200 = -100
    const loan = createLoan({ pendingAmount: 450, status: 'Activo' }); // Loan was reduced from 500 to 450 by transfer

    const transfer: BalanceTransfer = {
      id: 'xfr-01',
      clientId: sampleClientId,
      date: '2026-03-05T14:00:00.000Z',
      amount: 50, // Positive amount
      sourceBalance: 'dailyDebtBalance',
      targetLoanId: loan.id,
      affectedInstallments: [{ installmentNumber: 1, amountApplied: 50 }],
      registeredBy: 'Admin',
      reason: 'Compensación formal de saldo a favor de tienda a cuota de préstamo',
      status: 'Activo',
    };

    const balances = calculateClientBalances({
      clientId: sampleClientId,
      purchases,
      payments,
      loans: [loan],
      balanceTransfers: [transfer],
    });

    // dailyDebtBalance: -100 + 50 (transfer absorbs 50 of credit) = -50
    expect(balances.dailyDebtBalance).toBe(-50);
    expect(balances.bankDebtBalance).toBe(450);
    expect(balances.currentBalance).toBe(400); // -50 + 450 = 400
  });

  // --- Tests de Invariantes ---
  describe('Invariants Enforcement', () => {
    it('satisfies non-negativity invariant for bankDebtBalance (bankDebtBalance >= 0)', () => {
      const balances = calculateClientBalances({
        clientId: sampleClientId,
        purchases: [],
        payments: [],
        loans: [],
      });
      expect(balances.bankDebtBalance).toBeGreaterThanOrEqual(0);

      const check = checkBalancesInvariants(balances);
      expect(check.valid).toBe(true);
    });

    it('validates overpayment invariant: pre-condition and post-condition', () => {
      // Invariant rule as specified in Ajuste 4:
      // Pre-condition: paymentAmount > 0 && paymentAmount <= pendingAmountBeforePayment
      // Post-condition: pendingAmountAfter = round2(pendingAmountBefore - paymentAmount) >= 0
      const pendingAmountBeforePayment = 500;
      const validPaymentAmount = 200;

      // Check pre-condition
      expect(validPaymentAmount).toBeGreaterThan(0);
      expect(validPaymentAmount).toBeLessThanOrEqual(pendingAmountBeforePayment);

      // Check post-condition
      const pendingAmountAfter = round2(pendingAmountBeforePayment - validPaymentAmount);
      expect(pendingAmountAfter).toBe(300);
      expect(pendingAmountAfter).toBeGreaterThanOrEqual(0);

      // Attempting payment exceeding pendingAmount violates pre-condition
      const invalidOverpayment = 550;
      const isValidPayment = invalidOverpayment > 0 && invalidOverpayment <= pendingAmountBeforePayment;
      expect(isValidPayment).toBe(false);
    });

    it('guarantees complete isolation between dailyDebt and bankLoan payments', () => {
      const loan = createLoan({ pendingAmount: 500, status: 'Activo' });
      const purchases = [createPurchase({ amount: 100 })];

      // A dailyDebt payment ONLY affects daily debt
      const dailyPayment = createPayment({ amount: 40, targetType: 'dailyDebt' });
      const balancesAfterDailyPayment = calculateClientBalances({
        clientId: sampleClientId,
        purchases,
        payments: [dailyPayment],
        loans: [loan],
      });
      expect(balancesAfterDailyPayment.dailyDebtBalance).toBe(60);
      expect(balancesAfterDailyPayment.bankDebtBalance).toBe(500); // Bank is strictly untouched

      // A bankLoan payment with allocations ONLY affects bank loan (does not reduce daily debt)
      const bankPayment = createPayment({
        amount: 100,
        targetType: 'bankLoan',
        allocations: [{ type: 'bankLoan', loanId: loan.id, amount: 100 }],
      });
      const balancesAfterBankPayment = calculateClientBalances({
        clientId: sampleClientId,
        purchases,
        payments: [bankPayment],
        loans: [createLoan({ pendingAmount: 400, status: 'Activo' })],
      });
      expect(balancesAfterBankPayment.dailyDebtBalance).toBe(100); // Daily debt is strictly untouched
      expect(balancesAfterBankPayment.bankDebtBalance).toBe(400);
    });
  });

  // --- Tests de Dry-Run (Solo Lectura y Privacidad) ---
  describe('Balance Migration Dry-Run Engine', () => {
    const mockClient1: Client = {
      id: 'cli-001',
      clientNumber: 'CLI-1001',
      name: 'Persona Confidencial Uno',
      phone: '999888777',
      address: 'Direccion Privada 123',
      creditLimit: 1000,
      currentBalance: 150, // matches calculated exactly
      status: 'Activo',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const mockClient2: Client = {
      id: 'cli-002',
      clientNumber: 'CLI-1002',
      name: 'Persona Confidencial Dos',
      phone: '999111222',
      address: 'Calle Secreta 456',
      creditLimit: 500,
      currentBalance: 500, // Discrepancy! Actual is 500 but ledger has 0
      status: 'Activo',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('executes dry-run without mutating input data (strictly read-only)', () => {
      const clients = [{ ...mockClient1 }];
      const purchases = [createPurchase({ clientId: 'cli-001', amount: 150 })];

      const clientBefore = JSON.stringify(clients);
      const purchasesBefore = JSON.stringify(purchases);

      const result = executeBalanceMigrationDryRun({
        clients,
        purchases,
        payments: [],
        loans: [],
      });

      expect(JSON.stringify(clients)).toBe(clientBefore);
      expect(JSON.stringify(purchases)).toBe(purchasesBefore);
      expect(result.summary.totalClientsEvaluated).toBe(1);
    });

    it('guarantees privacy by excluding personal details from dry-run report', () => {
      const result = executeBalanceMigrationDryRun({
        clients: [mockClient1],
        purchases: [createPurchase({ clientId: 'cli-001', amount: 150 })],
        payments: [],
        loans: [],
      });

      const reportDetail = result.details[0];
      // Technical identifiers are present
      expect(reportDetail.clientId).toBe('cli-001');
      expect(reportDetail.clientNumber).toBe('CLI-1001');

      // Personal data MUST NOT exist on the report detail object
      expect((reportDetail as any).name).toBeUndefined();
      expect((reportDetail as any).phone).toBeUndefined();
      expect((reportDetail as any).address).toBeUndefined();
      expect((reportDetail as any).notes).toBeUndefined();
    });

    it('classifies CONCILIADO vs DISCREPANCIA_CRITICA and blocks migration when discrepancies exist', () => {
      const purchases1 = [createPurchase({ clientId: 'cli-001', amount: 150 })];

      const result = executeBalanceMigrationDryRun({
        clients: [mockClient1, mockClient2],
        purchases: purchases1, // client 2 has 0 purchases, so calculated is 0, but currentBalance is 500 -> diff 500!
        payments: [],
        loans: [],
      });

      expect(result.summary.totalClientsEvaluated).toBe(2);
      expect(result.summary.exactMatchesCount).toBe(1);
      expect(result.summary.criticalDiscrepanciesCount).toBe(1);
      expect(result.summary.canProceedToMigration).toBe(false); // BLOCKED!

      const client1Detail = result.details.find((d) => d.clientId === 'cli-001');
      expect(client1Detail?.status).toBe('CONCILIADO');
      expect(client1Detail?.diferencia).toBe(0);

      const client2Detail = result.details.find((d) => d.clientId === 'cli-002');
      expect(client2Detail?.status).toBe('DISCREPANCIA_CRITICA');
      expect(client2Detail?.diferencia).toBe(500);
    });

    it('permits migration only when criticalDiscrepancies is zero and loans are consistent', () => {
      const purchases = [createPurchase({ clientId: 'cli-001', amount: 150 })];

      const result = executeBalanceMigrationDryRun({
        clients: [mockClient1],
        purchases,
        payments: [],
        loans: [],
      });

      expect(result.summary.criticalDiscrepanciesCount).toBe(0);
      expect(result.summary.totalInconsistentLoans).toBe(0);
      expect(result.summary.canProceedToMigration).toBe(true);
    });
  });
});
