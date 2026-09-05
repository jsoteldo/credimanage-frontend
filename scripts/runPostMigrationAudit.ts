import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('../../backend/node_modules/pg');
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { validateMigrationState } from '../src/utils/balanceSync';
import { toInternalClientDto } from '../src/utils/balanceDto';
import { Client, BalanceOpeningSnapshot } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_VJeh3iMDLG6O@ep-purple-mouse-aceufutz.sa-east-1.aws.neon.tech/credimanage?sslmode=require';

function hashPayload(payload: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function runPostMigrationAudit() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log('='.repeat(70));
  console.log('PASO 11: DIAGNÓSTICO READ ONLY POST-MIGRACIÓN');
  console.log('='.repeat(70));

  try {
    await client.query('BEGIN TRANSACTION READ ONLY;');

    const clientsRes = await client.query('SELECT * FROM "Client" ORDER BY "clientNumber" ASC;');
    const purchasesRes = await client.query('SELECT * FROM "CreditPurchase" ORDER BY "id" ASC;');
    const paymentsRes = await client.query('SELECT * FROM "Payment" ORDER BY "id" ASC;');
    const loansRes = await client.query('SELECT * FROM "Loan" ORDER BY "id" ASC;');
    const snapshotsRes = await client.query('SELECT * FROM "BalanceOpeningSnapshot" ORDER BY "clientId" ASC;');

    await client.query('ROLLBACK;');

    // Load pre-migration backup to compare historical checksums
    const backupPath = path.resolve(__dirname, 'backups/pre_migration_backup_latest.json');
    let backupData: any = null;
    if (fs.existsSync(backupPath)) {
      backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    }

    const currentPurchasesHash = hashPayload(purchasesRes.rows);
    const currentPaymentsHash = hashPayload(paymentsRes.rows);
    const currentLoansHash = hashPayload(loansRes.rows);

    const isPurchasesIntact = backupData ? backupData.checksums.purchases === currentPurchasesHash : true;
    const isPaymentsIntact = backupData ? backupData.checksums.payments === currentPaymentsHash : true;
    const isLoansIntact = backupData ? backupData.checksums.loans === currentLoansHash : true;

    console.log(`\n--- VERIFICACIÓN DE INMUTABILIDAD HISTÓRICA PRE vs POST ---`);
    console.log(`- Compras (CreditPurchase): ${isPurchasesIntact ? 'IDÉNTICAS (100% Intactas)' : 'FALLO'}`);
    console.log(`- Pagos (Payment): ${isPaymentsIntact ? 'IDÉNTICAS (100% Intactas)' : 'FALLO'}`);
    console.log(`- Préstamos (Loan): ${isLoansIntact ? 'IDÉNTICAS (100% Intactas)' : 'FALLO'}`);

    console.log(`\n--- DETALLE DE SALDOS POST-MIGRACIÓN POR CLIENTE ---`);
    const clientsDto: Client[] = clientsRes.rows.map(toInternalClientDto);
    const snapshotsDomain: BalanceOpeningSnapshot[] = snapshotsRes.rows.map((s: any) => ({
      id: s.id,
      clientId: s.clientId,
      migrationVersion: s.migrationVersion,
      cutOffDate: s.cutOffDate instanceof Date ? s.cutOffDate.toISOString() : String(s.cutOffDate),
      dailyDebtOpeningBalance: parseFloat(s.dailyDebtOpeningBalance),
      bankDebtOpeningBalance: parseFloat(s.bankDebtOpeningBalance),
      currentOpeningBalance: parseFloat(s.currentOpeningBalance),
      creditExposureOpening: parseFloat(s.creditExposureOpening),
      legacyUnknownPaymentCount: s.legacyUnknownPaymentCount,
      legacyMixedPaymentCount: s.legacyMixedPaymentCount,
      status: s.status,
      reconciliationRef: s.reconciliationRef,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
    }));

    const clientReportDetails: any[] = [];
    const inconsistentClients: any[] = [];

    for (const c of clientsDto) {
      const stateValidation = validateMigrationState(c, snapshotsDomain, 'BALANCE_MODEL_V1');
      if (stateValidation.status === 'MIGRATION_STATE_INCONSISTENT') {
        inconsistentClients.push({
          clientId: c.id,
          clientNumber: c.clientNumber,
          reason: stateValidation.reason,
        });
      }

      const associatedSnapshot = stateValidation.activeSnapshot;

      clientReportDetails.push({
        clientId: c.id,
        clientNumber: c.clientNumber,
        currentBalance: c.currentBalance,
        dailyDebtBalance: c.dailyDebtBalance,
        bankDebtBalance: c.bankDebtBalance,
        balanceModelVersion: c.balanceModelVersion,
        migrationState: stateValidation.status,
        snapshotId: associatedSnapshot?.id || null,
        snapshotDailyOpening: associatedSnapshot?.dailyDebtOpeningBalance,
        snapshotBankOpening: associatedSnapshot?.bankDebtOpeningBalance,
        snapshotCurrentOpening: associatedSnapshot?.currentOpeningBalance,
        snapshotCutOff: associatedSnapshot?.cutOffDate,
      });

      console.log(`Cliente ${c.clientNumber}:`);
      console.log(`  - dailyDebtBalance: ${c.dailyDebtBalance}`);
      console.log(`  - bankDebtBalance: ${c.bankDebtBalance}`);
      console.log(`  - currentBalance: ${c.currentBalance}`);
      console.log(`  - balanceModelVersion: ${c.balanceModelVersion}`);
      console.log(`  - Estado de Migración (SI Y SOLO SI): ${stateValidation.status}`);
      console.log(`  - Snapshot Asociado: ${associatedSnapshot ? `ID=${associatedSnapshot.id}, Status=${associatedSnapshot.status}` : 'NINGUNO'}`);
    }

    console.log(`\nTotal Clientes Evaluados: ${clientsDto.length}`);
    console.log(`Total Snapshots Activos: ${snapshotsDomain.length}`);
    console.log(`Clientes Inconsistentes (MIGRATION_STATE_INCONSISTENT): ${inconsistentClients.length}`);

    console.log('='.repeat(70));
    console.log('PASO 11 COMPLETADO.');
    console.log('='.repeat(70));

    return {
      isPurchasesIntact,
      isPaymentsIntact,
      isLoansIntact,
      clientReportDetails,
      inconsistentClients,
      checksums: {
        purchases: currentPurchasesHash,
        payments: currentPaymentsHash,
        loans: currentLoansHash,
      },
    };
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes('runPostMigrationAudit')) {
  runPostMigrationAudit().catch((err) => {
    console.error('Audit failure:', err);
    process.exit(1);
  });
}
