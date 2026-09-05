import { describe, it, expect } from 'vitest';
import {
  round2,
  formatCurrency,
  calculateDueDate,
  calculateLoanSchedule,
  formatSpanishDate,
} from '../loanCalculations';

describe('Financial Logic Characterization (loanCalculations.ts)', () => {
  describe('round2', () => {
    it('should round numbers to 2 decimal places with EPSILON protection', () => {
      expect(round2(10.555)).toBe(10.56);
      expect(round2(10.554)).toBe(10.55);
      expect(round2(1.005)).toBe(1.01);
      expect(round2(0)).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format amounts with S/ prefix and 2 decimals', () => {
      const formatted = formatCurrency(1234.5);
      expect(formatted).toMatch(/^S\/\s/);
      expect(formatted).toContain('1');
      expect(formatted).toContain('234');
      expect(formatted).toContain('50');
    });

    it('should format 0 as S/ 0.00 (or localized equivalent)', () => {
      const formatted = formatCurrency(0);
      expect(formatted).toMatch(/^S\/\s.*0.*00/);
    });
  });

  describe('calculateDueDate', () => {
    it('should return the initial date for index 0', () => {
      expect(calculateDueDate('2026-03-01', 0, 'Semanal')).toBe('2026-03-01');
      expect(calculateDueDate('2026-03-01', 0, 'Quincenal')).toBe('2026-03-01');
      expect(calculateDueDate('2026-03-01', 0, 'Mensual')).toBe('2026-03-01');
    });

    it('should correctly increment dates for Semanal frequency (+7 days per index)', () => {
      expect(calculateDueDate('2026-03-01', 1, 'Semanal')).toBe('2026-03-08');
      expect(calculateDueDate('2026-03-01', 2, 'Semanal')).toBe('2026-03-15');
      expect(calculateDueDate('2026-03-01', 4, 'Semanal')).toBe('2026-03-29');
    });

    describe('Quincena Comercial (Quincenal frequency)', () => {
      it('alternates between day 15 and month-end when starting on day 15 (15/03/2026)', () => {
        expect(calculateDueDate('2026-03-15', 0, 'Quincenal')).toBe('2026-03-15');
        expect(calculateDueDate('2026-03-15', 1, 'Quincenal')).toBe('2026-03-31');
        expect(calculateDueDate('2026-03-15', 2, 'Quincenal')).toBe('2026-04-15');
        expect(calculateDueDate('2026-03-15', 3, 'Quincenal')).toBe('2026-04-30');
        expect(calculateDueDate('2026-03-15', 4, 'Quincenal')).toBe('2026-05-15');
        expect(calculateDueDate('2026-03-15', 5, 'Quincenal')).toBe('2026-05-31');
      });

      it('alternates correctly through February in non-leap year (31/01/2026 -> 15/02/2026 -> 28/02/2026 -> 15/03/2026)', () => {
        expect(calculateDueDate('2026-01-31', 0, 'Quincenal')).toBe('2026-01-31');
        expect(calculateDueDate('2026-01-31', 1, 'Quincenal')).toBe('2026-02-15');
        expect(calculateDueDate('2026-01-31', 2, 'Quincenal')).toBe('2026-02-28');
        expect(calculateDueDate('2026-01-31', 3, 'Quincenal')).toBe('2026-03-15');
      });

      it('alternates correctly through February in leap year 2028 (31/01/2028 -> 15/02/2028 -> 29/02/2028 -> 15/03/2028)', () => {
        expect(calculateDueDate('2028-01-31', 0, 'Quincenal')).toBe('2028-01-31');
        expect(calculateDueDate('2028-01-31', 1, 'Quincenal')).toBe('2028-02-15');
        expect(calculateDueDate('2028-01-31', 2, 'Quincenal')).toBe('2028-02-29');
        expect(calculateDueDate('2028-01-31', 3, 'Quincenal')).toBe('2028-03-15');
      });

      it('handles starting on day 15 in February for non-leap and leap years', () => {
        // Non-leap year 2026
        expect(calculateDueDate('2026-02-15', 1, 'Quincenal')).toBe('2026-02-28');
        expect(calculateDueDate('2026-02-15', 2, 'Quincenal')).toBe('2026-03-15');

        // Leap year 2028
        expect(calculateDueDate('2028-02-15', 1, 'Quincenal')).toBe('2028-02-29');
        expect(calculateDueDate('2028-02-15', 2, 'Quincenal')).toBe('2028-03-15');
      });

      it('handles starting on month-end of a 30-day month (30/04/2026)', () => {
        expect(calculateDueDate('2026-04-30', 0, 'Quincenal')).toBe('2026-04-30');
        expect(calculateDueDate('2026-04-30', 1, 'Quincenal')).toBe('2026-05-15');
        expect(calculateDueDate('2026-04-30', 2, 'Quincenal')).toBe('2026-05-31');
      });

      it('correctly transitions across year boundary (15/12/2026 -> 31/12/2026 -> 15/01/2027)', () => {
        expect(calculateDueDate('2026-12-15', 1, 'Quincenal')).toBe('2026-12-31');
        expect(calculateDueDate('2026-12-15', 2, 'Quincenal')).toBe('2027-01-15');
        expect(calculateDueDate('2026-12-31', 1, 'Quincenal')).toBe('2027-01-15');
        expect(calculateDueDate('2026-12-31', 2, 'Quincenal')).toBe('2027-01-31');
      });

      it('maintains explicit fallback (+15 days per index) when initial date is neither day 15 nor month-end', () => {
        expect(calculateDueDate('2026-03-01', 1, 'Quincenal')).toBe('2026-03-16');
        expect(calculateDueDate('2026-03-01', 2, 'Quincenal')).toBe('2026-03-31');
      });
    });

    it('should correctly increment dates for Mensual frequency (+1 month per index)', () => {
      expect(calculateDueDate('2026-01-15', 1, 'Mensual')).toBe('2026-02-15');
      expect(calculateDueDate('2026-01-15', 2, 'Mensual')).toBe('2026-03-15');
    });

    it('should handle month-end clamping when target month has fewer days', () => {
      // Jan 31 + 1 month in non-leap year -> Feb 28
      const dueFeb = calculateDueDate('2025-01-31', 1, 'Mensual');
      expect(dueFeb).toBe('2025-02-28');
    });
  });

  describe('calculateLoanSchedule', () => {
    it('should compute standard schedule accurately with single installment', () => {
      const result = calculateLoanSchedule({
        capital: 1000,
        interestRate: 10,
        installmentsCount: 1,
        frequency: 'Mensual',
        firstDueDate: '2026-10-01',
      });

      expect(result.capital).toBe(1000);
      expect(result.interestRate).toBe(10);
      expect(result.interestAmount).toBe(100);
      expect(result.totalAmount).toBe(1100);
      expect(result.installmentsCount).toBe(1);
      expect(result.installmentAmount).toBe(1100);
      expect(result.installments).toHaveLength(1);
      expect(result.installments[0]).toEqual({
        installmentNumber: 1,
        dueDate: '2026-10-01',
        capital: 1000,
        interest: 100,
        amount: 1100,
        paidAmount: 0,
        status: 'Pendiente',
      });
    });

    it('should distribute capital and interest evenly and adjust last installment for rounding differences', () => {
      // 1000 capital, 10% interest = 1100 total, 3 installments:
      // 1100 / 3 = 366.67
      // 1000 / 3 = 333.33
      // 100 / 3 = 33.33
      const result = calculateLoanSchedule({
        capital: 1000,
        interestRate: 10,
        installmentsCount: 3,
        frequency: 'Semanal',
        firstDueDate: '2099-01-01',
      });

      expect(result.installments).toHaveLength(3);

      const sumCap = round2(result.installments.reduce((acc, i) => acc + i.capital, 0));
      const sumInt = round2(result.installments.reduce((acc, i) => acc + i.interest, 0));
      const sumTot = round2(result.installments.reduce((acc, i) => acc + i.amount, 0));

      expect(sumCap).toBe(1000);
      expect(sumInt).toBe(100);
      expect(sumTot).toBe(1100);

      // Verify last installment absorption
      expect(result.installments[0].capital).toBe(333.33);
      expect(result.installments[0].interest).toBe(33.33);
      expect(result.installments[1].capital).toBe(333.33);
      expect(result.installments[1].interest).toBe(33.33);
      expect(result.installments[2].capital).toBe(333.34); // absorbed 0.01 remainder
      expect(result.installments[2].interest).toBe(33.34); // absorbed 0.01 remainder
    });

    it('generates loan schedule with Quincena Comercial dates alternating 15th and month-end', () => {
      const result = calculateLoanSchedule({
        capital: 1200,
        interestRate: 10,
        installmentsCount: 4,
        frequency: 'Quincenal',
        firstDueDate: '2026-03-15',
      });

      expect(result.installments).toHaveLength(4);
      expect(result.installments[0].dueDate).toBe('2026-03-15');
      expect(result.installments[1].dueDate).toBe('2026-03-31');
      expect(result.installments[2].dueDate).toBe('2026-04-15');
      expect(result.installments[3].dueDate).toBe('2026-04-30');
    });

    it('should mark past due dates as Vencida and future due dates as Pendiente', () => {
      const result = calculateLoanSchedule({
        capital: 500,
        interestRate: 5,
        installmentsCount: 2,
        frequency: 'Semanal',
        firstDueDate: '2020-01-01', // clearly in the past
      });

      expect(result.installments[0].status).toBe('Vencida');
      expect(result.installments[1].status).toBe('Vencida');
    });

    it('should handle boundary parameters like 0 capital or negative numbers gracefully', () => {
      const result = calculateLoanSchedule({
        capital: -100,
        interestRate: -5,
        installmentsCount: 0,
        frequency: 'Mensual',
        firstDueDate: '',
      });

      expect(result.capital).toBe(0);
      expect(result.interestRate).toBe(0);
      expect(result.interestAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.installmentsCount).toBe(1);
    });
  });

  describe('formatSpanishDate', () => {
    it('should format ISO dates YYYY-MM-DD to DD/MM/YYYY', () => {
      expect(formatSpanishDate('2026-09-18')).toBe('18/09/2026');
      expect(formatSpanishDate('2026-01-05T12:00:00.000Z')).toBe('05/01/2026');
    });

    it('should return "-" for falsy inputs and original string if unexpected format', () => {
      expect(formatSpanishDate('')).toBe('-');
      expect(formatSpanishDate('invalid-date')).toBe('invalid-date');
    });
  });
});
