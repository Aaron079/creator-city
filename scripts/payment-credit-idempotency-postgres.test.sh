#!/usr/bin/env bash
set -euo pipefail

container="cc_payment_idempotency_pg_$$"
db="cc_payment_idempotency"

cleanup() {
  docker rm -fv "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

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
  "userId"         TEXT NOT NULL UNIQUE,
  "balance"        INTEGER NOT NULL DEFAULT 0,
  "frozenBalance"  INTEGER NOT NULL DEFAULT 0,
  "totalConsumed"  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "GenerationJob" (
  "id"               TEXT PRIMARY KEY,
  "userId"           TEXT NOT NULL,
  "walletId"         TEXT NOT NULL,
  "billingRequestId" TEXT,
  "providerId"       TEXT NOT NULL,
  "nodeType"         TEXT NOT NULL,
  "estimatedCost"    INTEGER NOT NULL,
  "billingStatus"    TEXT NOT NULL
);

CREATE TABLE "CreditLedger" (
  "id"               TEXT PRIMARY KEY,
  "walletId"         TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "type"             TEXT NOT NULL,
  "delta"            INTEGER NOT NULL,
  "frozen"           INTEGER NOT NULL,
  "balance"          INTEGER NOT NULL,
  "amountCredits"    INTEGER NOT NULL,
  "generationJobId"  TEXT,
  "idempotencyKey"   TEXT UNIQUE
);

CREATE UNIQUE INDEX "GenerationJob_userId_billingRequestId_key"
  ON "GenerationJob"("userId", "billingRequestId");

INSERT INTO "UserCreditWallet" ("id", "userId", "balance", "frozenBalance", "totalConsumed")
VALUES ('wallet_1', 'user_1', 100, 0, 0);

CREATE OR REPLACE FUNCTION reserve_app_order(request_id TEXT, job_id TEXT)
RETURNS TEXT AS $$
DECLARE
  updated_balance INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "GenerationJob"
    WHERE "userId" = 'user_1' AND "billingRequestId" = request_id
  ) THEN
    RETURN 'duplicate';
  END IF;

  UPDATE "UserCreditWallet"
  SET "balance" = "balance" - 20,
      "frozenBalance" = "frozenBalance" + 20
  WHERE "id" = 'wallet_1' AND "balance" >= 20
  RETURNING "balance" INTO updated_balance;

  IF updated_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient credits';
  END IF;

  INSERT INTO "GenerationJob" (
    "id", "userId", "walletId", "billingRequestId", "providerId", "nodeType", "estimatedCost", "billingStatus"
  ) VALUES (
    job_id, 'user_1', 'wallet_1', request_id, 'openai-images', 'image', 20, 'FROZEN'
  );

  INSERT INTO "CreditLedger" (
    "id", "walletId", "userId", "type", "delta", "frozen", "balance", "amountCredits", "generationJobId", "idempotencyKey"
  ) VALUES (
    'ledger_reserve_' || job_id, 'wallet_1', 'user_1', 'RESERVE', -20, 20, updated_balance, 20, job_id,
    'generation:user_1:' || request_id || ':reserve'
  );

  RETURN job_id;
EXCEPTION WHEN unique_violation THEN
  RETURN 'duplicate';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION settle_app_order(job_id TEXT)
RETURNS TEXT AS $$
DECLARE
  job_cost INTEGER;
  updated_balance INTEGER;
BEGIN
  SELECT "estimatedCost" INTO job_cost
  FROM "GenerationJob"
  WHERE "id" = job_id AND "billingStatus" = 'FROZEN';

  IF job_cost IS NULL THEN
    RETURN 'duplicate';
  END IF;

  UPDATE "GenerationJob"
  SET "billingStatus" = 'SETTLED'
  WHERE "id" = job_id AND "billingStatus" = 'FROZEN';

  IF NOT FOUND THEN
    RETURN 'duplicate';
  END IF;

  UPDATE "UserCreditWallet"
  SET "frozenBalance" = "frozenBalance" - job_cost,
      "totalConsumed" = "totalConsumed" + job_cost
  WHERE "id" = 'wallet_1'
  RETURNING "balance" INTO updated_balance;

  INSERT INTO "CreditLedger" (
    "id", "walletId", "userId", "type", "delta", "frozen", "balance", "amountCredits", "generationJobId", "idempotencyKey"
  ) VALUES (
    'ledger_settle_' || job_id, 'wallet_1', 'user_1', 'SETTLE', 0, -job_cost, updated_balance, job_cost, job_id,
    'generation:' || job_id || ':settle'
  );

  RETURN 'settled';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_app_order(job_id TEXT)
