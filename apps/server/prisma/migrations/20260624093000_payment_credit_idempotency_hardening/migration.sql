-- P0-PAYMENT-CREDIT-INTEGRITY-HARDENING-B1
-- Add nullable idempotency anchors for payment fulfillment and generation billing.
--
-- Read-only historical duplicate checks to run before enforcing uniqueness:
--
-- SELECT "idempotencyKey", COUNT(*)
-- FROM "CreditLedger"
-- WHERE "idempotencyKey" IS NOT NULL
-- GROUP BY "idempotencyKey"
-- HAVING COUNT(*) > 1;
--
-- SELECT "idempotencyKey", COUNT(*)
-- FROM "PaymentOrder"
-- WHERE "idempotencyKey" IS NOT NULL
-- GROUP BY "idempotencyKey"
-- HAVING COUNT(*) > 1;
--
-- SELECT "userId", "billingRequestId", COUNT(*)
-- FROM "GenerationJob"
-- WHERE "billingRequestId" IS NOT NULL
-- GROUP BY "userId", "billingRequestId"
-- HAVING COUNT(*) > 1;

ALTER TABLE "CreditLedger"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

ALTER TABLE "PaymentOrder"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "fulfilledAt" TIMESTAMP(3);

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "billingRequestId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CreditLedger_idempotencyKey_key"
  ON "CreditLedger"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentOrder_idempotencyKey_key"
  ON "PaymentOrder"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "GenerationJob_billingRequestId_idx"
  ON "GenerationJob"("billingRequestId");

CREATE UNIQUE INDEX IF NOT EXISTS "GenerationJob_userId_billingRequestId_key"
  ON "GenerationJob"("userId", "billingRequestId");
