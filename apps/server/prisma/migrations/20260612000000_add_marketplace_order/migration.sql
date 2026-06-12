-- P0-6: MarketplaceOrder PENDING-only
-- Add-only migration. No wallet, no billing, no LicenseGrant changes.

CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('PENDING', 'CANCELLED', 'REJECTED');

CREATE TABLE "MarketplaceOrder" (
  "id"                  TEXT                     NOT NULL,
  "listingId"           TEXT                     NOT NULL,
  "assetId"             TEXT                     NOT NULL,
  "buyerId"             TEXT                     NOT NULL,
  "sellerId"            TEXT                     NOT NULL,
  "priceCredits"        INTEGER                  NOT NULL,
  "platformFeeCredits"  INTEGER,
  "sellerAmountCredits" INTEGER,
  "status"              "MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING',
  "message"             TEXT,
  "failureReason"       TEXT,
  "metadataJson"        JSONB,
  "createdAt"           TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)             NOT NULL,
  "cancelledAt"         TIMESTAMP(3),
  "rejectedAt"          TIMESTAMP(3),
  CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplaceOrder_listingId_idx" ON "MarketplaceOrder"("listingId");
CREATE INDEX "MarketplaceOrder_assetId_idx"   ON "MarketplaceOrder"("assetId");
CREATE INDEX "MarketplaceOrder_buyerId_idx"   ON "MarketplaceOrder"("buyerId");
CREATE INDEX "MarketplaceOrder_sellerId_idx"  ON "MarketplaceOrder"("sellerId");
CREATE INDEX "MarketplaceOrder_status_idx"    ON "MarketplaceOrder"("status");
CREATE INDEX "MarketplaceOrder_createdAt_idx" ON "MarketplaceOrder"("createdAt");

ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "AssetListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
