-- P1-0: Marketplace Settlement v1
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block in PostgreSQL.

-- Add COMPLETED to MarketplaceOrderStatus
ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- Add completedAt column to MarketplaceOrder
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Add marketplace CreditLedgerType values
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_PURCHASE';
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_SELLER_CREDIT';
