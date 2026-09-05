import { describe, it, expect } from 'vitest';
import { syncClientBalances } from '../balanceSync';
import { Client, BalanceOpeningSnapshot, CreditPurchase, Payment, LoanCredit } from '../../types';

describe('balanceSync - Deterministic Post-Cutoff Synchronization', () => {
  const baseClient: Client = {
    id: 'cli-test',
    clientNumber: 'CLI-001',
    name: 'Cliente Base',
    phone: '',
    address: '',
    creditLimit: 1000,
    currentBalance: 100,
    status: 'Activo',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  const baseSnapshot: BalanceOpeningSnapshot = {
    id: 'snap-001',
    clientId: 'cli-test',
    migrationVersion: 'BALANCE_MODEL_V1',
    cutOffDate: '2026-09-01T00:00:00.000Z',
    dailyDebtOpeningBalance: 60,
    bankDebtOpeningBalance: 40,
    currentOpeningBalance: 100,
    creditExposureOpening: 100,
    legacyUnknownPaymentCount: 0,
    status: 'ACTIVO',
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  it('preserves exact snapshot balances when no subsequent movements have occurred', () => {
    const res = syncClientBalances({
      client: baseClient,
      openingSnapshot: baseSnapshot,
      subsequentPurchases: [],
      subsequentPayments: [],
      loans: [
        {
          id: 'loan-1',
          code: 'CR-001',
          clientId: 'cli-test',
          date: '2026-08-15T00:00:00Z',
          capital: 40,
          interestRate: 0,
          interestAmount: 0,
          totalAmount: 40,
          installmentsCount: 1,
          installmentAmount: 40,
          frequency: 'Mensual',
          firstDueDate: '2026-09-15',
          paidAmount: 0,
          pendingAmount: 40,
          status: 'Activo',
          installments: [],
          registeredBy: 'Admin',
        },
      ],
    });

    expect(res.dailyDebtBalance).toBe(60);
    expect(res.bankDebtBalance).toBe(40);
    expect(res.currentBalance).toBe(100);
    expect(res.creditExposure).toBe(100);
    expect(res.availableCredit).toBe(900);
  });

  it('adds subsequent charges and ignores pre-cutoff purchases (zero historical re-interpretation)', () => {
    const preCutoffPurchase: CreditPurchase = {
      id: 'pur-old',
      clientId: 'cli-test',
      date: '2026-08-20T00:00:00Z', // Before cut-off!
      product: 'Antiguo',
      unitPrice: 999,
      quantity: 1,
      amount: 999,
      registeredBy: 'Admin',
      status: 'Activo',
    };

    const postCutoffPurchase: CreditPurchase = {
      id: 'pur-new',
      clientId: 'cli-test',
      date: '2026-09-02T00:00:00Z', // Strictly after cut-off!
      product: 'Nuevo',
      unitPrice: 50,
      quantity: 1,
      amount: 50,
      registeredBy: 'Admin',
      status: 'Activo',
    };

    const res = syncClientBalances({
      client: baseClient,
      openingSnapshot: baseSnapshot,
      subsequentPurchases: [preCutoffPurchase, postCutoffPurchase],
      subsequentPayments: [],
      loans: [],
    });

    // 60 base daily debt + 50 new purchase = 110. The 999 old purchase is excluded!
    expect(res.dailyDebtBalance).toBe(110);
    expect(res.bankDebtBalance).toBe(0);
    expect(res.currentBalance).toBe(110);
    expect(res.subsequentChargesSum).toBe(50);
  });

  it('subtracts subsequent daily debt payments accurately', () => {
    const postCutoffPayment: Payment = {
      id: 'pay-new',
      clientId: 'cli-test',
      date: '2026-09-03T00:00:00Z',
      amount: 25,
      previousBalance: 100,
      resultingBalance: 75,
      paymentMethod: 'Efectivo',
      totalCharged: 25,
      registeredBy: 'Admin',
      status: 'Activo',
      targetType: 'dailyDebt',
    };

    const res = syncClientBalances({
      client: baseClient,
      openingSnapshot: baseSnapshot,
      subsequentPurchases: [],
      subsequentPayments: [postCutoffPayment],
      loans: [],
    });

    // 60 base daily debt - 25 payment = 35
    expect(res.dailyDebtBalance).toBe(35);
    expect(res.currentBalance).toBe(35);
    expect(res.subsequentDailyPaymentsSum).toBe(25);
  });
});
