-- P1-1: Marketplace Refund Request
-- Records buyer's intent to request a refund. Does NOT execute any accounting.
-- Admin reviews and marks APPROVED/REJECTED. Actual refund execution is P1-2.

CREATE TYPE "MarketplaceRefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "MarketplaceRefundRequest" (
  "id"         TEXT                             NOT NULL,
  "orderId"    TEXT                             NOT NULL,
  "buyerId"    TEXT                             NOT NULL,
  "sellerId"   TEXT                             NOT NULL,
  "assetId"    TEXT                             NOT NULL,
  "status"     "MarketplaceRefundRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason"     TEXT                             NOT NULL,
  "adminNote"  TEXT,
  "createdAt"  TIMESTAMP(3)                     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "MarketplaceRefundRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceRefundRequest_orderId_key" ON "MarketplaceRefundRequest"("orderId");
CREATE INDEX IF NOT EXISTS "MarketplaceRefundRequest_buyerId_idx"   ON "MarketplaceRefundRequest"("buyerId");
CREATE INDEX IF NOT EXISTS "MarketplaceRefundRequest_sellerId_idx"  ON "MarketplaceRefundRequest"("sellerId");
CREATE INDEX IF NOT EXISTS "MarketplaceRefundRequest_status_idx"    ON "MarketplaceRefundRequest"("status");
CREATE INDEX IF NOT EXISTS "MarketplaceRefundRequest_createdAt_idx" ON "MarketplaceRefundRequest"("createdAt");

DO $$ BEGIN
  ALTER TABLE "MarketplaceRefundRequest" ADD CONSTRAINT "MarketplaceRefundRequest_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MarketplaceRefundRequest" ADD CONSTRAINT "MarketplaceRefundRequest_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MarketplaceRefundRequest" ADD CONSTRAINT "MarketplaceRefundRequest_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MarketplaceRefundRequest" ADD CONSTRAINT "MarketplaceRefundRequest_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
