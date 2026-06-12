-- P0-9: Add QUOTED state to MarketplaceOrder
-- AlterEnum: cannot run inside a transaction in PostgreSQL
ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'QUOTED';

-- AlterTable
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "quotedAt" TIMESTAMP(3);
