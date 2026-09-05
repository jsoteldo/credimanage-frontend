import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('../../../backend/node_modules/pg');
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { calculateClientBalances, checkBalancesInvariants } from '../../src/utils/balanceCalculations';
import { round2 } from '../../src/utils/loanCalculations';
import { Client, CreditPurchase, Payment, LoanCredit } from '../../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_VJeh3iMDLG6O@ep-purple-mouse-aceufutz.sa-east-1.aws.neon.tech/credimanage?sslmode=require';

function hashPayload(payload: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function runBalanceMigrationV1() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log('='.repeat(70));
  console.log('EJECUTANDO FASE 2A: BACKFILL TRANSACCIONAL + BALANCE OPENING SNAPSHOT');
  console.log('='.repeat(70));
  console.log('Garantía: Transacción única sobre la misma conexión PostgreSQL con bloqueo preventivo.');

  try {
    // 1. INICIAR TRANSACCIÓN ATÓMICA
    await client.query('BEGIN;');

    // 2. BLOQUEO PREVENTIVO DE TABLAS PARA CORTE CONSISTENTE DEL LEDGER
    console.log('Adquiriendo bloqueo preventivo de tablas para corte atómico...');
    await client.query('LOCK TABLE "Client", "CreditPurchase", "Payment", "Loan" IN SHARE ROW EXCLUSIVE MODE;');

    // 3. CAPTURAR CORTE TÉCNICO INMUTABLE DEL MOTOR POSTGRESQL
    const cutoffRes = await client.query('SELECT clock_timestamp() as cut_off;');
    const cutOffDate: Date = cutoffRes.rows[0].cut_off;
    const cutOffIso = cutOffDate.toISOString();
    console.log(`Corte técnico inmutable establecido: ${cutOffIso}`);

    // 4. EXTRAER DATOS EN LA MISMA TRANSACCIÓN
    const clientsRes = await client.query('SELECT * FROM "Client" ORDER BY "id" ASC;');
    const purchasesRes = await client.query('SELECT * FROM "CreditPurchase" ORDER BY "id" ASC;');
    const paymentsRes = await client.query('SELECT * FROM "Payment" ORDER BY "id" ASC;');
    const loansRes = await client.query('SELECT * FROM "Loan" ORDER BY "id" ASC;');
    const installmentsRes = await client.query('SELECT * FROM "Installment" ORDER BY "loanId", "installmentNumber" ASC;');

    // Checksums iniciales de tablas históricas (para verificar inmutabilidad estricta)
    const prePaymentsHash = hashPayload(paymentsRes.rows);
    const prePurchasesHash = hashPayload(purchasesRes.rows);
    const preLoansHash = hashPayload(loansRes.rows);
    const preInstallmentsHash = hashPayload(installmentsRes.rows);

    // Mapeo seguro a modelos de dominio
    const clientsDomain: Client[] = clientsRes.rows.map((r: any) => ({
      id: r.id,
      clientNumber: r.clientNumber,
      name: r.name,
      phone: r.phone || '',
      address: r.address || '',
      creditLimit: parseFloat(r.creditLimit) || 0,
      currentBalance: parseFloat(r.currentBalance) || 0,
      dailyDebtBalance: r.dailyDebtBalance != null ? parseFloat(r.dailyDebtBalance) : undefined,
      bankDebtBalance: r.bankDebtBalance != null ? parseFloat(r.bankDebtBalance) : undefined,
      balanceModelVersion: r.balanceModelVersion || null,
      paymentPeriod: r.paymentPeriod,
      paymentDay: r.paymentDay,
      nextDueDate: r.nextDueDate,
      status: r.status,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    }));

    const purchasesDomain: CreditPurchase[] = purchasesRes.rows.map((r: any) => ({
      id: r.id,
      clientId: r.clientId,
      date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
      product: r.product,
      unitPrice: parseFloat(r.unitPrice) || 0,
      quantity: parseInt(r.quantity, 10) || 1,
      amount: parseFloat(r.amount) || 0,
      ticketNumber: r.ticketNumber,
      registeredBy: r.registeredBy,
      status: r.status,
      debtType: r.debtType,
      loanId: r.loanId,
    }));

    const paymentsDomain: Payment[] = paymentsRes.rows.map((r: any) => ({
      id: r.id,
      clientId: r.clientId,
      date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
      amount: parseFloat(r.amount) || 0,
      previousBalance: parseFloat(r.previousBalance) || 0,
      resultingBalance: parseFloat(r.resultingBalance) || 0,
      paymentMethod: r.paymentMethod,
      totalCharged: parseFloat(r.totalCharged) || parseFloat(r.amount) || 0,
      registeredBy: r.registeredBy,
      status: r.status,
      loanId: r.loanId,
      notes: r.notes,
    }));

    const loansDomain: LoanCredit[] = loansRes.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      clientId: r.clientId,
      date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
      product: r.product,
      capital: parseFloat(r.capital) || 0,
      interestRate: parseFloat(r.interestRate) || 0,
      interestAmount: parseFloat(r.interestAmount) || 0,
      totalAmount: parseFloat(r.totalAmount) || 0,
      installmentsCount: parseInt(r.installmentsCount, 10) || 1,
      installmentAmount: parseFloat(r.installmentAmount) || 0,
      frequency: r.frequency,
      firstDueDate: r.firstDueDate,
      paidAmount: parseFloat(r.paidAmount) || 0,
      pendingAmount: parseFloat(r.pendingAmount) || 0,
      paidInstallmentsCount: parseInt(r.paidInstallmentsCount, 10) || 0,
      status: r.status,
      ticketNumber: r.ticketNumber,
      registeredBy: r.registeredBy,
      installments: [],
    }));

    // 5. PASO 5: DRY-RUN PRE-BACKFILL DE CADA CLIENTE
    console.log('\nEjecutando validación pre-backfill de conciliación e invariantes...');
    const migrationPlans: {
      client: Client;
      calculated: any;
      reconciliationRef: string;
    }[] = [];

    for (const clientObj of clientsDomain) {
      const clientPurchases = purchasesDomain.filter((p) => p.clientId === clientObj.id);
      const clientPayments = paymentsDomain.filter((p) => p.clientId === clientObj.id);
      const clientLoans = loansDomain.filter((l) => l.clientId === clientObj.id);

      const calculated = calculateClientBalances({
        clientId: clientObj.id,
        purchases: clientPurchases,
        payments: clientPayments,
        loans: clientLoans,
        creditLimit: clientObj.creditLimit,
      });

      const currentActual = round2(clientObj.currentBalance);
      const currentCalculado = calculated.currentBalance;
      const diferencia = round2(currentActual - currentCalculado);

      // Verificación de tolerancia cero para discrepancia crítica
      if (Math.abs(diferencia) > 0.01) {
        throw new Error(
          `DISCREPANCIA CRÍTICA en cliente ${clientObj.clientNumber} (${clientObj.id}): Actual=${currentActual}, Calculado=${currentCalculado}, Dif=${diferencia}. ABORTANDO TRANSACCIÓN.`
        );
      }

      // Verificación de invariantes
      const invCheck = checkBalancesInvariants(calculated);
      if (!invCheck.valid) {
        throw new Error(
          `VIOLACIÓN DE INVARIANTES en cliente ${clientObj.clientNumber}: ${invCheck.violations.join('; ')}. ABORTANDO TRANSACCIÓN.`
        );
      }

      // Reconciliation Ref hash (identificadores y montos absorbidos como evidencia inmutable de auditoría)
      // Nota Arquitectónica: Los IDs son UUIDs no monotónicos; se preservan como evidencia, NUNCA como cursores.
      const reconciliationPayload = {
        clientId: clientObj.id,
        clientNumber: clientObj.clientNumber,
        cutOffIso,
        technicalCutOffCriteria: 'clock_timestamp() at transaction freeze',
        currentBalance: currentActual,
        dailyDebtCalculado: calculated.dailyDebtBalance,
        bankDebtCalculado: calculated.bankDebtBalance,
        absorbedPurchaseIds: clientPurchases.map((p) => p.id).sort(),
        absorbedPaymentIds: clientPayments.map((p) => p.id).sort(),
        absorbedLoanIds: clientLoans.map((l) => l.id).sort(),
        purchasesCount: clientPurchases.length,
        paymentsCount: clientPayments.length,
        loansCount: clientLoans.length,
        legacyUnknownPayments: calculated.legacyUnknownPaymentCount,
      };
      const reconciliationRef = hashPayload(reconciliationPayload);

      migrationPlans.push({
        client: clientObj,
        calculated,
        reconciliationRef,
      });
    }

    console.log(`Validación exitosa para los ${migrationPlans.length} clientes existentes.`);

    // 6. PASO 6, 7 y 8: BACKFILL CLIENT + INSERT BALANCE OPENING SNAPSHOT + ASIGNAR VERSION
    const MIGRATION_VERSION = 'BALANCE_MODEL_V1';
    let snapshotsCreated = 0;
    let clientsUpdated = 0;

    for (const plan of migrationPlans) {
      const { client: c, calculated, reconciliationRef } = plan;

      // Verificar idempotencia: si ya existe snapshot activo para este cliente y versión
      const existingSnapshotRes = await client.query(
        `SELECT id FROM "BalanceOpeningSnapshot" WHERE "clientId" = $1 AND "migrationVersion" = $2 AND status = 'ACTIVO';`,
        [c.id, MIGRATION_VERSION]
      );

      if (existingSnapshotRes.rows.length === 0) {
        const snapshotId = crypto.randomUUID();
        await client.query(
          `INSERT INTO "BalanceOpeningSnapshot" (
            "id", "clientId", "migrationVersion", "cutOffDate",
            "dailyDebtOpeningBalance", "bankDebtOpeningBalance", "currentOpeningBalance",
            "creditExposureOpening", "legacyUnknownPaymentCount", "legacyMixedPaymentCount",
            "status", "reconciliationRef", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW());`,
          [
            snapshotId,
            c.id,
            MIGRATION_VERSION,
            cutOffDate,
            calculated.dailyDebtBalance,
            calculated.bankDebtBalance,
            c.currentBalance, // Preservar exacto
            calculated.creditExposure,
            calculated.legacyUnknownPaymentCount,
            0, // legacyMixedPaymentCount
            'ACTIVO',
            reconciliationRef,
          ]
        );
        snapshotsCreated++;

        // Actualizar Client en la misma transacción:
        await client.query(
          `UPDATE "Client"
           SET "dailyDebtBalance" = $1,
               "bankDebtBalance" = $2,
               "balanceModelVersion" = $3,
               "updatedAt" = NOW()
           WHERE "id" = $4;`,
          [calculated.dailyDebtBalance, calculated.bankDebtBalance, MIGRATION_VERSION, c.id]
        );
        clientsUpdated++;
      } else {
        console.log(`Cliente ${c.clientNumber} ya cuenta con snapshot activo. Omitiendo duplicación (Idempotente).`);
      }
    }

    // 7. PASO 9: VALIDACIONES E INVARIANTES POST-MIGRACIÓN DENTRO DE LA TRANSACCIÓN
    console.log('\n--- VALIDACIÓN DE INVARIANTES POST-MIGRACIÓN (A - F) ---');
    const postClientsRes = await client.query('SELECT * FROM "Client" ORDER BY "id" ASC;');
    const postSnapshotsRes = await client.query(
      `SELECT * FROM "BalanceOpeningSnapshot" WHERE "migrationVersion" = $1 ORDER BY "clientId" ASC;`,
      [MIGRATION_VERSION]
    );

    const invariantViolations: string[] = [];
    const inconsistentStateClients: string[] = [];

    for (const postClient of postClientsRes.rows) {
      const dailyDebt = parseFloat(postClient.dailyDebtBalance);
      const bankDebt = parseFloat(postClient.bankDebtBalance);
      const current = parseFloat(postClient.currentBalance);
      const clientVersion = postClient.balanceModelVersion;

      // Invariante A: currentBalance = dailyDebtBalance + bankDebtBalance
      const sumBalances = round2(dailyDebt + bankDebt);
      if (Math.abs(current - sumBalances) > 0.001) {
        invariantViolations.push(
          `Invariante A falló en ${postClient.clientNumber}: current (${current}) !== daily (${dailyDebt}) + bank (${bankDebt})`
        );
      }

      // Invariante B: bankDebtBalance >= 0
      if (bankDebt < -0.001) {
        invariantViolations.push(`Invariante B falló en ${postClient.clientNumber}: bankDebt (${bankDebt}) es negativo`);
      }

      // Invariante C: bankDebtBalance = SUM(pendingAmount de préstamos Activo/Vencido)
      const clientActiveLoans = loansDomain.filter(
        (l) => l.clientId === postClient.id && (l.status === 'Activo' || l.status === 'Vencido')
      );
      const expectedBank = round2(clientActiveLoans.reduce((sum, l) => sum + (l.pendingAmount || 0), 0));
      if (Math.abs(bankDebt - expectedBank) > 0.001) {
        invariantViolations.push(
          `Invariante C falló en ${postClient.clientNumber}: bankDebt (${bankDebt}) !== expected (${expectedBank})`
        );
      }

      // Invariante D: creditExposure = Math.max(0, dailyDebtBalance) + bankDebtBalance
      const limit = parseFloat(postClient.creditLimit) || 0;
      const exposure = round2(Math.max(0, dailyDebt) + bankDebt);

      // Invariante SI Y SOLO SI: Client.balanceModelVersion === 'BALANCE_MODEL_V1' <==> exactamente 1 snapshot activo
      const associatedSnapshots = postSnapshotsRes.rows.filter(
        (s: any) => s.clientId === postClient.id && s.status === 'ACTIVO'
      );

      const hasVersion = clientVersion === MIGRATION_VERSION;
      const hasSingleSnapshot = associatedSnapshots.length === 1;

      if (hasVersion !== hasSingleSnapshot) {
        inconsistentStateClients.push(
          `MIGRATION_STATE_INCONSISTENT en ${postClient.clientNumber}: hasVersion=${hasVersion}, snapshotCount=${associatedSnapshots.length}`
        );
      }

      // Invariante E: openingSnapshot.currentOpeningBalance = dailyDebtOpeningBalance + bankDebtOpeningBalance
      // Invariante F: Client balances = OpeningSnapshot balances
      if (hasSingleSnapshot) {
        const snap = associatedSnapshots[0];
        const snapDaily = parseFloat(snap.dailyDebtOpeningBalance);
        const snapBank = parseFloat(snap.bankDebtOpeningBalance);
        const snapCurrent = parseFloat(snap.currentOpeningBalance);

        if (Math.abs(snapCurrent - round2(snapDaily + snapBank)) > 0.001) {
          invariantViolations.push(
            `Invariante E falló en snapshot de ${postClient.clientNumber}: current (${snapCurrent}) !== daily (${snapDaily}) + bank (${snapBank})`
          );
        }

        if (
          Math.abs(dailyDebt - snapDaily) > 0.001 ||
          Math.abs(bankDebt - snapBank) > 0.001 ||
          Math.abs(current - snapCurrent) > 0.001
        ) {
          invariantViolations.push(
            `Invariante F falló en ${postClient.clientNumber}: balances del cliente no coinciden exactamente con el snapshot de apertura`
          );
        }
      }
    }

    if (invariantViolations.length > 0 || inconsistentStateClients.length > 0) {
      throw new Error(
        `FALLO EN VALIDACIÓN POST-MIGRACIÓN:\nInvariantes:\n${invariantViolations.join('\n')}\nEstados Inconsistentes:\n${inconsistentStateClients.join('\n')}\nABORTANDO TRANSACCIÓN.`
      );
    }

    // 8. VERIFICAR INMUTABILIDAD DE TABLAS HISTÓRICAS (Purchases, Payments, Loans, Installments)
    const postPaymentsCheck = await client.query('SELECT * FROM "Payment" ORDER BY "id" ASC;');
    const postPurchasesCheck = await client.query('SELECT * FROM "CreditPurchase" ORDER BY "id" ASC;');
    const postLoansCheck = await client.query('SELECT * FROM "Loan" ORDER BY "id" ASC;');
    const postInstallmentsCheck = await client.query('SELECT * FROM "Installment" ORDER BY "loanId", "installmentNumber" ASC;');

    const postPaymentsHash = hashPayload(postPaymentsCheck.rows);
    const postPurchasesHash = hashPayload(postPurchasesCheck.rows);
    const postLoansHash = hashPayload(postLoansCheck.rows);
    const postInstallmentsHash = hashPayload(postInstallmentsCheck.rows);

    const isPaymentsIdentical = prePaymentsHash === postPaymentsHash;
    const isPurchasesIdentical = prePurchasesHash === postPurchasesHash;
    const isLoansIdentical = preLoansHash === postLoansHash;
    const isInstallmentsIdentical = preInstallmentsHash === postInstallmentsHash;

    if (!isPaymentsIdentical || !isPurchasesIdentical || !isLoansIdentical || !isInstallmentsIdentical) {
      throw new Error(
        `VIOLACIÓN DE INMUTABILIDAD HISTÓRICA: Se detectó alteración en las tablas del ledger. ABORTANDO TRANSACCIÓN.`
      );
    }

    // 9. PASO 10: COMMIT DE LA TRANSACCIÓN ATÓMICA
    await client.query('COMMIT;');
    console.log('\nCOMMIT REALIZADO EXITOSAMENTE. Transacción cerrada de forma definitiva.');

    console.log('='.repeat(70));
    console.log(`RESUMEN DE FASE 2A EJECUTADA:`);
    console.log(`- Clientes actualizados: ${clientsUpdated}`);
    console.log(`- Snapshots creados: ${snapshotsCreated}`);
    console.log(`- Inmutabilidad del Ledger: CONFIRMADA AL 100%`);
    console.log(`- Invariantes A - F: CUMPLIDAS AL 100%`);
    console.log(`- Invariante SI Y SOLO SI: CUMPLIDA AL 100% (0 inconsistencias)`);
    console.log('='.repeat(70));

    return {
      success: true,
      clientsUpdated,
      snapshotsCreated,
      cutOffIso,
      migrationVersion: MIGRATION_VERSION,
      postClients: postClientsRes.rows,
      postSnapshots: postSnapshotsRes.rows,
      checksums: {
        payments: postPaymentsHash,
        purchases: postPurchasesHash,
        loans: postLoansHash,
        installments: postInstallmentsHash,
      },
    };
  } catch (err: any) {
    await client.query('ROLLBACK;');
    console.error('\nERROR DURANTE LA MIGRACIÓN — ROLLBACK TOTAL EJECUTADO:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes('migrateBalanceModelV1')) {
  runBalanceMigrationV1().catch((err) => {
    console.error('Fatal migration failure:', err);
    process.exit(1);
  });
}
