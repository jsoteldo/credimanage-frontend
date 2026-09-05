import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('../../backend/node_modules/pg');
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_VJeh3iMDLG6O@ep-purple-mouse-aceufutz.sa-east-1.aws.neon.tech/credimanage?sslmode=require';

function hashPayload(payload: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function executeLogicalBackup() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log('='.repeat(70));
  console.log('INICIANDO BACKUP LÓGICO PRE-MIGRACIÓN (EXPORT DE SEGURIDAD)');
  console.log('='.repeat(70));

  try {
    await client.query('BEGIN TRANSACTION READ ONLY;');

    const clients = (await client.query('SELECT * FROM "Client" ORDER BY "id" ASC;')).rows;
    const purchases = (await client.query('SELECT * FROM "CreditPurchase" ORDER BY "id" ASC;')).rows;
    const payments = (await client.query('SELECT * FROM "Payment" ORDER BY "id" ASC;')).rows;
    const loans = (await client.query('SELECT * FROM "Loan" ORDER BY "id" ASC;')).rows;
    const installments = (await client.query('SELECT * FROM "Installment" ORDER BY "loanId", "installmentNumber" ASC;')).rows;
    const users = (await client.query('SELECT * FROM "User" ORDER BY "id" ASC;')).rows;
    const auditLogs = (await client.query('SELECT * FROM "AuditLog" ORDER BY "id" ASC;')).rows;

    await client.query('ROLLBACK;');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        environment: 'Neon PostgreSQL Production',
        migrationTarget: 'BALANCE_MODEL_V1',
      },
      counts: {
        clients: clients.length,
        purchases: purchases.length,
        payments: payments.length,
        loans: loans.length,
        installments: installments.length,
        users: users.length,
        auditLogs: auditLogs.length,
      },
      checksums: {
        clients: hashPayload(clients),
        purchases: hashPayload(purchases),
        payments: hashPayload(payments),
        loans: hashPayload(loans),
        installments: hashPayload(installments),
        users: hashPayload(users),
        auditLogs: hashPayload(auditLogs),
      },
      tables: {
        clients,
        purchases,
        payments,
        loans,
        installments,
        users,
        auditLogs,
      },
    };

    const overallHash = hashPayload(backupData);
    (backupData.metadata as any).overallChecksumSha256 = overallHash;

    const backupFilePath = path.join(backupDir, `pre_migration_backup_${timestamp}.json`);
    const latestFilePath = path.join(backupDir, 'pre_migration_backup_latest.json');

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
    fs.writeFileSync(latestFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log(`Backup guardado exitosamente en:`);
    console.log(`- ${backupFilePath}`);
    console.log(`- ${latestFilePath}`);
    console.log(`Resumen de registros respaldados:`);
    console.log(`- Clientes: ${backupData.counts.clients}`);
    console.log(`- Compras: ${backupData.counts.purchases}`);
    console.log(`- Pagos: ${backupData.counts.payments}`);
    console.log(`- Préstamos: ${backupData.counts.loans}`);
    console.log(`- Cuotas: ${backupData.counts.installments}`);
    console.log(`Checksum SHA-256 Global: ${overallHash}`);
    console.log('='.repeat(70));

    return backupData;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes('createLogicalBackup')) {
  executeLogicalBackup().catch((err) => {
    console.error('Error generando backup lógico:', err);
    process.exit(1);
  });
}
