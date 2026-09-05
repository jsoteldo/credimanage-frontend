import { describe, it, expect } from 'vitest';
import {
  toClientDto,
  toPublicClientDto,
  toInternalClientDto,
  parsePrismaDecimalToNumber,
} from '../balanceDto';

describe('balanceDto - Phase 2A Shadow Field & Contract Isolation', () => {
  const mockPrismaDecimal = {
    d: [6],
    e: 0,
    s: 1,
    toString: () => '6.00',
  };

  const mockRawClient = {
    id: 'cli-1',
    clientNumber: 'CLI-1091',
    name: 'Cliente Prueba',
    phone: '999888777',
    address: 'Av Principal 123',
    creditLimit: 1500,
    currentBalance: 6,
    dailyDebtBalance: mockPrismaDecimal,
    bankDebtBalance: { toString: () => '0.00' },
    balanceModelVersion: 'BALANCE_MODEL_V1',
    paymentPeriod: 'Semanal',
    paymentDay: 'Lunes',
    nextDueDate: '2026-08-10',
    status: 'Activo' as const,
    openingSnapshots: [{ id: 'snap-1' }],
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date('2026-08-01T10:00:00Z'),
  };

  describe('Precision 1: Public HTTP Contract Stability', () => {
    it('guarantees public DTO does NOT leak dailyDebtBalance, bankDebtBalance, or balanceModelVersion', () => {
      const publicDto = toPublicClientDto(mockRawClient as any);

      // Verify absence of shadow fields
      expect(publicDto).not.toHaveProperty('dailyDebtBalance');
      expect(publicDto).not.toHaveProperty('bankDebtBalance');
      expect(publicDto).not.toHaveProperty('balanceModelVersion');
      expect(publicDto).not.toHaveProperty('openingSnapshots');

      // Verify exact legacy contract keys
      const expectedKeys = [
        'id',
        'clientNumber',
        'name',
        'phone',
        'address',
        'creditLimit',
        'currentBalance',
        'paymentPeriod',
        'paymentDay',
        'nextDueDate',
        'status',
        'createdAt',
        'updatedAt',
      ];
      expect(Object.keys(publicDto).sort()).toEqual(expectedKeys.sort());

      // JSON serialization check: stringified payload must NOT contain shadow keys
      const jsonStr = JSON.stringify(publicDto);
      expect(jsonStr).not.toContain('dailyDebtBalance');
      expect(jsonStr).not.toContain('bankDebtBalance');
      expect(jsonStr).not.toContain('balanceModelVersion');
      expect(jsonStr).not.toContain('openingSnapshots');
    });

    it('toClientDto aliases to toPublicClientDto ensuring backward-compatible public safety', () => {
      const defaultDto = toClientDto(mockRawClient as any);
      expect(defaultDto).not.toHaveProperty('dailyDebtBalance');
      expect(defaultDto).not.toHaveProperty('bankDebtBalance');
      expect(defaultDto).not.toHaveProperty('balanceModelVersion');
      expect(defaultDto.currentBalance).toBe(6);
    });
  });

  describe('Precision 1: Decimal -> Number Transformation (Prepared for Future Phase 2B)', () => {
    it('converts raw Decimal objects from Prisma to pure JavaScript numbers without leaking Decimal internals', () => {
      const internalDto = toInternalClientDto(mockRawClient as any);

      // Critical assertion: dailyDebtBalance MUST be the primitive number 6, NOT an object
      expect(internalDto.dailyDebtBalance).toBe(6);
      expect(typeof internalDto.dailyDebtBalance).toBe('number');
      expect(internalDto.bankDebtBalance).toBe(0);
      expect(typeof internalDto.bankDebtBalance).toBe('number');

      // JSON serialization test: must output exact numbers in JSON payload
      const serializedJson = JSON.stringify(internalDto);
      const parsedBack = JSON.parse(serializedJson);

      expect(parsedBack.dailyDebtBalance).toBe(6);
      expect(parsedBack.bankDebtBalance).toBe(0);
      expect(typeof parsedBack.dailyDebtBalance).toBe('number');
    });

    it('parsePrismaDecimalToNumber handles null, undefined, strings, numbers, and Decimal objects safely', () => {
      expect(parsePrismaDecimalToNumber(null)).toBeUndefined();
      expect(parsePrismaDecimalToNumber(undefined)).toBeUndefined();
      expect(parsePrismaDecimalToNumber(12.34)).toBe(12.34);
      expect(parsePrismaDecimalToNumber('45.67')).toBe(45.67);
      expect(parsePrismaDecimalToNumber({ toString: () => '89.10' })).toBe(89.1);
      expect(parsePrismaDecimalToNumber('invalid')).toBeUndefined();
    });

    it('preserves undefined/null for unmigrated clients in internal DTO without injecting artificial zeros', () => {
      const mockUnmigratedClient = {
        id: 'cli-unmigrated',
        clientNumber: 'CLI-9999',
        name: 'Cliente No Migrado',
        creditLimit: 1000,
        currentBalance: 50,
        dailyDebtBalance: null,
        bankDebtBalance: null,
        balanceModelVersion: null,
        status: 'Activo' as const,
        createdAt: '2026-08-01T10:00:00Z',
        updatedAt: '2026-08-01T10:00:00Z',
      };

      const internalDto = toInternalClientDto(mockUnmigratedClient);

      expect(internalDto.dailyDebtBalance).toBeUndefined();
      expect(internalDto.bankDebtBalance).toBeUndefined();
      expect(internalDto.balanceModelVersion).toBeNull();
    });
  });
});
