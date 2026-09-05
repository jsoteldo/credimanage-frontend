import { Client } from '../types';

export interface RawPrismaClient {
  id: string;
  clientNumber: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  creditLimit: number | string | { toString(): string };
  currentBalance: number | string | { toString(): string };
  dailyDebtBalance?: number | string | { toString(): string } | null;
  bankDebtBalance?: number | string | { toString(): string } | null;
  balanceModelVersion?: string | null;
  paymentPeriod?: any;
  paymentDay?: string | null;
  nextDueDate?: string | null;
  status: any;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: any;
}

/**
 * Public HTTP Client Contract (Phase 2A compliant).
 * 
 * Strict boundary: dailyDebtBalance, bankDebtBalance, and balanceModelVersion are
 * MATERIALIZED BUT PASSIVE / SHADOW fields.
 * Under no circumstance does the public HTTP API expose them in Phase 2A.
 */
export interface PublicClientDto {
  id: string;
  clientNumber: string;
  name: string;
  phone: string;
  address: string;
  creditLimit: number;
  currentBalance: number;
  paymentPeriod: any;
  paymentDay: string;
  nextDueDate: string;
  status: any;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parses any Prisma Decimal or numeric representation into a pure JavaScript number.
 * 
 * Prepares and guarantees precision for Decimal(12, 2) -> number conversion
 * for the internal balance calculation engine and future Phase 2B.
 */
export function parsePrismaDecimalToNumber(val: any): number | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : parsed;
  }
  if (typeof val === 'object' && typeof val.toString === 'function') {
    const parsed = parseFloat(val.toString());
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Converts a raw Prisma Client into the STRICT Public HTTP Client DTO.
 * 
 * Guarantees:
 * - Shadow fields (dailyDebtBalance, bankDebtBalance, balanceModelVersion, openingSnapshots)
 *   are NEVER exposed to the public API response.
 * - Exact key-set matches the existing HTTP contract.
 */
export function toPublicClientDto(raw: RawPrismaClient): PublicClientDto {
  return {
    id: raw.id,
    clientNumber: raw.clientNumber,
    name: raw.name,
    phone: raw.phone || '',
    address: raw.address || '',
    creditLimit: parsePrismaDecimalToNumber(raw.creditLimit) || 0,
    currentBalance: parsePrismaDecimalToNumber(raw.currentBalance) || 0,
    paymentPeriod: raw.paymentPeriod,
    paymentDay: raw.paymentDay || '',
    nextDueDate: raw.nextDueDate || '',
    status: raw.status,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : String(raw.updatedAt),
  };
}

/**
 * Standard toClientDto: maps to the Public HTTP Contract by default in Phase 2A.
 * Prevents accidental field leakage through res.json(toClientDto(client)).
 */
export function toClientDto(raw: RawPrismaClient): PublicClientDto {
  return toPublicClientDto(raw);
}

/**
 * Converts a raw Prisma Client into the Internal Domain Model (Phase 2B preparation & Auditing).
 * 
 * Used by:
 * - Diagnostic & post-migration audit scripts.
 * - Internal balance calculation engines.
 * 
 * Guarantees:
 * - Prisma Decimal objects are serialized into primitive JavaScript numbers (no Decimal leaks).
 */
export function toInternalClientDto(raw: RawPrismaClient): Client {
  return {
    id: raw.id,
    clientNumber: raw.clientNumber,
    name: raw.name,
    phone: raw.phone || '',
    address: raw.address || '',
    creditLimit: parsePrismaDecimalToNumber(raw.creditLimit) || 0,
    currentBalance: parsePrismaDecimalToNumber(raw.currentBalance) || 0,
    dailyDebtBalance: parsePrismaDecimalToNumber(raw.dailyDebtBalance),
    bankDebtBalance: parsePrismaDecimalToNumber(raw.bankDebtBalance),
    balanceModelVersion: raw.balanceModelVersion || null,
    paymentPeriod: raw.paymentPeriod,
    paymentDay: raw.paymentDay || '',
    nextDueDate: raw.nextDueDate || '',
    status: raw.status,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : String(raw.updatedAt),
  };
}
