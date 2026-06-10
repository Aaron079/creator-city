-- P0-4: AssetListing schema-lite
-- Add-only migration: new table + enum only.
-- No existing tables modified. No LicenseGrant, no MarketplaceOrder, no payment.

CREATE TYPE "AssetListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TABLE "AssetListing" (
  "id"                          TEXT                 NOT NULL,
  "assetId"                     TEXT                 NOT NULL,
  "sellerId"                    TEXT                 NOT NULL,
  "status"                      "AssetListingStatus" NOT NULL DEFAULT 'DRAFT',
  "licenseMode"                 TEXT                 NOT NULL,
  "priceCredits"                INTEGER,
  "title"                       TEXT,
  "description"                 TEXT,
  "commercialUse"               BOOLEAN              NOT NULL DEFAULT false,
  "derivativeAllowed"           BOOLEAN              NOT NULL DEFAULT false,
  "attributionRequired"         BOOLEAN              NOT NULL DEFAULT true,
  "sourceMarketplaceIntentJson" JSONB,
  "createdAt"                   TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3)         NOT NULL,
  "publishedAt"                 TIMESTAMP(3),

  CONSTRAINT "AssetListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssetListing_assetId_idx"     ON "AssetListing"("assetId");
CREATE INDEX "AssetListing_sellerId_idx"    ON "AssetListing"("sellerId");
CREATE INDEX "AssetListing_status_idx"      ON "AssetListing"("status");
CREATE INDEX "AssetListing_createdAt_idx"   ON "AssetListing"("createdAt");
CREATE INDEX "AssetListing_publishedAt_idx" ON "AssetListing"("publishedAt");

ALTER TABLE "AssetListing" ADD CONSTRAINT "AssetListing_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetListing" ADD CONSTRAINT "AssetListing_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
