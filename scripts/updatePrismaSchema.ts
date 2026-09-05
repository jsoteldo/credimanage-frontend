import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.resolve(__dirname, '../../backend/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

if (!schema.includes('dailyDebtBalance')) {
  // Add to Client
  const clientTarget = '  currentBalance Float           @default(0)';
  const clientReplacement = `  currentBalance Float           @default(0)
  dailyDebtBalance    Decimal?                 @db.Decimal(12, 2)
  bankDebtBalance     Decimal?                 @db.Decimal(12, 2)
  balanceModelVersion String?
  openingSnapshots    BalanceOpeningSnapshot[]`;

  schema = schema.replace(clientTarget, clientReplacement);

  // Add BalanceOpeningSnapshot model at end
  const modelSnapshot = `
model BalanceOpeningSnapshot {
  id                         String   @id @default(uuid())
  clientId                   String
  client                     Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  migrationVersion           String
  cutOffDate                 DateTime
  dailyDebtOpeningBalance    Decimal  @db.Decimal(12, 2)
  bankDebtOpeningBalance     Decimal  @db.Decimal(12, 2)
  currentOpeningBalance      Decimal  @db.Decimal(12, 2)
  creditExposureOpening      Decimal  @db.Decimal(12, 2)
  legacyUnknownPaymentCount  Int      @default(0)
  legacyMixedPaymentCount    Int      @default(0)
  status                     String   @default("ACTIVO")
  reconciliationRef          String?
  createdAt                  DateTime @default(now())

  @@unique([clientId, migrationVersion])
}
`;

  schema += modelSnapshot;
  fs.writeFileSync(schemaPath, schema, 'utf-8');
  console.log('schema.prisma actualizado exitosamente.');
} else {
  console.log('schema.prisma ya contiene los campos requeridos.');
}
