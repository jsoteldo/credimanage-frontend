import {
  Client,
  CreditPurchase,
  Payment,
  LoanCredit,
  BalanceTransfer,
  BalanceOpeningSnapshot,
} from '../types';
import { round2 } from './loanCalculations';

export type MigrationStateStatus =
  | 'MIGRATED_VALID'
  | 'NOT_MIGRATED'
  | 'MIGRATION_STATE_INCONSISTENT';

export interface MigrationStateValidationResult {
  isMigrated: boolean;
  status: MigrationStateStatus;
  reason?: string;
  activeSnapshot?: BalanceOpeningSnapshot | null;
}

/**
 * Enforces the Single Authority Migration Invariant:
 * 
 * Source of Truth: BalanceOpeningSnapshot with migrationVersion = 'BALANCE_MODEL_V1'
 * Technical Cache / Marker: Client.balanceModelVersion
 * 
 * Invariant:
 * Client.balanceModelVersion === 'BALANCE_MODEL_V1'
 *   <===>
 * Exactly one active BalanceOpeningSnapshot exists for (clientId, 'BALANCE_MODEL_V1').
 * 
 * If there is a version without snapshot, or snapshot without version:
 * Classified as MIGRATION_STATE_INCONSISTENT.
 */
export function validateMigrationState(
  client: Client,
  snapshots: BalanceOpeningSnapshot[],
  expectedVersion = 'BALANCE_MODEL_V1'
): MigrationStateValidationResult {
  const activeSnapshots = snapshots.filter(
    (s) =>
      s.clientId === client.id &&
      s.migrationVersion === expectedVersion &&
      (s.status === 'ACTIVO' || s.status === 'CONCILIADO' || s.status === 'AJUSTE_CENTAVOS')
  );

  const hasClientVersion = client.balanceModelVersion === expectedVersion;
  const snapshotCount = activeSnapshots.length;

  if (hasClientVersion && snapshotCount === 1) {
    return {
      isMigrated: true,
      status: 'MIGRATED_VALID',
      activeSnapshot: activeSnapshots[0],
    };
  }

  if (!hasClientVersion && snapshotCount === 0) {
    return {
      isMigrated: false,
      status: 'NOT_MIGRATED',
      activeSnapshot: null,
    };
  }

  if (hasClientVersion && snapshotCount === 0) {
    return {
      isMigrated: false,
      status: 'MIGRATION_STATE_INCONSISTENT',
      reason: `Client.balanceModelVersion is '${expectedVersion}', but no active BalanceOpeningSnapshot exists in the database.`,
      activeSnapshot: null,
    };
  }

  if (!hasClientVersion && snapshotCount > 0) {
    return {
      isMigrated: false,
      status: 'MIGRATION_STATE_INCONSISTENT',
      reason: `Active BalanceOpeningSnapshot exists for '${expectedVersion}', but Client.balanceModelVersion is not set.`,
      activeSnapshot: activeSnapshots[0],
    };
  }

  // Multiple active snapshots for same version
  return {
    isMigrated: false,
    status: 'MIGRATION_STATE_INCONSISTENT',
    reason: `Integrity violation: Found ${snapshotCount} active snapshots for clientId=${client.id} and version=${expectedVersion}. Expected exactly 1.`,
    activeSnapshot: activeSnapshots[0],
  };
}

export interface SyncClientBalancesOptions {
  client: Client;
  openingSnapshot: BalanceOpeningSnapshot;
  subsequentPurchases: CreditPurchase[];
  subsequentPayments: Payment[];
  loans: LoanCredit[];
  subsequentTransfers?: BalanceTransfer[];
}

export interface SyncClientBalancesResult {
  dailyDebtBalance: number;
  bankDebtBalance: number;
  currentBalance: number;
  creditExposure: number;
  availableCredit: number | 'Sin límite';
  subsequentChargesSum: number;
  subsequentDailyPaymentsSum: number;
}

/**
 * Pure function: syncClientBalances
 * 
 * Reconstructs the exact client balances starting from the immutable BalanceOpeningSnapshot
 * baseline plus unequivocal subsequent movements occurring strictly AFTER the snapshot cut-off.
 * 
 * Never re-interprets historical legacy payments prior to the cut-off.
 */
