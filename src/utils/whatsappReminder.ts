import { Client } from '../types';
import { formatCurrency } from './loanCalculations';

export const WHATSAPP_COLLECTION_REMINDER_KEY =
  'WHATSAPP_COLLECTION_REMINDER_TEMPLATE';

export const DEFAULT_WHATSAPP_REMINDER_TEMPLATE = `Hola {cliente}, te recordamos que actualmente tienes un saldo pendiente de {saldoPendiente}.

Tu próxima fecha de pago es {proximaFechaPago}.

Si tienes alguna consulta sobre tu estado de cuenta, puedes comunicarte con nosotros.

Gracias.`;

export const ALLOWED_WHATSAPP_REMINDER_VARIABLES = [
  '{cliente}',
  '{codigoCliente}',
  '{saldoPendiente}',
  '{deudaCorriente}',
  '{deudaBancaria}',
  '{saldoConsolidado}',
  '{proximaFechaPago}',
] as const;

export const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  '{cliente}': 'Nombre del cliente',
  '{codigoCliente}': 'Código del cliente',
  '{saldoPendiente}': 'Saldo que se desea recordar',
  '{deudaCorriente}': 'Deuda corriente',
  '{deudaBancaria}': 'Deuda bancaria',
  '{saldoConsolidado}': 'Saldo total consolidado',
  '{proximaFechaPago}': 'Próxima fecha de cobro',
};

export const SIMULATED_PREVIEW_CLIENT: Partial<Client> = {
  name: 'Juan Pérez',
  clientNumber: 'CLI-1001',
  currentBalance: 1000,
  dailyDebtBalance: 300,
  bankDebtBalance: 700,
  nextDueDate: '15 de Octubre',
  paymentPeriod: 'Mensual',
  phone: '987654321',
};

export interface TemplateValidationResult {
  isValid: boolean;
  invalidVariables: string[];
}

export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{[^{}]+\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

export function validateTemplateVariables(
  template: string,
  allowedVariables: readonly string[] = ALLOWED_WHATSAPP_REMINDER_VARIABLES,
): TemplateValidationResult {
  if (typeof template !== 'string') {
    return { isValid: false, invalidVariables: ['[plantilla inválida]'] };
  }
  const variables = extractTemplateVariables(template);
  const invalidVariables = variables.filter(
    (v) => !allowedVariables.includes(v as any),
  );
  return {
    isValid: invalidVariables.length === 0,
    invalidVariables,
  };
}

/**
 * Interpolates template variables with actual or simulated client data.
 * Requirements:
 * - deudaCorriente corresponds to dailyDebtBalance.
 * - deudaBancaria corresponds to bankDebtBalance.
 * - saldoConsolidado corresponds to currentBalance.
 * - No recalculation on frontend; uses backend-delivered values.
 */
export function interpolateWhatsAppTemplate(
  template: string,
  client: Partial<Client>,
): string {
  if (!template) return '';

  const clientName = client.name || '';
  const clientCode = client.clientNumber || '';

  // Formatted currency representations
  const saldoPendiente = formatCurrency(client.currentBalance ?? 0);
  const deudaCorriente = formatCurrency(
    client.dailyDebtBalance != null
      ? Number(client.dailyDebtBalance)
      : client.currentBalance ?? 0,
  );
  const deudaBancaria = formatCurrency(
    client.bankDebtBalance != null ? Number(client.bankDebtBalance) : 0,
  );
  const saldoConsolidado = formatCurrency(client.currentBalance ?? 0);

  const proximaFechaPago =
    client.nextDueDate ||
    client.paymentDay ||
    (client.paymentPeriod ? `${client.paymentPeriod}` : 'Próxima');

  const replacements: Record<string, string> = {
    '{cliente}': clientName,
    '{codigoCliente}': clientCode,
    '{saldoPendiente}': saldoPendiente,
    '{deudaCorriente}': deudaCorriente,
    '{deudaBancaria}': deudaBancaria,
    '{saldoConsolidado}': saldoConsolidado,
    '{proximaFechaPago}': proximaFechaPago,
  };

  let result = template;
  for (const [variable, value] of Object.entries(replacements)) {
    // Replace all occurrences of variable
    result = result.split(variable).join(value);
  }

  return result;
}
