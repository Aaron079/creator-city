-- ============================================================
-- Creator City — Credits tables for Supabase SQL Editor
-- Safe to run on a production database that already has User/Session tables.
-- Uses IF NOT EXISTS / exception guards — fully idempotent.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- ── Step 1: Enums ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "CreditLedgerType" AS ENUM (
    'PURCHASE','BONUS','RESERVE','FREEZE','SETTLE',
    'RELEASE','UNFREEZE','REFUND','ADMIN_ADJUSTMENT','EXPIRE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CreditPackageStatus" AS ENUM ('ACTIVE','INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING','PAID','CANCELLED','FAILED','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GenerationJobBillingStatus" AS ENUM ('PENDING','FROZEN','SETTLED','REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Step 2: UserCreditWallet ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "UserCreditWallet" (
    "id"             TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"         TEXT        NOT NULL,
    "balance"        INTEGER     NOT NULL DEFAULT 0,
    "frozenBalance"  INTEGER     NOT NULL DEFAULT 0,
    "totalPurchased" INTEGER     NOT NULL DEFAULT 0,
    "totalConsumed"  INTEGER     NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCreditWallet_pkey" PRIMARY KEY ("id")
);

-- Add any missing columns (safe if they already exist)
ALTER TABLE "UserCreditWallet"
    ADD COLUMN IF NOT EXISTS "frozenBalance"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "totalPurchased" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "totalConsumed"  INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "UserCreditWallet_userId_key" ON "UserCreditWallet"("userId");
CREATE INDEX        IF NOT EXISTS "UserCreditWallet_userId_idx" ON "UserCreditWallet"("userId");

-- ── Step 3: CreditPackage ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CreditPackage" (
    "id"          TEXT                    NOT NULL DEFAULT gen_random_uuid()::text,
    "name"        TEXT                    NOT NULL,
    "credits"     INTEGER                 NOT NULL,
    "bonusCredits" INTEGER                NOT NULL DEFAULT 0,
    "priceUSD"    INTEGER                 NOT NULL,
    "priceCNY"    INTEGER                 NOT NULL DEFAULT 0,
    "prices"      JSONB                   NOT NULL DEFAULT '[]',
    "description" TEXT,
    "status"      "CreditPackageStatus"   NOT NULL DEFAULT 'ACTIVE',
    "isActive"    BOOLEAN                 NOT NULL DEFAULT true,
    "sortOrder"   INTEGER                 NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

-- ── Step 4: CreditLedger ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CreditLedger" (
    "id"              TEXT               NOT NULL DEFAULT gen_random_uuid()::text,
    "walletId"        TEXT               NOT NULL,
    "userId"          TEXT,
    "type"            "CreditLedgerType" NOT NULL,
    "delta"           INTEGER            NOT NULL,
    "frozen"          INTEGER            NOT NULL,
    "balance"         INTEGER            NOT NULL,
    "amountCredits"   INTEGER            NOT NULL DEFAULT 0,
    "refType"         TEXT,
    "refId"           TEXT,
    "paymentOrderId"  TEXT,
    "generationJobId" TEXT,
    "note"            TEXT,
    "description"     TEXT,
    "createdAt"       TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditLedger_walletId_fkey"
        FOREIGN KEY ("walletId") REFERENCES "UserCreditWallet"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreditLedger_walletId_idx"       ON "CreditLedger"("walletId");
CREATE INDEX IF NOT EXISTS "CreditLedger_userId_idx"         ON "CreditLedger"("userId");
CREATE INDEX IF NOT EXISTS "CreditLedger_type_idx"           ON "CreditLedger"("type");
CREATE INDEX IF NOT EXISTS "CreditLedger_refId_idx"          ON "CreditLedger"("refId");
CREATE INDEX IF NOT EXISTS "CreditLedger_paymentOrderId_idx" ON "CreditLedger"("paymentOrderId");
CREATE INDEX IF NOT EXISTS "CreditLedger_generationJobId_idx" ON "CreditLedger"("generationJobId");
CREATE INDEX IF NOT EXISTS "CreditLedger_createdAt_idx"      ON "CreditLedger"("createdAt");