RETURNS TEXT AS $$
DECLARE
  job_cost INTEGER;
  updated_balance INTEGER;
BEGIN
  SELECT "estimatedCost" INTO job_cost
  FROM "GenerationJob"
  WHERE "id" = job_id AND "billingStatus" = 'FROZEN';

  IF job_cost IS NULL THEN
    RETURN 'duplicate';
  END IF;

  UPDATE "GenerationJob"
  SET "billingStatus" = 'REFUNDED'
  WHERE "id" = job_id AND "billingStatus" = 'FROZEN';

  IF NOT FOUND THEN
    RETURN 'duplicate';
  END IF;

  UPDATE "UserCreditWallet"
  SET "balance" = "balance" + job_cost,
      "frozenBalance" = "frozenBalance" - job_cost
  WHERE "id" = 'wallet_1'
  RETURNING "balance" INTO updated_balance;

  INSERT INTO "CreditLedger" (
    "id", "walletId", "userId", "type", "delta", "frozen", "balance", "amountCredits", "generationJobId", "idempotencyKey"
  ) VALUES (
    'ledger_release_' || job_id, 'wallet_1', 'user_1', 'RELEASE', job_cost, -job_cost, updated_balance, job_cost, job_id,
    'generation:' || job_id || ':release'
  );

  RETURN 'released';
END;
$$ LANGUAGE plpgsql;
SQL

for n in 1 2 3 4 5; do
  docker exec "$container" psql -qAt -v ON_ERROR_STOP=1 -U postgres -d "$db" \
    -c "SELECT reserve_app_order('same_request', 'job_same_$n')" >/dev/null &
done
wait

same_summary="$(psql_exec -qAt -c "SELECT \"balance\", \"frozenBalance\", (SELECT COUNT(*) FROM \"GenerationJob\" WHERE \"billingRequestId\" = 'same_request'), (SELECT COUNT(*) FROM \"CreditLedger\" WHERE \"idempotencyKey\" = 'generation:user_1:same_request:reserve') FROM \"UserCreditWallet\" WHERE \"id\" = 'wallet_1'")"
test "$same_summary" = "80|20|1|1"
same_job_id="$(psql_exec -qAt -c "SELECT \"id\" FROM \"GenerationJob\" WHERE \"billingRequestId\" = 'same_request'")"

psql_exec -qAt -c "SELECT reserve_app_order('request_a', 'job_a')" >/dev/null
psql_exec -qAt -c "SELECT reserve_app_order('request_b', 'job_b')" >/dev/null

different_summary="$(psql_exec -qAt -c "SELECT \"balance\", \"frozenBalance\", (SELECT COUNT(*) FROM \"GenerationJob\"), (SELECT COUNT(*) FROM \"CreditLedger\" WHERE \"type\" = 'RESERVE') FROM \"UserCreditWallet\" WHERE \"id\" = 'wallet_1'")"
test "$different_summary" = "40|60|3|3"

for n in 1 2 3 4 5; do
  docker exec "$container" psql -qAt -v ON_ERROR_STOP=1 -U postgres -d "$db" \
    -c "SELECT settle_app_order('$same_job_id')" >/dev/null &
done
wait

settle_summary="$(psql_exec -qAt -c "SELECT \"balance\", \"frozenBalance\", \"totalConsumed\", (SELECT COUNT(*) FROM \"CreditLedger\" WHERE \"idempotencyKey\" = 'generation:$same_job_id:settle') FROM \"UserCreditWallet\" WHERE \"id\" = 'wallet_1'")"
test "$settle_summary" = "40|40|20|1"

for n in 1 2 3 4 5; do
  docker exec "$container" psql -qAt -v ON_ERROR_STOP=1 -U postgres -d "$db" \
    -c "SELECT release_app_order('job_a')" >/dev/null &
done
wait

release_summary="$(psql_exec -qAt -c "SELECT \"balance\", \"frozenBalance\", \"totalConsumed\", (SELECT COUNT(*) FROM \"CreditLedger\" WHERE \"idempotencyKey\" = 'generation:job_a:release') FROM \"UserCreditWallet\" WHERE \"id\" = 'wallet_1'")"
test "$release_summary" = "60|20|20|1"

echo "PostgreSQL idempotency concurrency QA passed"
