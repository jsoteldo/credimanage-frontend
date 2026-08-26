import { PaymentFrequency, LoanInstallment, InstallmentStatus } from '../types';

/**
 * Utility to round numbers cleanly to 2 decimal places to avoid floating point precision issues.
 */
export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a number to Peruvian currency string (S/ 1,234.56)
 */
export function formatCurrency(amount: number): string {
  return `S/ ${amount.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Calculates due date based on starting date, installment index, and payment frequency.
 * Index 0 is the firstDueDate.
 */
export function calculateDueDate(firstDueDateStr: string, index: number, frequency: PaymentFrequency): string {
  if (index === 0) return firstDueDateStr;

  // Split YYYY-MM-DD safely without timezone shifts
  const [yearStr, monthStr, dayStr] = firstDueDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);

  const date = new Date(year, month, day);

  if (frequency === 'Semanal') {
    date.setDate(date.getDate() + 7 * index);
  } else if (frequency === 'Quincenal') {
    date.setDate(date.getDate() + 15 * index);
  } else if (frequency === 'Mensual') {
    // Add months preserving the day where possible
    const targetMonth = month + index;
    date.setMonth(targetMonth);
    // If the day shifted because previous month had fewer days (e.g. Feb 31 -> Mar 3), clamp to end of month
    const expectedMonth = (targetMonth % 12 + 12) % 12;
    if (date.getMonth() !== expectedMonth) {
      date.setDate(0); // last day of target month
    }
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface LoanCalculationParams {
  capital: number;
  interestRate: number; // in percentage, e.g. 10 for 10%
  installmentsCount: number; // e.g. 5
  frequency: PaymentFrequency;
  firstDueDate: string; // YYYY-MM-DD
}

export interface LoanCalculationResult {
  capital: number;
  interestRate: number;
  interestAmount: number;
  totalAmount: number;
  installmentsCount: number;
  installmentAmount: number;
  frequency: PaymentFrequency;
  firstDueDate: string;
  installments: LoanInstallment[];
}

/**
 * Computes the full loan structure, financial sums, and installment schedule.
 */
export function calculateLoanSchedule(params: LoanCalculationParams): LoanCalculationResult {
  const capital = Math.max(0, round2(params.capital));
  const interestRate = Math.max(0, params.interestRate);
  const installmentsCount = Math.max(1, Math.floor(params.installmentsCount || 1));
  const frequency = params.frequency || 'Mensual';
  const firstDueDate = params.firstDueDate || new Date().toISOString().split('T')[0];

  // Financial formulas:
  // INTERÉS TOTAL = CAPITAL × PORCENTAJE DE INTERÉS / 100
  const interestAmount = round2((capital * interestRate) / 100);

  // TOTAL A PAGAR = CAPITAL + INTERÉS TOTAL
  const totalAmount = round2(capital + interestAmount);

  // Base values per installment
  const baseInstallmentAmount = round2(totalAmount / installmentsCount);
  const baseCapitalPerInstallment = round2(capital / installmentsCount);
  const baseInterestPerInstallment = round2(interestAmount / installmentsCount);

  const todayStr = new Date().toISOString().split('T')[0];
  const installments: LoanInstallment[] = [];

  let accumulatedCapital = 0;
  let accumulatedInterest = 0;
  let accumulatedTotal = 0;

  for (let i = 1; i <= installmentsCount; i++) {
    const isLast = i === installmentsCount;
    const dueDate = calculateDueDate(firstDueDate, i - 1, frequency);

    let cap = isLast ? round2(capital - accumulatedCapital) : baseCapitalPerInstallment;
    let int = isLast ? round2(interestAmount - accumulatedInterest) : baseInterestPerInstallment;
    let tot = isLast ? round2(totalAmount - accumulatedTotal) : round2(cap + int);

    accumulatedCapital = round2(accumulatedCapital + cap);
    accumulatedInterest = round2(accumulatedInterest + int);
    accumulatedTotal = round2(accumulatedTotal + tot);

    // Initial status: if due date is before today, it is marked as 'Vencida', otherwise 'Pendiente'
    let status: InstallmentStatus = 'Pendiente';
    if (dueDate < todayStr) {
      status = 'Vencida';
    }

    installments.push({
      installmentNumber: i,
      dueDate,
      capital: cap,
      interest: int,
      amount: tot,
      paidAmount: 0,
      status,
    });
  }

  return {
    capital,
    interestRate,
    interestAmount,
    totalAmount,
    installmentsCount,
    installmentAmount: baseInstallmentAmount,
    frequency,
    firstDueDate,
    installments,
  };
}

/**
 * Format a YYYY-MM-DD date string to a readable Spanish string like "18/09/2026"
 */
export function formatSpanishDate(isoDateString: string): string {
  if (!isoDateString) return '-';
  const parts = isoDateString.split('T')[0].split('-');
  if (parts.length !== 3) return isoDateString;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}
