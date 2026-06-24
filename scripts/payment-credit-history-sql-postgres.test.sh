#!/usr/bin/env bash
set -euo pipefail

sql_file="scripts/payment-credit-idempotency-history-check.sql"
container="cc_payment_history_sql_pg_$$"
db="cc_payment_history_sql"

cleanup() {
  docker rm -fv "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if grep -Eiq '\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|MERGE|CALL)\b' "$sql_file"; then
  echo "Historical review SQL contains a mutating keyword" >&2
  exit 1
fi

docker run \
  --name "$container" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB="$db" \
  -d postgres:16-alpine >/dev/null

until docker exec "$container" pg_isready -U postgres -d "$db" >/dev/null 2>&1; do
  sleep 1
done

psql_exec() {
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" "$@"
}

psql_exec <<'SQL'
CREATE TABLE "UserCreditWallet" (
  "id"             TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL,
  "balance"        INTEGER NOT NULL DEFAULT 0,
  "frozenBalance"  INTEGER NOT NULL DEFAULT 0,
  "totalPurchased" INTEGER NOT NULL DEFAULT 0,
  "totalConsumed"  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "PaymentOrder" (
  "id"              TEXT PRIMARY KEY,
  "userId"          TEXT NOT NULL,
  "walletId"        TEXT NOT NULL,
  "provider"        TEXT NOT NULL DEFAULT 'manual',
  "credits"         INTEGER NOT NULL,
  "status"          TEXT NOT NULL,
  "idempotencyKey"  TEXT,
  "paidAt"          TIMESTAMP,
  "fulfilledAt"     TIMESTAMP
);

CREATE TABLE "GenerationJob" (
  "id"               TEXT PRIMARY KEY,
  "userId"           TEXT NOT NULL,
  "walletId"         TEXT,
  "billingRequestId" TEXT,
  "billingStatus"    TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE "CreditLedger" (
  "id"              TEXT PRIMARY KEY,
  "walletId"        TEXT NOT NULL,
  "userId"          TEXT,
  "type"            TEXT NOT NULL,
  "delta"           INTEGER NOT NULL,
  "frozen"          INTEGER NOT NULL,
  "balance"         INTEGER NOT NULL,
  "amountCredits"   INTEGER NOT NULL DEFAULT 0,
  "paymentOrderId"  TEXT,
  "generationJobId" TEXT,
  "idempotencyKey"  TEXT
);

INSERT INTO "UserCreditWallet" ("id", "userId", "balance", "frozenBalance", "totalPurchased", "totalConsumed")
VALUES ('wallet_1', 'user_1', 999, 999, 999, 999);

INSERT INTO "PaymentOrder" ("id", "userId", "walletId", "provider", "credits", "status", "idempotencyKey", "paidAt", "fulfilledAt")
VALUES
  ('order_idem_a', 'user_1', 'wallet_1', 'alipay', 10, 'PENDING', 'same-payment-key', NULL, NULL),
  ('order_idem_b', 'user_1', 'wallet_1', 'alipay', 10, 'PENDING', 'same-payment-key', NULL, NULL),
  ('order_dup_purchase', 'user_1', 'wallet_1', 'alipay', 20, 'PAID', 'purchase-dup-key', now(), now()),
  ('order_paid_missing', 'user_1', 'wallet_1', 'alipay', 30, 'PAID', 'paid-missing-key', now(), now()),
  ('order_pending_credited', 'user_1', 'wallet_1', 'alipay', 40, 'PENDING', 'pending-credited-key', NULL, NULL);

INSERT INTO "GenerationJob" ("id", "userId", "walletId", "billingRequestId", "billingStatus")
VALUES
  ('job_req_a', 'user_1', 'wallet_1', 'same-generation-key', 'FROZEN'),
  ('job_req_b', 'user_1', 'wallet_1', 'same-generation-key', 'FROZEN'),
  ('job_ledger_dup', 'user_1', 'wallet_1', 'ledger-generation-key', 'FROZEN');

INSERT INTO "CreditLedger" (
  "id", "walletId", "userId", "type", "delta", "frozen", "balance", "amountCredits",
  "paymentOrderId", "generationJobId", "idempotencyKey"
)
VALUES
  ('ledger_idem_a', 'wallet_1', 'user_1', 'BONUS', 1, 0, 1, 1, NULL, NULL, 'same-ledger-key'),
  ('ledger_idem_b', 'wallet_1', 'user_1', 'BONUS', 1, 0, 2, 1, NULL, NULL, 'same-ledger-key'),
  ('ledger_purchase_a', 'wallet_1', 'user_1', 'PURCHASE', 20, 0, 22, 20, 'order_dup_purchase', NULL, 'purchase-a'),
  ('ledger_purchase_b', 'wallet_1', 'user_1', 'PURCHASE', 20, 0, 42, 20, 'order_dup_purchase', NULL, 'purchase-b'),
  ('ledger_pending_purchase', 'wallet_1', 'user_1', 'PURCHASE', 40, 0, 82, 40, 'order_pending_credited', NULL, 'pending-purchase'),
  ('ledger_reserve_a', 'wallet_1', 'user_1', 'RESERVE', -10, 10, 72, 10, NULL, 'job_ledger_dup', 'reserve-a'),
  ('ledger_reserve_b', 'wallet_1', 'user_1', 'FREEZE', -10, 10, 62, 10, NULL, 'job_ledger_dup', 'reserve-b'),
  ('ledger_settle_a', 'wallet_1', 'user_1', 'SETTLE', 0, -10, 62, 10, NULL, 'job_ledger_dup', 'settle-a'),
  ('ledger_settle_b', 'wallet_1', 'user_1', 'SETTLE', 0, -10, 62, 10, NULL, 'job_ledger_dup', 'settle-b'),
  ('ledger_refund_a', 'wallet_1', 'user_1', 'RELEASE', 10, -10, 72, 10, NULL, 'job_ledger_dup', 'refund-a'),
  ('ledger_refund_b', 'wallet_1', 'user_1', 'REFUND', 10, -10, 82, 10, NULL, 'job_ledger_dup', 'refund-b');
SQL

history_output="$(psql_exec -qAt < "$sql_file")"

for label in \
  duplicate_credit_ledger_idempotency_key \
  duplicate_payment_order_idempotency_key \
  duplicate_generation_billing_request \
  duplicate_purchase_ledger \
  duplicate_generation_reserve_ledger \
  duplicate_generation_settle_ledger \
  duplicate_generation_refund_ledger \
  paid_order_missing_purchase_ledger \
  pending_order_with_purchase_ledger \
  wallet_ledger_drift_candidate
do
  if ! grep -q "$label" <<<"$history_output"; then
    echo "Missing historical review label: $label" >&2
    exit 1
  fi
done

echo "Historical duplicate review SQL parsed and returned expected read-only findings"
