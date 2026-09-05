import { describe, it, expect } from 'vitest';
import { syncClientBalances } from '../balanceSync';
import { Client, BalanceOpeningSnapshot, CreditPurchase } from '../../types';

describe('transitionRisk - Stale Field Window and Phase 2B Synchronization Safety', () => {
  it('demonstrates why materialized fields remain stale if updated via legacy endpoints, and how syncClientBalances resolves it', () => {
    // 1. Snapshot created in Phase 2A
    const snapshotCutOff = '2026-09-01T12:00:00.000Z';

    const snapshot: BalanceOpeningSnapshot = {
      id: 'snap-1091',
      clientId: 'cli-1091',
      migrationVersion: 'BALANCE_MODEL_V1',
      cutOffDate: snapshotCutOff,
      dailyDebtOpeningBalance: 100,
      bankDebtOpeningBalance: 0,
      currentOpeningBalance: 100,
      creditExposureOpening: 100,
      legacyUnknownPaymentCount: 0,
      status: 'ACTIVO',
      createdAt: snapshotCutOff,
    };

    // Client state immediately after Phase 2A commit
    const clientStatePost2A: Client = {
      id: 'cli-1091',
      clientNumber: 'CLI-1091',
      name: 'Cliente Transición',
      phone: '',
      address: '',
      creditLimit: 1500,
      currentBalance: 100,
      dailyDebtBalance: 100, // Materialized but SHADOW/PASSIVE!
      bankDebtBalance: 0,
      balanceModelVersion: 'BALANCE_MODEL_V1',
      status: 'Activo',
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: snapshotCutOff,
    };

    // 2. A new purchase of S/ 50 arrives after cutoff, processed by a LEGACY endpoint
    const postCutoffPurchase: CreditPurchase = {
      id: 'pur-legacy-new',
      clientId: 'cli-1091',
      date: '2026-09-02T15:00:00.000Z',
      product: 'Producto Nuevo',
      unitPrice: 50,
      quantity: 1,
      amount: 50,
      registeredBy: 'Cajero',
      status: 'Activo',
    };

    // Legacy endpoint only updates currentBalance:
    const clientStateAfterLegacyOperation: Client = {
      ...clientStatePost2A,
      currentBalance: 150, // 100 + 50
      // dailyDebtBalance was NOT touched by legacy endpoint, so it remains 100 in the DB!
    };

    // 3. ASSERTION 1: Prove why dailyDebtBalance in Client table CANNOT be active in Phase 2A
    // It is stale! (currentBalance is 150, but clientState.dailyDebtBalance is still 100)
    expect(clientStateAfterLegacyOperation.currentBalance).toBe(150);
    expect(clientStateAfterLegacyOperation.dailyDebtBalance).toBe(100);
    expect(clientStateAfterLegacyOperation.dailyDebtBalance).not.toBe(
      clientStateAfterLegacyOperation.currentBalance
    );

    // 4. ASSERTION 2: Prove how Phase 2B syncClientBalances perfectly restores consistency
    const reSyncedBalances = syncClientBalances({
      client: clientStateAfterLegacyOperation,
      openingSnapshot: snapshot,
      subsequentPurchases: [postCutoffPurchase],
      subsequentPayments: [],
      loans: [],
    });

    // Re-calculated from snapshot baseline (100) + subsequent purchase (50)
    expect(reSyncedBalances.dailyDebtBalance).toBe(150);
    expect(reSyncedBalances.bankDebtBalance).toBe(0);
    expect(reSyncedBalances.currentBalance).toBe(150);
    expect(reSyncedBalances.creditExposure).toBe(150);
    expect(reSyncedBalances.availableCredit).toBe(1350); // 1500 - 150

    // Mathematical reconciliation restored with 100% precision!
    expect(reSyncedBalances.currentBalance).toBe(
      reSyncedBalances.dailyDebtBalance + reSyncedBalances.bankDebtBalance
    );
  });
});
