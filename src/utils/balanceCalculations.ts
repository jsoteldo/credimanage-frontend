import {
  CreditPurchase,
  Payment,
  LoanCredit,
  BalanceTransfer,
  BalanceOpeningSnapshot,
} from '../types';
import { round2 } from './loanCalculations';

export interface CalculatedBalances {
  dailyDebtBalance: number;
  bankDebtBalance: number;
  currentBalance: number;
  creditExposure: number;
  availableCredit: number | 'Sin límite';
  availableCreditAmount: number;
  hasLegacyUnknownPayments: boolean;
  legacyUnknownPaymentCount: number;
}

export interface CalculateClientBalancesOptions {
  clientId: string;
  purchases: CreditPurchase[];
  payments: Payment[];
  loans: LoanCredit[];
  balanceTransfers?: BalanceTransfer[];
  openingSnapshot?: BalanceOpeningSnapshot | null;
  creditLimit?: number;
}

/**
 * Pure calculation engine for client balances.
 * 
 * Invariants:
 * 1. currentBalance === dailyDebtBalance + bankDebtBalance
 * 2. bankDebtBalance >= 0 (strictly non-negative)
 * 3. creditExposure === Math.max(0, dailyDebtBalance) + bankDebtBalance
 * 4. availableCredit === creditLimit > 0 ? Math.max(0, creditLimit - creditExposure) : 'Sin límite'
 * 5. Anulled operations (purchases, payments, loans, transfers) never participate in balances.
 */
export function calculateClientBalances(options: CalculateClientBalancesOptions): CalculatedBalances {
  const {
    clientId,
    purchases,
    payments,
    loans,
    balanceTransfers = [],
    openingSnapshot = null,
    creditLimit = 0,
  } = options;

  // --- 1. Bank Debt Calculation (bankDebtBalance) ---
  // Only consider active or overdue loans for this client
  const clientLoans = loans.filter((l) => l.clientId === clientId);
  const activeLoans = clientLoans.filter(
    (l) => l.status === 'Activo' || l.status === 'Vencido'
  );

  const rawBankDebt = activeLoans.reduce((sum, l) => {
    const pending = typeof l.pendingAmount === 'number' ? l.pendingAmount : 0;
    return sum + Math.max(0, pending);
  }, 0);
  const bankDebtBalance = Math.max(0, round2(rawBankDebt));

  // --- 2. Daily Debt Calculation (dailyDebtBalance) ---
  let dailyDebtBalance = 0;
  let legacyUnknownPaymentCount = 0;
  let hasLegacyUnknownPayments = false;

  if (openingSnapshot) {
    // Mode A: Calculated from baseline opening snapshot + subsequent movements
    const snapshotDate = openingSnapshot.migrationDate || openingSnapshot.createdAt;
    const baseDailyDebt = openingSnapshot.dailyDebtOpeningBalance || 0;

    // Active purchases strictly after snapshot date
    const subsequentPurchases = purchases.filter(
      (p) =>
        p.clientId === clientId &&
        p.status === 'Activo' &&
        !p.loanId &&
        p.debtType !== 'credit' &&
        p.date > snapshotDate
    );
    const newCharges = subsequentPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Active payments strictly after snapshot date
    const subsequentPayments = payments.filter(
      (pay) => pay.clientId === clientId && pay.status === 'Activo' && pay.date > snapshotDate
    );

    let newDailyPayments = 0;
    for (const pay of subsequentPayments) {
      if (pay.allocations && pay.allocations.length > 0) {
        for (const alloc of pay.allocations) {
          if (alloc.type === 'dailyDebt') {
            newDailyPayments += alloc.amount;
          }
        }
      } else if (pay.targetType === 'dailyDebt' || pay.targetType === 'legacyDirect') {
        newDailyPayments += pay.amount;
      } else if (pay.targetType === 'bankLoan') {
        // Does not amortize daily debt
      } else {
        // Untyped post-snapshot payment: conservatively check loanId
        if (!pay.loanId) {
          newDailyPayments += pay.amount;
        }
      }
    }

    // Active balance transfers strictly after snapshot date
    const subsequentTransfers = balanceTransfers.filter(
      (xfr) =>
        xfr.clientId === clientId &&
        xfr.status === 'Activo' &&
        xfr.sourceBalance === 'dailyDebtBalance' &&
        xfr.date > snapshotDate
    );
    const newTransfers = subsequentTransfers.reduce((sum, x) => sum + (x.amount || 0), 0);

    dailyDebtBalance = round2(baseDailyDebt + newCharges - newDailyPayments + newTransfers);
    legacyUnknownPaymentCount = openingSnapshot.legacyUnknownPaymentCount || 0;
    hasLegacyUnknownPayments = legacyUnknownPaymentCount > 0;
  } else {
    // Mode B: Full Ledger Historical Reconciliation
    // Active commercial purchases (non-loan)
    const activePurchases = purchases.filter(
      (p) => p.clientId === clientId && p.status === 'Activo' && !p.loanId && p.debtType !== 'credit'
    );
    const totalDailyCharges = round2(activePurchases.reduce((sum, p) => sum + (p.amount || 0), 0));

    // Active payments
    const activePayments = payments.filter((p) => p.clientId === clientId && p.status === 'Activo');

    let explicitDailyPayments = 0;
    let explicitBankPayments = 0;
    let legacyUnknownPaymentsTotal = 0;

    for (const pay of activePayments) {
      if (pay.allocations && pay.allocations.length > 0) {
        for (const alloc of pay.allocations) {
          if (alloc.type === 'dailyDebt') explicitDailyPayments += alloc.amount;
          if (alloc.type === 'bankLoan') explicitBankPayments += alloc.amount;
        }
      } else if (pay.targetType === 'dailyDebt' || pay.targetType === 'legacyDirect') {
        explicitDailyPayments += pay.amount;
      } else if (pay.targetType === 'bankLoan') {
        explicitBankPayments += pay.amount;
      } else {
        // No explicit targetType or allocations
        if (pay.loanId) {
          explicitBankPayments += pay.amount;
        } else {
          legacyUnknownPaymentsTotal += pay.amount;
          legacyUnknownPaymentCount++;
        }
      }
    }

    hasLegacyUnknownPayments = legacyUnknownPaymentCount > 0;

    // Total bank loan amortizations recorded across all non-annulled loans
    const totalLoansPaidAmount = clientLoans.reduce((sum, l) => {
      if (l.status === 'Anulado') return sum;
      return sum + (l.paidAmount || 0);
    }, 0);

    // Portion of untyped legacy payments that was absorbed by bank loans (cannot exceed legacy payments total)
    const remainingLoanPaidNeeded = Math.max(0, round2(totalLoansPaidAmount - explicitBankPayments));
    const legacyAbsorbedByLoans = Math.min(legacyUnknownPaymentsTotal, remainingLoanPaidNeeded);

    // Remainder of legacy payments that belongs to daily debt
    const legacyForDailyDebt = Math.max(0, round2(legacyUnknownPaymentsTotal - legacyAbsorbedByLoans));

    // Total payments attributed to daily debt
    const totalDailyPayments = round2(explicitDailyPayments + legacyForDailyDebt);

    // Active balance transfers (compensations from daily favor balance to bank loans)
    const activeTransfers = balanceTransfers.filter(
      (x) => x.clientId === clientId && x.status === 'Activo' && x.sourceBalance === 'dailyDebtBalance'
    );
    const totalTransfers = round2(activeTransfers.reduce((sum, x) => sum + (x.amount || 0), 0));

    dailyDebtBalance = round2(totalDailyCharges - totalDailyPayments + totalTransfers);
  }

  // --- 3. Consolidated Balance (currentBalance) ---
  const currentBalance = round2(dailyDebtBalance + bankDebtBalance);

  // --- 4. Credit Exposure (creditExposure) ---
  // Important: Saldo a favor (dailyDebtBalance < 0) does NOT reduce contractual credit exposure below bankDebtBalance
  const creditExposure = round2(Math.max(0, dailyDebtBalance) + bankDebtBalance);

  // --- 5. Available Credit (availableCredit) ---
  const isLimitDefined = creditLimit > 0;
  const availableCreditAmount = isLimitDefined ? Math.max(0, round2(creditLimit - creditExposure)) : 0;
  const availableCredit: number | 'Sin límite' = isLimitDefined ? availableCreditAmount : 'Sin límite';

  return {
    dailyDebtBalance,
    bankDebtBalance,
    currentBalance,
    creditExposure,
    availableCredit,
    availableCreditAmount,
    hasLegacyUnknownPayments,
    legacyUnknownPaymentCount,
  };
}

