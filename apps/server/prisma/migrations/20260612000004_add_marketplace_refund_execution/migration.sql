-- P1-2: Add marketplace refund execution schema
-- Enum values cannot be added inside a transaction block in PostgreSQL,
-- so each ADD VALUE is a separate statement.

-- MarketplaceOrderStatus: add REFUNDED
ALTER TYPE "MarketplaceOrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

-- CreditLedgerType: add MARKETPLACE_REFUND and MARKETPLACE_SELLER_REVERSAL
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_REFUND';
ALTER TYPE "CreditLedgerType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_SELLER_REVERSAL';

-- MarketplaceRefundRequestStatus: add EXECUTED and EXECUTION_FAILED
ALTER TYPE "MarketplaceRefundRequestStatus" ADD VALUE IF NOT EXISTS 'EXECUTED';
ALTER TYPE "MarketplaceRefundRequestStatus" ADD VALUE IF NOT EXISTS 'EXECUTION_FAILED';

-- MarketplaceOrder: add refundedAt
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- MarketplaceRefundRequest: add executedAt and executionNote
ALTER TABLE "MarketplaceRefundRequest" ADD COLUMN IF NOT EXISTS "executedAt"    TIMESTAMP(3);
ALTER TABLE "MarketplaceRefundRequest" ADD COLUMN IF NOT EXISTS "executionNote" TEXT;