-- ── Step 5: PaymentOrder ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PaymentOrder" (
    "id"                    TEXT                    NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"                TEXT                    NOT NULL,
    "walletId"              TEXT                    NOT NULL,
    "packageId"             TEXT,
    "stripeSessionId"       TEXT,
    "stripePaymentIntentId" TEXT,
    "region"                TEXT                    NOT NULL DEFAULT 'CN',
    "provider"              TEXT                    NOT NULL DEFAULT 'manual',
    "currency"              TEXT                    NOT NULL DEFAULT 'CNY',
    "amount"                INTEGER                 NOT NULL DEFAULT 0,
    "externalOrderId"       TEXT,
    "externalPaymentId"     TEXT,
    "externalCustomerId"    TEXT,
    "rawNotifyJson"         JSONB,
    "status"                "PaymentOrderStatus"    NOT NULL DEFAULT 'PENDING',
    "credits"               INTEGER                 NOT NULL,
    "priceUSD"              INTEGER                 NOT NULL DEFAULT 0,
    "issuedAt"              TIMESTAMP(3),
    "paidAt"                TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentOrder_walletId_fkey"
        FOREIGN KEY ("walletId") REFERENCES "UserCreditWallet"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentOrder_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentOrder_stripeSessionId_key"   ON "PaymentOrder"("stripeSessionId") WHERE "stripeSessionId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentOrder_externalOrderId_key"   ON "PaymentOrder"("externalOrderId") WHERE "externalOrderId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentOrder_externalPaymentId_key" ON "PaymentOrder"("externalPaymentId") WHERE "externalPaymentId" IS NOT NULL;
CREATE INDEX        IF NOT EXISTS "PaymentOrder_userId_idx"            ON "PaymentOrder"("userId");
CREATE INDEX        IF NOT EXISTS "PaymentOrder_status_idx"            ON "PaymentOrder"("status");
CREATE INDEX        IF NOT EXISTS "PaymentOrder_provider_idx"          ON "PaymentOrder"("provider");
CREATE INDEX        IF NOT EXISTS "PaymentOrder_createdAt_idx"         ON "PaymentOrder"("createdAt");

-- ── Step 6: GenerationJob ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GenerationJob" (
    "id"            TEXT                          NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"        TEXT                          NOT NULL,
    "walletId"      TEXT,
    "externalJobId" TEXT,
    "providerId"    TEXT                          NOT NULL,
    "nodeType"      TEXT                          NOT NULL,
    "prompt"        TEXT                          NOT NULL,
    "estimatedCost" INTEGER                       NOT NULL DEFAULT 0,
    "actualCost"    INTEGER,
    "billingStatus" "GenerationJobBillingStatus"  NOT NULL DEFAULT 'PENDING',
    "errorMessage"  TEXT,
    "frozenAt"      TIMESTAMP(3),
    "settledAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GenerationJob_walletId_fkey"
        FOREIGN KEY ("walletId") REFERENCES "UserCreditWallet"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GenerationJob_userId_idx"        ON "GenerationJob"("userId");
CREATE INDEX IF NOT EXISTS "GenerationJob_walletId_idx"      ON "GenerationJob"("walletId");
CREATE INDEX IF NOT EXISTS "GenerationJob_billingStatus_idx" ON "GenerationJob"("billingStatus");
CREATE INDEX IF NOT EXISTS "GenerationJob_providerId_idx"    ON "GenerationJob"("providerId");
CREATE INDEX IF NOT EXISTS "GenerationJob_createdAt_idx"     ON "GenerationJob"("createdAt");

-- ── Step 7: updatedAt trigger (so Prisma @updatedAt works) ─────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER "UserCreditWallet_updatedAt"
    BEFORE UPDATE ON "UserCreditWallet"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "CreditPackage_updatedAt"
    BEFORE UPDATE ON "CreditPackage"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "PaymentOrder_updatedAt"
    BEFORE UPDATE ON "PaymentOrder"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER "GenerationJob_updatedAt"
    BEFORE UPDATE ON "GenerationJob"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Step 8: Verify ─────────────────────────────────────────────

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'UserCreditWallet','CreditLedger',
    'CreditPackage','PaymentOrder','GenerationJob'
  )
ORDER BY table_name;
