-- CreateEnum
CREATE TYPE "LicenseGrantStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable: add LicenseGrant relation to AssetListing (no column changes, handled by FK below)

-- CreateTable
CREATE TABLE "LicenseGrant" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "licenseMode" TEXT NOT NULL,
    "paidCredits" INTEGER NOT NULL DEFAULT 0,
    "status" "LicenseGrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "termsJson" JSONB,

    CONSTRAINT "LicenseGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseGrant_listingId_buyerId_key" ON "LicenseGrant"("listingId", "buyerId");

-- CreateIndex
CREATE INDEX "LicenseGrant_buyerId_idx" ON "LicenseGrant"("buyerId");

-- CreateIndex
CREATE INDEX "LicenseGrant_sellerId_idx" ON "LicenseGrant"("sellerId");

-- CreateIndex
CREATE INDEX "LicenseGrant_assetId_idx" ON "LicenseGrant"("assetId");

-- CreateIndex
CREATE INDEX "LicenseGrant_listingId_idx" ON "LicenseGrant"("listingId");

-- CreateIndex
CREATE INDEX "LicenseGrant_status_idx" ON "LicenseGrant"("status");

-- CreateIndex
CREATE INDEX "LicenseGrant_grantedAt_idx" ON "LicenseGrant"("grantedAt");

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "AssetListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseGrant" ADD CONSTRAINT "LicenseGrant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
