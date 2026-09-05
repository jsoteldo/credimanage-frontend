-- Rollback script for Balance Model V1
DROP TABLE IF EXISTS "BalanceOpeningSnapshot" CASCADE;
ALTER TABLE "Client" DROP COLUMN IF EXISTS "dailyDebtBalance";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "bankDebtBalance";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "balanceModelVersion";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
    DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260905000000_balance_model_v1';
  END IF;
END $$;