/**
 * Validates whether the calculated balances satisfy all system invariants.
 */
export function checkBalancesInvariants(balances: CalculatedBalances): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // 1. currentBalance === dailyDebtBalance + bankDebtBalance
  const expectedCurrent = round2(balances.dailyDebtBalance + balances.bankDebtBalance);
  if (Math.abs(balances.currentBalance - expectedCurrent) > 0.001) {
    violations.push(
      `Invariante 1 rota: currentBalance (${balances.currentBalance}) !== dailyDebtBalance (${balances.dailyDebtBalance}) + bankDebtBalance (${balances.bankDebtBalance})`
    );
  }

  // 2. bankDebtBalance >= 0
  if (balances.bankDebtBalance < -0.001) {
    violations.push(`Invariante 2 rota: bankDebtBalance (${balances.bankDebtBalance}) no puede ser negativo.`);
  }

  // 3. creditExposure === Math.max(0, dailyDebtBalance) + bankDebtBalance
  const expectedExposure = round2(Math.max(0, balances.dailyDebtBalance) + balances.bankDebtBalance);
  if (Math.abs(balances.creditExposure - expectedExposure) > 0.001) {
    violations.push(
      `Invariante 3 rota: creditExposure (${balances.creditExposure}) !== Math.max(0, dailyDebtBalance) + bankDebtBalance (${expectedExposure})`
    );
  }

  // 4. availableCreditAmount >= 0
  if (balances.availableCreditAmount < -0.001) {
    violations.push(
      `Invariante 4 rota: availableCreditAmount (${balances.availableCreditAmount}) no puede ser negativo.`
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