export function syncClientBalances(options: SyncClientBalancesOptions): SyncClientBalancesResult {
  const {
    client,
    openingSnapshot,
    subsequentPurchases,
    subsequentPayments,
    loans,
    subsequentTransfers = [],
  } = options;

  const cutOffTimestamp = openingSnapshot.cutOffDate || openingSnapshot.createdAt;
  const baseDailyDebt = openingSnapshot.dailyDebtOpeningBalance || 0;

  // 1. Active purchases strictly created after the cut-off
  const validSubsequentPurchases = subsequentPurchases.filter(
    (p) =>
      p.clientId === client.id &&
      p.status === 'Activo' &&
      !p.loanId &&
      p.debtType !== 'credit' &&
      p.date > cutOffTimestamp
  );
  const subsequentChargesSum = round2(
    validSubsequentPurchases.reduce((sum, p) => sum + (p.amount || 0), 0)
  );

  // 2. Active payments strictly created after the cut-off
  const validSubsequentPayments = subsequentPayments.filter(
    (pay) => pay.clientId === client.id && pay.status === 'Activo' && pay.date > cutOffTimestamp
  );

  let subsequentDailyPaymentsSum = 0;
  for (const pay of validSubsequentPayments) {
    if (pay.allocations && pay.allocations.length > 0) {
      for (const alloc of pay.allocations) {
        if (alloc.type === 'dailyDebt') {
          subsequentDailyPaymentsSum += alloc.amount;
        }
      }
    } else if (pay.targetType === 'dailyDebt' || pay.targetType === 'legacyDirect') {
      subsequentDailyPaymentsSum += pay.amount;
    } else if (pay.targetType === 'bankLoan') {
      // Does not amortize daily debt
    } else {
      // Fallback for payments without explicit target: if not attached to a loan, goes to daily debt
      if (!pay.loanId) {
        subsequentDailyPaymentsSum += pay.amount;
      }
    }
  }
  subsequentDailyPaymentsSum = round2(subsequentDailyPaymentsSum);

  // 3. Active subsequent balance transfers (compensations from daily favor balance)
  const validSubsequentTransfers = subsequentTransfers.filter(
    (t) =>
      t.clientId === client.id &&
      t.status === 'Activo' &&
      t.sourceBalance === 'dailyDebtBalance' &&
      t.date > cutOffTimestamp
  );
  const subsequentTransfersSum = round2(
    validSubsequentTransfers.reduce((sum, t) => sum + (t.amount || 0), 0)
  );

  // 4. Daily Debt Balance
  const dailyDebtBalance = round2(
    baseDailyDebt + subsequentChargesSum - subsequentDailyPaymentsSum + subsequentTransfersSum
  );

  // 5. Bank Debt Balance: sum of pendingAmount of all active/overdue loans for this client
  const clientLoans = loans.filter((l) => l.clientId === client.id);
  const activeLoans = clientLoans.filter(
    (l) => l.status === 'Activo' || l.status === 'Vencido'
  );
  const rawBankDebt = activeLoans.reduce((sum, l) => {
    const pending = typeof l.pendingAmount === 'number' ? l.pendingAmount : 0;
    return sum + Math.max(0, pending);
  }, 0);
  const bankDebtBalance = Math.max(0, round2(rawBankDebt));

  // 6. Consolidated Balance
  const currentBalance = round2(dailyDebtBalance + bankDebtBalance);

  // 7. Credit Exposure: Saldo a favor (dailyDebt < 0) does not reduce exposure below bankDebt
  const creditExposure = round2(Math.max(0, dailyDebtBalance) + bankDebtBalance);

  // 8. Available Credit
  const creditLimit = client.creditLimit || 0;
  const availableCredit =
    creditLimit > 0 ? Math.max(0, round2(creditLimit - creditExposure)) : 'Sin límite';

  return {
    dailyDebtBalance,
    bankDebtBalance,
    currentBalance,
    creditExposure,
    availableCredit,
    subsequentChargesSum,
    subsequentDailyPaymentsSum,
  };
}
