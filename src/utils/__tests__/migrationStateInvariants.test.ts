import { describe, it, expect } from 'vitest';
import { validateMigrationState } from '../balanceSync';
import { Client, BalanceOpeningSnapshot } from '../../types';

describe('migrationStateInvariants - Single Authority & "SI Y SOLO SI" Invariant', () => {
  const baseClient: Client = {
    id: 'cli-invariant',
    clientNumber: 'CLI-555',
    name: 'Cliente Invariante',
    phone: '',
    address: '',
    creditLimit: 1000,
    currentBalance: 0,
    status: 'Activo',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };

  const validSnapshot: BalanceOpeningSnapshot = {
    id: 'snap-valid',
    clientId: 'cli-invariant',
    migrationVersion: 'BALANCE_MODEL_V1',
    dailyDebtOpeningBalance: 0,
    bankDebtOpeningBalance: 0,
    currentOpeningBalance: 0,
    creditExposureOpening: 0,
    legacyUnknownPaymentCount: 0,
    status: 'ACTIVO',
    createdAt: '2026-09-01T00:00:00Z',
  };

  it('validates as MIGRATED_VALID if and only if Client.balanceModelVersion and single active Snapshot align', () => {
    const migratedClient: Client = {
      ...baseClient,
      balanceModelVersion: 'BALANCE_MODEL_V1',
      dailyDebtBalance: 0,
      bankDebtBalance: 0,
    };

    const res = validateMigrationState(migratedClient, [validSnapshot]);
    expect(res.isMigrated).toBe(true);
    expect(res.status).toBe('MIGRATED_VALID');
    expect(res.activeSnapshot).toBeDefined();
  });

  it('classifies as NOT_MIGRATED when neither Client.balanceModelVersion nor Snapshot exists', () => {
    const unmigratedClient: Client = {
      ...baseClient,
      balanceModelVersion: null,
    };

    const res = validateMigrationState(unmigratedClient, []);
    expect(res.isMigrated).toBe(false);
    expect(res.status).toBe('NOT_MIGRATED');
  });

  it('detects MIGRATION_STATE_INCONSISTENT when Client has version but NO active snapshot exists', () => {
    const ghostVersionClient: Client = {
      ...baseClient,
      balanceModelVersion: 'BALANCE_MODEL_V1', // Has version!
    };

    // No snapshot in DB
    const res = validateMigrationState(ghostVersionClient, []);
    expect(res.isMigrated).toBe(false);
    expect(res.status).toBe('MIGRATION_STATE_INCONSISTENT');
    expect(res.reason).toContain('no active BalanceOpeningSnapshot exists');
  });

  it('detects MIGRATION_STATE_INCONSISTENT when active snapshot exists but Client has NO version set', () => {
    const missingVersionClient: Client = {
      ...baseClient,
      balanceModelVersion: null, // Missing version!
    };

    // Snapshot exists in DB
    const res = validateMigrationState(missingVersionClient, [validSnapshot]);
    expect(res.isMigrated).toBe(false);
    expect(res.status).toBe('MIGRATION_STATE_INCONSISTENT');
    expect(res.reason).toContain('Client.balanceModelVersion is not set');
  });

  it('detects MIGRATION_STATE_INCONSISTENT if multiple active snapshots exist for the same version', () => {
    const client: Client = {
      ...baseClient,
      balanceModelVersion: 'BALANCE_MODEL_V1',
    };

    const duplicateSnapshot: BalanceOpeningSnapshot = {
      ...validSnapshot,
      id: 'snap-duplicate',
    };

    const res = validateMigrationState(client, [validSnapshot, duplicateSnapshot]);
    expect(res.isMigrated).toBe(false);
    expect(res.status).toBe('MIGRATION_STATE_INCONSISTENT');
    expect(res.reason).toContain('Expected exactly 1');
  });
});
