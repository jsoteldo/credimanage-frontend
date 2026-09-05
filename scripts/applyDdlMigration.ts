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

async function applyDdl() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log('='.repeat(70));
  console.log('PASO A: APLICANDO MIGRACIÓN DDL ADITIVA DE ESQUEMA (PRISMA / POSTGRESQL)');
  console.log('='.repeat(70));

  try {
    const migrationSqlPath = path.resolve(__dirname, 'migrations/sql/001_create_balance_model_v1.sql');
    const sqlContent = fs.readFileSync(migrationSqlPath, 'utf-8');
    const migrationChecksum = crypto.createHash('sha256').update(sqlContent).digest('hex');
    const migrationName = '20260905000000_balance_model_v1';

    await client.query('BEGIN;');

    // 1. Execute DDL
    console.log('Ejecutando DDL aditivo...');
    await client.query(sqlContent);

    // 2. Ensure _prisma_migrations table exists and register migration
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum"              VARCHAR(64) NOT NULL,
        "finished_at"           TIMESTAMPTZ,
        "migration_name"        VARCHAR(255) NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        TIMESTAMPTZ,
        "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
      );
    `);

    const existingMigration = await client.query(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1;`,
      [migrationName]
    );

    if (existingMigration.rows.length === 0) {
      console.log(`Registrando migración '${migrationName}' en _prisma_migrations...`);
      const migrationId = crypto.randomUUID();
      await client.query(
        `INSERT INTO "_prisma_migrations" (
          id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
        ) VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1);`,
        [migrationId, migrationChecksum, migrationName]
      );
    } else {
      console.log(`Migración '${migrationName}' ya estaba registrada en _prisma_migrations.`);
    }

    await client.query('COMMIT;');
    console.log('DDL aplicado y transacción commiteada exitosamente.');

    // 3. Validate Schema
    console.log('\n--- VALIDACIÓN DE ESQUEMA POST-DDL ---');
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Client' AND column_name IN ('dailyDebtBalance', 'bankDebtBalance', 'balanceModelVersion');
    `);

    console.log('Columnas agregadas a Client:');
    for (const col of colsRes.rows) {
      console.log(`- ${col.column_name}: ${col.data_type} (Nullable: ${col.is_nullable})`);
    }

    const snapshotTableRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'BalanceOpeningSnapshot'
      ORDER BY ordinal_position ASC;
    `);

    console.log(`\nTabla BalanceOpeningSnapshot creada con ${snapshotTableRes.rows.length} columnas:`);
    for (const col of snapshotTableRes.rows) {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    }

    // Verify initial values are NULL (semantic rule: NULL = todavía no materializado)
    const clientRows = await client.query(`SELECT id, "clientNumber", "dailyDebtBalance", "bankDebtBalance", "balanceModelVersion" FROM "Client";`);
    console.log('\nVerificación semántica inicial de clientes (deben ser NULL antes del backfill):');
    for (const c of clientRows.rows) {
      console.log(`- ${c.clientNumber}: dailyDebtBalance=${c.dailyDebtBalance}, bankDebtBalance=${c.bankDebtBalance}, balanceModelVersion=${c.balanceModelVersion}`);
      if (c.dailyDebtBalance !== null || c.bankDebtBalance !== null || c.balanceModelVersion !== null) {
        throw new Error(`VIOLACIÓN SEMÁNTICA POST-DDL: Las nuevas columnas para ${c.clientNumber} deben ser estrictamente NULL antes del backfill.`);
      }
    }

    // Verify BalanceOpeningSnapshot is empty
    const snapshotCountRes = await client.query(`SELECT count(*)::int as cnt FROM "BalanceOpeningSnapshot";`);
    const snapshotCount = snapshotCountRes.rows[0].cnt;
    console.log(`\nVerificación BalanceOpeningSnapshot vacía: ${snapshotCount} registros (Esperado: 0)`);
    if (snapshotCount !== 0) {
      throw new Error(`VIOLACIÓN POST-DDL: BalanceOpeningSnapshot debe estar completamente vacía antes del backfill. Encontrados: ${snapshotCount}`);
    }

    // Verify Prisma migration record
    const migrationAudit = await client.query(`SELECT * FROM "_prisma_migrations" WHERE migration_name = $1;`, [migrationName]);
    console.log(`\nVerificación _prisma_migrations: Registrada con checksum ${migrationAudit.rows[0]?.checksum}, finished_at: ${migrationAudit.rows[0]?.finished_at}`);

    console.log('='.repeat(70));
    console.log('PASO A COMPLETADO CON ÉXITO: ESQUEMA 100% LISTO PARA BACKFILL');
    console.log('='.repeat(70));

    return {
      columnsAdded: colsRes.rows,
      snapshotColumns: snapshotTableRes.rows,
      clientRows: clientRows.rows,
    };
  } catch (err: any) {
    await client.query('ROLLBACK;');
    console.error('Error durante la migración DDL:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

applyDdl().catch((err) => {
  console.error('Fatal DDL error:', err);
  process.exit(1);
});
