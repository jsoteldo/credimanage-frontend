import {
  Client,
  CreditPurchase,
  Payment,
  LoanCredit,
  BalanceTransfer,
  BalanceOpeningSnapshot,
} from '../types';
import { round2 } from './loanCalculations';
import { calculateClientBalances } from './balanceCalculations';

export type DryRunClientStatus = 'CONCILIADO' | 'AJUSTE_CENTAVOS' | 'DISCREPANCIA_CRITICA';

export interface ClientDryRunDetail {
  clientId: string;
  clientNumber: string;
  currentBalanceActual: number;
  dailyDebtCalculado: number;
  bankDebtCalculado: number;
  currentBalanceCalculado: number;
  creditExposureCalculado: number;
  availableCreditCalculado: number | 'Sin límite';
  diferencia: number; // currentBalanceActual - currentBalanceCalculado
  cantidadPagosLegacyUnknown: number;
  cantidadPagosLegacyMixed: number;
  cantidadPrestamosInconsistentes: number;
  status: DryRunClientStatus;
}

export interface DryRunSummary {
  timestamp: string;
  totalClientsEvaluated: number;
  exactMatchesCount: number; // diferencia === 0.00
  minorDiffsCount: number; // 0 < |diferencia| <= 0.01
  criticalDiscrepanciesCount: number; // |diferencia| > 0.01 o préstamos inconsistentes
  totalLegacyUnknownPayments: number;
  totalInconsistentLoans: number;
  canProceedToMigration: boolean; // true solo si criticalDiscrepanciesCount === 0
}

export interface BalanceMigrationDryRunResult {
  summary: DryRunSummary;
  details: ClientDryRunDetail[];
}

export interface DryRunInputData {
  clients: Client[];
  purchases: CreditPurchase[];
  payments: Payment[];
  loans: LoanCredit[];
  balanceTransfers?: BalanceTransfer[];
  openingSnapshots?: BalanceOpeningSnapshot[];
}

/**
 * Strict READ-ONLY Dry Run Engine.
 * 
 * Guarantees:
 * - Does not mutate any input arrays or objects.
 * - Does not write to memory, disk, or remote stores.
 * - Does not persist opening snapshots.
 * - Excludes all personal data (no names, phones, addresses, notes) to guarantee privacy.
 */
export function executeBalanceMigrationDryRun(data: DryRunInputData): BalanceMigrationDryRunResult {
  const {
    clients,
    purchases,
    payments,
    loans,
    balanceTransfers = [],
    openingSnapshots = [],
  } = data;

  const details: ClientDryRunDetail[] = [];
  let exactMatchesCount = 0;
  let minorDiffsCount = 0;
  let criticalDiscrepanciesCount = 0;
  let totalLegacyUnknownPayments = 0;
  let totalInconsistentLoans = 0;

  for (const client of clients) {
    const clientPurchases = purchases.filter((p) => p.clientId === client.id);
    const clientPayments = payments.filter((p) => p.clientId === client.id);
    const clientLoans = loans.filter((l) => l.clientId === client.id);
    const clientTransfers = balanceTransfers.filter((t) => t.clientId === client.id);
    const clientSnapshot = openingSnapshots.find((s) => s.clientId === client.id) || null;

    // 1. Audit Loans Consistency
    let clientInconsistentLoans = 0;
    for (const loan of clientLoans) {
      if (loan.status === 'Anulado') continue;

      const pending = typeof loan.pendingAmount === 'number' ? loan.pendingAmount : 0;
      const paid = typeof loan.paidAmount === 'number' ? loan.paidAmount : 0;
      const total = typeof loan.totalAmount === 'number' ? loan.totalAmount : 0;

      const hasNegativeAmounts = pending < -0.001 || paid < -0.001;
      const hasMathDiscrepancy = Math.abs(total - (pending + paid)) > 0.05;

      if (hasNegativeAmounts || hasMathDiscrepancy) {
        clientInconsistentLoans++;
      }
    }

    // 2. Pure Calculation
    const calculated = calculateClientBalances({
      clientId: client.id,
      purchases: clientPurchases,
      payments: clientPayments,
      loans: clientLoans,
      balanceTransfers: clientTransfers,
      openingSnapshot: clientSnapshot,
      creditLimit: client.creditLimit,
    });

    const currentBalanceActual = round2(client.currentBalance || 0);
    const diferencia = round2(currentBalanceActual - calculated.currentBalance);
    const absDiff = Math.abs(diferencia);

    // 3. Status Classification
    let status: DryRunClientStatus;
    if (absDiff > 0.01 || clientInconsistentLoans > 0) {
      status = 'DISCREPANCIA_CRITICA';
      criticalDiscrepanciesCount++;
    } else if (absDiff > 0.0001) {
      status = 'AJUSTE_CENTAVOS';
      minorDiffsCount++;
    } else {
      status = 'CONCILIADO';
      exactMatchesCount++;
    }

    totalLegacyUnknownPayments += calculated.legacyUnknownPaymentCount;
    totalInconsistentLoans += clientInconsistentLoans;

    // 4. Record Technical Details (Privacy Protected: no client name, no phone, no address)
    details.push({
      clientId: client.id,
      clientNumber: client.clientNumber,
      currentBalanceActual,
      dailyDebtCalculado: calculated.dailyDebtBalance,
      bankDebtCalculado: calculated.bankDebtBalance,
      currentBalanceCalculado: calculated.currentBalance,
      creditExposureCalculado: calculated.creditExposure,
      availableCreditCalculado: calculated.availableCredit,
      diferencia,
      cantidadPagosLegacyUnknown: calculated.legacyUnknownPaymentCount,
      cantidadPagosLegacyMixed: 0,
      cantidadPrestamosInconsistentes: clientInconsistentLoans,
      status,
    });
  }

  const summary: DryRunSummary = {
    timestamp: new Date().toISOString(),
    totalClientsEvaluated: clients.length,
    exactMatchesCount,
    minorDiffsCount,
    criticalDiscrepanciesCount,
    totalLegacyUnknownPayments,
    totalInconsistentLoans,
    canProceedToMigration: criticalDiscrepanciesCount === 0 && totalInconsistentLoans === 0,
  };

  return {
    summary,
    details,
  };
}
