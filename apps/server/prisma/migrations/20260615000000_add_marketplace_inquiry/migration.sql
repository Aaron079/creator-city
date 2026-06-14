-- P1-4D: MarketplaceInquiry (contact intent, no payment)
CREATE TYPE "MarketplaceInquiryStatus" AS ENUM ('PENDING', 'RESPONDED', 'REJECTED', 'CLOSED');

CREATE TABLE "MarketplaceInquiry" (
    "id"          TEXT                       NOT NULL,
    "listingId"   TEXT                       NOT NULL,
    "assetId"     TEXT                       NOT NULL,
    "buyerId"     TEXT                       NOT NULL,
    "sellerId"    TEXT                       NOT NULL,
    "status"      "MarketplaceInquiryStatus" NOT NULL DEFAULT 'PENDING',
    "message"     TEXT,
    "sellerNote"  TEXT,
    "createdAt"   TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)               NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "closedAt"    TIMESTAMP(3),

    CONSTRAINT "MarketplaceInquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceInquiry_listingId_buyerId_key" ON "MarketplaceInquiry"("listingId", "buyerId");
CREATE INDEX "MarketplaceInquiry_listingId_idx"  ON "MarketplaceInquiry"("listingId");
CREATE INDEX "MarketplaceInquiry_assetId_idx"    ON "MarketplaceInquiry"("assetId");
CREATE INDEX "MarketplaceInquiry_buyerId_idx"    ON "MarketplaceInquiry"("buyerId");
CREATE INDEX "MarketplaceInquiry_sellerId_idx"   ON "MarketplaceInquiry"("sellerId");
CREATE INDEX "MarketplaceInquiry_status_idx"     ON "MarketplaceInquiry"("status");
CREATE INDEX "MarketplaceInquiry_createdAt_idx"  ON "MarketplaceInquiry"("createdAt");

ALTER TABLE "MarketplaceInquiry" ADD CONSTRAINT "MarketplaceInquiry_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "AssetListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketplaceInquiry" ADD CONSTRAINT "MarketplaceInquiry_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceInquiry" ADD CONSTRAINT "MarketplaceInquiry_buyerId_fkey"
    FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceInquiry" ADD CONSTRAINT "MarketplaceInquiry_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
