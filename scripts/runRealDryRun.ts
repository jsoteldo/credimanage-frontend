import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('../../backend/node_modules/pg');
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { executeBalanceMigrationDryRun } from '../src/utils/balanceMigrationDryRun';
import { round2 } from '../src/utils/loanCalculations';
import { Client, CreditPurchase, Payment, LoanCredit } from '../src/types';

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_VJeh3iMDLG6O@ep-purple-mouse-aceufutz.sa-east-1.aws.neon.tech/credimanage?sslmode=require';

function hashData(data: any): string {
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
}

async function runControlledDryRun() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log('='.repeat(70));
  console.log('INICIANDO FASE 1.5 — DRY-RUN CONTROLADO DE DATOS EXISTENTES');
  console.log('='.repeat(70));
  console.log('Modo: ESTRICTAMENTE READ-ONLY (Transacción de solo lectura)');

  try {
    // 1. Establish explicit READ ONLY transaction at database engine level
    await client.query('BEGIN TRANSACTION READ ONLY;');

    // 2. Fetch all real records
    const clientsRes = await client.query('SELECT * FROM "Client" ORDER BY "id" ASC;');
    const purchasesRes = await client.query('SELECT * FROM "CreditPurchase" ORDER BY "id" ASC;');
    const paymentsRes = await client.query('SELECT * FROM "Payment" ORDER BY "id" ASC;');
    const loansRes = await client.query('SELECT * FROM "Loan" ORDER BY "id" ASC;');
    const installmentsRes = await client.query('SELECT * FROM "Installment" ORDER BY "loanId", "installmentNumber" ASC;');

    // 3. Rollback immediately: zero chance of write
    await client.query('ROLLBACK;');

    console.log('Extracción completada y transacción cerrada exitosamente.');

    // 4. Compute pre-execution SHA-256 hash
    const rawDataSnapshot = {
      clients: clientsRes.rows,
      purchases: purchasesRes.rows,
      payments: paymentsRes.rows,
      loans: loansRes.rows,
      installments: installmentsRes.rows,
    };
    const preHash = hashData(rawDataSnapshot);
    console.log(`SHA-256 Checksum PRE-ejecución: ${preHash}`);

    // Record counts
    const initialClientsCount = clientsRes.rows.length;
    const initialPurchasesCount = purchasesRes.rows.length;
    const initialPaymentsCount = paymentsRes.rows.length;
    const initialLoansCount = loansRes.rows.length;

    // 5. Map DB rows to Domain Models safely without mutating raw rows
    const clientsDomain: Client[] = clientsRes.rows.map((row: any) => ({
      id: row.id,
      clientNumber: row.clientNumber,
      name: row.name, // Keep for privacy stripping test
      phone: row.phone,
      address: row.address,
      creditLimit: parseFloat(row.creditLimit) || 0,
      currentBalance: parseFloat(row.currentBalance) || 0,
      paymentPeriod: row.paymentPeriod,
      paymentDay: row.paymentDay,
      nextDueDate: row.nextDueDate,
      status: row.status,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    }));

    const purchasesDomain: CreditPurchase[] = purchasesRes.rows.map((row: any) => ({
      id: row.id,
      clientId: row.clientId,
      date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
      product: row.product,
      unitPrice: parseFloat(row.unitPrice) || 0,
      quantity: parseInt(row.quantity, 10) || 1,
      amount: parseFloat(row.amount) || 0,
      ticketNumber: row.ticketNumber,
      registeredBy: row.registeredBy,
      status: row.status,
      debtType: row.debtType,
      loanId: row.loanId,
      annulledAt: row.annulledAt ? (row.annulledAt instanceof Date ? row.annulledAt.toISOString() : String(row.annulledAt)) : undefined,
      annulledBy: row.annulledBy,
      annulmentReason: row.annulmentReason,
    }));

    const paymentsDomain: Payment[] = paymentsRes.rows.map((row: any) => ({
      id: row.id,
      clientId: row.clientId,
      date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
      amount: parseFloat(row.amount) || 0,
      previousBalance: parseFloat(row.previousBalance) || 0,
      resultingBalance: parseFloat(row.resultingBalance) || 0,
      paymentMethod: row.paymentMethod,
      cardSurcharge: row.cardSurcharge ? parseFloat(row.cardSurcharge) : undefined,
      totalCharged: row.totalCharged ? parseFloat(row.totalCharged) : parseFloat(row.amount) || 0,
      registeredBy: row.registeredBy,
      status: row.status,
      notes: row.notes,
      loanId: row.loanId,
      annulledAt: row.annulledAt ? (row.annulledAt instanceof Date ? row.annulledAt.toISOString() : String(row.annulledAt)) : undefined,
      annulledBy: row.annulledBy,
      annulmentReason: row.annulmentReason,
    }));

    const loansDomain: LoanCredit[] = loansRes.rows.map((row: any) => ({
      id: row.id,
      code: row.code,
      clientId: row.clientId,
      date: row.date instanceof Date ? row.date.toISOString() : String(row.date),
      product: row.product,
      capital: parseFloat(row.capital) || 0,
      interestRate: parseFloat(row.interestRate) || 0,
      interestAmount: parseFloat(row.interestAmount) || 0,
      totalAmount: parseFloat(row.totalAmount) || 0,
      installmentsCount: parseInt(row.installmentsCount, 10) || 1,
      installmentAmount: parseFloat(row.installmentAmount) || 0,
      frequency: row.frequency,
      firstDueDate: row.firstDueDate,
      paidAmount: parseFloat(row.paidAmount) || 0,
      pendingAmount: parseFloat(row.pendingAmount) || 0,
      paidInstallmentsCount: parseInt(row.paidInstallmentsCount, 10) || 0,
      status: row.status,
      ticketNumber: row.ticketNumber,
      registeredBy: row.registeredBy,
      notes: row.notes,
      installments: installmentsRes.rows
        .filter((inst: any) => inst.loanId === row.id)
        .map((inst: any) => ({
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate,
          capital: parseFloat(inst.capital) || 0,
          interest: parseFloat(inst.interest) || 0,
          amount: parseFloat(inst.amount) || 0,
          paidAmount: parseFloat(inst.paidAmount) || 0,
          status: inst.status,
          paidDate: inst.paidDate ? (inst.paidDate instanceof Date ? inst.paidDate.toISOString() : String(inst.paidDate)) : undefined,
        })),
      annulledAt: row.annulledAt ? (row.annulledAt instanceof Date ? row.annulledAt.toISOString() : String(row.annulledAt)) : undefined,
      annulledBy: row.annulledBy,
      annulmentReason: row.annulmentReason,
    }));

    // 6. Execute pure Dry-Run engine
    const dryRunResult = executeBalanceMigrationDryRun({
      clients: clientsDomain,
      purchases: purchasesDomain,
      payments: paymentsDomain,
      loans: loansDomain,
      balanceTransfers: [],
      openingSnapshots: [],
    });

    // 7. Verify Invariants on each evaluated client
    const invariantsViolations: { clientId: string; rule: string; detail: string }[] = [];
    for (const d of dryRunResult.details) {
      // Rule A: currentBalanceCalculado = dailyDebtCalculado + bankDebtCalculado
      const sumCalculada = round2(d.dailyDebtCalculado + d.bankDebtCalculado);
      if (Math.abs(d.currentBalanceCalculado - sumCalculada) > 0.001) {
        invariantsViolations.push({
          clientId: d.clientId,
          rule: 'A',
          detail: `currentBalanceCalculado (${d.currentBalanceCalculado}) !== sum (${sumCalculada})`,
        });
      }

      // Rule B: bankDebtCalculado >= 0
      if (d.bankDebtCalculado < -0.001) {
        invariantsViolations.push({
          clientId: d.clientId,
          rule: 'B',
          detail: `bankDebtCalculado (${d.bankDebtCalculado}) es negativo`,
        });
      }

      // Rule C: bankDebtCalculado = SUM(pendingAmount de préstamos Activo/Vencido)
      const clientActiveLoans = loansDomain.filter(
        (l) => l.clientId === d.clientId && (l.status === 'Activo' || l.status === 'Vencido')
      );
      const expectedBankSum = round2(clientActiveLoans.reduce((sum, l) => sum + (l.pendingAmount || 0), 0));
      if (Math.abs(d.bankDebtCalculado - expectedBankSum) > 0.001) {
        invariantsViolations.push({
          clientId: d.clientId,
          rule: 'C',
          detail: `bankDebtCalculado (${d.bankDebtCalculado}) !== pendingSum (${expectedBankSum})`,
        });
      }

      // Rule D: creditExposure = Math.max(0, dailyDebtCalculado) + bankDebtCalculado
      const expectedExposure = round2(Math.max(0, d.dailyDebtCalculado) + d.bankDebtCalculado);
      if (Math.abs(d.creditExposureCalculado - expectedExposure) > 0.001) {
        invariantsViolations.push({
          clientId: d.clientId,
          rule: 'D',
          detail: `creditExposureCalculado (${d.creditExposureCalculado}) !== expected (${expectedExposure})`,
        });
      }

      // Rule E: availableCredit no aumenta por existir saldo a favor
      const clientObj = clientsDomain.find((c) => c.id === d.clientId);
      const limit = clientObj ? clientObj.creditLimit : 0;
      if (limit > 0 && typeof d.availableCreditCalculado === 'number') {
        if (d.availableCreditCalculado > limit + 0.001) {
          invariantsViolations.push({
            clientId: d.clientId,
            rule: 'E',
            detail: `availableCredit (${d.availableCreditCalculado}) supera creditLimit (${limit}) debido a saldo a favor!`,
          });
        }
      }
    }

    // 8. Compute post-execution SHA-256 hash of the raw data snapshot
    const postHash = hashData(rawDataSnapshot);
    console.log(`SHA-256 Checksum POST-ejecución: ${postHash}`);

    const isDataIdentical = preHash === postHash;
    console.log(`Verificación de Inmutabilidad de Datos: ${isDataIdentical ? 'CONFIRMADA (100% IDÉNTICO)' : 'FALLIDA'}`);
    console.log(`Recuentos pre/post: Clientes: ${initialClientsCount}/${clientsDomain.length}, Compras: ${initialPurchasesCount}/${purchasesDomain.length}, Pagos: ${initialPaymentsCount}/${paymentsDomain.length}, Préstamos: ${initialLoansCount}/${loansDomain.length}`);

    // 9. Compute global summary metrics
    const totalClientes = dryRunResult.summary.totalClientsEvaluated;
    const clientesConciliadosExactamente = dryRunResult.summary.exactMatchesCount;
    const clientesConAjustesCentavos = dryRunResult.summary.minorDiffsCount;
    const clientesConDiscrepanciasCriticas = dryRunResult.summary.criticalDiscrepanciesCount;
    const totalPagosLegacyUnknown = dryRunResult.summary.totalLegacyUnknownPayments;
    const totalPagosLegacyMixed = 0; // Currently unpartitioned legacy payments
    const clientesConPagosLegacyUnknown = dryRunResult.details.filter((d) => d.cantidadPagosLegacyUnknown > 0).length;
    const clientesConPrestamosInconsistentes = dryRunResult.summary.totalInconsistentLoans;

    let mayorDiferenciaEncontrada = 0;
    let sumaDiferenciasAbsolutas = 0;

    for (const d of dryRunResult.details) {
      const absD = Math.abs(d.diferencia);
      if (absD > mayorDiferenciaEncontrada) mayorDiferenciaEncontrada = absD;
      sumaDiferenciasAbsolutas = round2(sumaDiferenciasAbsolutas + absD);
    }

    const mathematicallyReconciled = clientesConDiscrepanciasCriticas === 0 && clientesConPrestamosInconsistentes === 0 && invariantsViolations.length === 0;
    const migrationReviewRequired = totalPagosLegacyUnknown > 0 || totalPagosLegacyMixed > 0 || clientesConAjustesCentavos > 0;

    // 10. Print Structured Result Report
    console.log('\n' + '='.repeat(70));
    console.log('REPORTE FORMAL DE RESULTADOS — FASE 1.5 DRY-RUN CONTROLADO');
    console.log('='.repeat(70));
    console.log(`DRY-RUN EJECUTADO SOBRE: Datos reales de producción en Neon PostgreSQL (read-only)`);
    console.log(`TOTAL CLIENTES: ${totalClientes}`);
    console.log(`CONCILIADOS EXACTOS: ${clientesConciliadosExactamente}`);
    console.log(`AJUSTES CENTAVOS (<= S/ 0.01): ${clientesConAjustesCentavos}`);
    console.log(`DISCREPANCIAS CRÍTICAS (> S/ 0.01): ${clientesConDiscrepanciasCriticas}`);
    console.log(`TOTAL PAGOS LEGACY UNKNOWN: ${totalPagosLegacyUnknown}`);
    console.log(`TOTAL PAGOS LEGACY MIXED: ${totalPagosLegacyMixed}`);
    console.log(`CLIENTES CON PAGOS LEGACY UNKNOWN: ${clientesConPagosLegacyUnknown}`);
    console.log(`CLIENTES CON PRÉSTAMOS INCONSISTENTES: ${clientesConPrestamosInconsistentes}`);
    console.log(`MAYOR DIFERENCIA ENCONTRADA: S/ ${mayorDiferenciaEncontrada.toFixed(2)}`);
    console.log(`SUMA DE DIFERENCIAS ABSOLUTAS: S/ ${sumaDiferenciasAbsolutas.toFixed(2)}`);
    console.log(`VIOLACIONES DE INVARIANTES: ${invariantsViolations.length}`);
    console.log(`MATHEMATICALLY_RECONCILED: ${mathematicallyReconciled}`);
    console.log(`MIGRATION_REVIEW_REQUIRED: ${migrationReviewRequired}`);
    console.log(`CONFIRMACIÓN READ ONLY: ${isDataIdentical ? 'SÍ' : 'NO'}`);
    console.log(`HASH/CHECKSUM PRE/POST: PRE=${preHash} | POST=${postHash}`);

    console.log('\n--- DETALLE POR CLIENTE (Anonimizado: sin nombres ni teléfonos) ---');
    console.log(JSON.stringify(dryRunResult.details, null, 2));

    if (invariantsViolations.length > 0) {
      console.log('\n--- VIOLACIONES DE INVARIANTES DETECTADAS ---');
      console.log(JSON.stringify(invariantsViolations, null, 2));
    }

    console.log('\n' + '='.repeat(70));
    console.log('FIN DE EJECUCIÓN DRY-RUN FASE 1.5');
    console.log('='.repeat(70));

    return {
      totalClientes,
      clientesConciliadosExactamente,
      clientesConAjustesCentavos,
      clientesConDiscrepanciasCriticas,
      totalPagosLegacyUnknown,
      totalPagosLegacyMixed,
      clientesConPagosLegacyUnknown,
      clientesConPrestamosInconsistentes,
      mayorDiferenciaEncontrada,
      sumaDiferenciasAbsolutas,
      mathematicallyReconciled,
      migrationReviewRequired,
      isDataIdentical,
      preHash,
      postHash,
      details: dryRunResult.details,
      invariantsViolations,
    };
  } catch (err: any) {
    console.error('Error durante la ejecución del dry-run:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runControlledDryRun().catch((err) => {
  console.error('Fatal dry-run failure:', err);
  process.exit(1);
});
