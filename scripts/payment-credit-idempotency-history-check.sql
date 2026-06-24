-- P0-PAYMENT-CREDIT-INTEGRITY-HARDENING-B2
-- Read-only duplicate-data checks before enforcing payment/credit idempotency anchors.
-- This script must not mutate data.

SELECT
  'duplicate_credit_ledger_idempotency_key' AS check_name,
  "idempotencyKey",
  COUNT(*) AS duplicate_count
FROM "CreditLedger"
WHERE "idempotencyKey" IS NOT NULL
GROUP BY "idempotencyKey"
HAVING COUNT(*) > 1;

SELECT
  'duplicate_payment_order_idempotency_key' AS check_name,
  "idempotencyKey",
  COUNT(*) AS duplicate_count
FROM "PaymentOrder"
WHERE "idempotencyKey" IS NOT NULL
GROUP BY "idempotencyKey"
HAVING COUNT(*) > 1;

SELECT
  'duplicate_generation_billing_request' AS check_name,
  "userId",
  "billingRequestId",
  COUNT(*) AS duplicate_count
FROM "GenerationJob"
WHERE "billingRequestId" IS NOT NULL
GROUP BY "userId", "billingRequestId"
HAVING COUNT(*) > 1;

SELECT
  'duplicate_purchase_ledger' AS check_name,
  "paymentOrderId",
  COUNT(*) AS duplicate_count,
  SUM("amountCredits") AS duplicated_credits
FROM "CreditLedger"
WHERE "type" = 'PURCHASE'
  AND "paymentOrderId" IS NOT NULL
GROUP BY "paymentOrderId"
HAVING COUNT(*) > 1;

SELECT
  'duplicate_generation_reserve_ledger' AS check_name,
  "generationJobId",
  COUNT(*) AS duplicate_count,
  SUM("amountCredits") AS duplicated_credits
FROM "CreditLedger"
WHERE "type" IN ('RESERVE', 'FREEZE')
  AND "generationJobId" IS NOT NULL
GROUP BY "generationJobId"
HAVING COUNT(*) > 1;

SELECT
  'duplicate_generation_settle_ledger' AS check_name,
  "generationJobId",
  COUNT(*) AS duplicate_count,
  SUM("amountCredits") AS duplicated_credits
FROM "CreditLedger"
WHERE "type" = 'SETTLE'
  AND "generationJobId" IS NOT NULL
GROUP BY "generationJobId"
HAVING COUNT(*) > 1;

SELECT
  'duplicate_generation_refund_ledger' AS check_name,
  "generationJobId",
  COUNT(*) AS duplicate_count,
  SUM("amountCredits") AS duplicated_credits
FROM "CreditLedger"
WHERE "type" IN ('RELEASE', 'UNFREEZE', 'REFUND')
  AND "generationJobId" IS NOT NULL
GROUP BY "generationJobId"
HAVING COUNT(*) > 1;

SELECT
  'paid_order_missing_purchase_ledger' AS check_name,
  p."id" AS payment_order_id,
  p."userId",
  p."walletId",
  p."provider",
  p."credits",
  p."paidAt",
  p."fulfilledAt"
FROM "PaymentOrder" p
LEFT JOIN "CreditLedger" l
  ON l."paymentOrderId" = p."id"
  AND l."type" = 'PURCHASE'
WHERE p."status" = 'PAID'
  AND l."id" IS NULL;

SELECT
  'pending_order_with_purchase_ledger' AS check_name,
  p."id" AS payment_order_id,
  p."userId",
  p."walletId",
  p."provider",
  p."credits",
  COUNT(l."id") AS purchase_ledger_count,
  SUM(l."amountCredits") AS credited_amount
FROM "PaymentOrder" p
JOIN "CreditLedger" l
  ON l."paymentOrderId" = p."id"
  AND l."type" = 'PURCHASE'
WHERE p."status" = 'PENDING'
GROUP BY p."id", p."userId", p."walletId", p."provider", p."credits";

WITH ledger_totals AS (
  SELECT
    "walletId",
    COALESCE(SUM("delta"), 0) AS ledger_balance,
    COALESCE(SUM("frozen"), 0) AS ledger_frozen,
    COALESCE(SUM(CASE WHEN "type" = 'PURCHASE' THEN "amountCredits" ELSE 0 END), 0) AS ledger_purchased,
    COALESCE(SUM(CASE WHEN "type" = 'SETTLE' THEN "amountCredits" ELSE 0 END), 0) AS ledger_consumed
  FROM "CreditLedger"
  GROUP BY "walletId"
)
SELECT
  'wallet_ledger_drift_candidate' AS check_name,
  w."id" AS wallet_id,
  w."userId",
  w."balance" AS wallet_balance,
  COALESCE(l."ledger_balance", 0) AS ledger_balance,
  w."frozenBalance" AS wallet_frozen,
  COALESCE(l."ledger_frozen", 0) AS ledger_frozen,
  w."totalPurchased" AS wallet_total_purchased,
  COALESCE(l."ledger_purchased", 0) AS ledger_purchased,
  w."totalConsumed" AS wallet_total_consumed,
  COALESCE(l."ledger_consumed", 0) AS ledger_consumed
FROM "UserCreditWallet" w
LEFT JOIN ledger_totals l
  ON l."walletId" = w."id"
WHERE w."balance" <> COALESCE(l."ledger_balance", 0)
   OR w."frozenBalance" <> COALESCE(l."ledger_frozen", 0)
   OR w."totalPurchased" <> COALESCE(l."ledger_purchased", 0)
   OR w."totalConsumed" <> COALESCE(l."ledger_consumed", 0);
