-- P1-4B: Membership Tables
-- Idempotent migration — safe to run even if tables already exist (instrumentation.ts handles production)

DO $$ BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'EXPIRED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MembershipOrderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "UserMembership" (
  "id"            TEXT                NOT NULL,
  "userId"        TEXT                NOT NULL,
  "status"        "MembershipStatus"  NOT NULL DEFAULT 'INACTIVE',
  "planCode"      TEXT                NOT NULL DEFAULT 'pro_monthly_cny100',
  "startsAt"      TIMESTAMP(3),
  "expiresAt"     TIMESTAMP(3),
  "sourceOrderId" TEXT,
  "adminNote"     TEXT,
  "createdAt"     TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)        NOT NULL,
  CONSTRAINT "UserMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MembershipOrder" (
  "id"           TEXT                     NOT NULL,
  "userId"       TEXT                     NOT NULL,
  "planCode"     TEXT                     NOT NULL DEFAULT 'pro_monthly_cny100',
  "amountCny"    INTEGER                  NOT NULL DEFAULT 10000,
  "periodMonths" INTEGER                  NOT NULL DEFAULT 1,
  "status"       "MembershipOrderStatus"  NOT NULL DEFAULT 'PENDING',
  "voucherNote"  TEXT,
  "adminUserId"  TEXT,
  "adminNote"    TEXT,
  "createdAt"    TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)             NOT NULL,
  CONSTRAINT "MembershipOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserMembership_userId_key"    ON "UserMembership"("userId");
CREATE INDEX IF NOT EXISTS "MembershipOrder_userId_idx"          ON "MembershipOrder"("userId");
CREATE INDEX IF NOT EXISTS "MembershipOrder_status_idx"          ON "MembershipOrder"("status");
CREATE INDEX IF NOT EXISTS "MembershipOrder_createdAt_idx"       ON "MembershipOrder"("createdAt");

DO $$ BEGIN
  ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MembershipOrder" ADD CONSTRAINT "MembershipOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
