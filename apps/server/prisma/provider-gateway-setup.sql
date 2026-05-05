-- Provider Gateway database setup for Supabase SQL Editor.
-- Safe to run multiple times. Uses only explicit DDL for the provider gateway tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "ProviderAccount" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "providerId" text NOT NULL,
  "displayName" text NOT NULL,
  "monthlyBudgetUsd" numeric(65,30),
  "currentMonthCostUsd" numeric(65,30) NOT NULL DEFAULT 0,
  "budgetMonth" text,
  "lastCheckedAt" timestamp(3),
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "id" text DEFAULT gen_random_uuid()::text;
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "providerId" text;
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "displayName" text;
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "monthlyBudgetUsd" numeric(65,30);
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "currentMonthCostUsd" numeric(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "budgetMonth" text;
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "lastCheckedAt" timestamp(3);
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProviderAccount" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderAccount_providerId_key" ON "ProviderAccount"("providerId");
CREATE INDEX IF NOT EXISTS "ProviderAccount_providerId_idx" ON "ProviderAccount"("providerId");

CREATE TABLE IF NOT EXISTS "ProviderPricingRule" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "providerId" text NOT NULL,
  "modelId" text NOT NULL DEFAULT '*',
  "nodeType" text NOT NULL,
  "creditsPerCall" integer NOT NULL DEFAULT 10,
  "costUsdPerCall" numeric(65,30) NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "id" text DEFAULT gen_random_uuid()::text;
ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "providerId" text;
ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "modelId" text NOT NULL DEFAULT '*';
ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "nodeType" text;
ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "creditsPerCall" integer NOT NULL DEFAULT 10;
ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "costUsdPerCall" numeric(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;
ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProviderPricingRule" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderPricingRule_providerId_modelId_nodeType_key" ON "ProviderPricingRule"("providerId", "modelId", "nodeType");
CREATE INDEX IF NOT EXISTS "ProviderPricingRule_providerId_idx" ON "ProviderPricingRule"("providerId");
CREATE INDEX IF NOT EXISTS "ProviderPricingRule_nodeType_idx" ON "ProviderPricingRule"("nodeType");

CREATE TABLE IF NOT EXISTS "ProviderCostLedger" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" text,
  "generationJobId" text,
  "providerId" text NOT NULL,
  "model" text,
  "jobType" text NOT NULL,
  "providerCostUsd" numeric(65,30) NOT NULL DEFAULT 0,
  "providerCostCny" numeric(65,30) NOT NULL DEFAULT 0,
  "userChargedCredits" integer NOT NULL DEFAULT 0,
  "marginCredits" integer,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "id" text DEFAULT gen_random_uuid()::text;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "userId" text;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "generationJobId" text;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "providerId" text;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "model" text;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "jobType" text;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "providerCostUsd" numeric(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "providerCostCny" numeric(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "userChargedCredits" integer NOT NULL DEFAULT 0;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "marginCredits" integer;
ALTER TABLE "ProviderCostLedger" ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "ProviderCostLedger_userId_idx" ON "ProviderCostLedger"("userId");
CREATE INDEX IF NOT EXISTS "ProviderCostLedger_generationJobId_idx" ON "ProviderCostLedger"("generationJobId");
CREATE INDEX IF NOT EXISTS "ProviderCostLedger_providerId_idx" ON "ProviderCostLedger"("providerId");
CREATE INDEX IF NOT EXISTS "ProviderCostLedger_createdAt_idx" ON "ProviderCostLedger"("createdAt");

CREATE TABLE IF NOT EXISTS "ProviderTopUpLedger" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "providerId" text NOT NULL,
  "amountUsd" numeric(65,30) NOT NULL,
  "paymentMethod" text,
  "externalReceiptUrl" text,
  "note" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ProviderTopUpLedger" ADD COLUMN IF NOT EXISTS "id" text DEFAULT gen_random_uuid()::text;
ALTER TABLE "ProviderTopUpLedger" ADD COLUMN IF NOT EXISTS "providerId" text;
ALTER TABLE "ProviderTopUpLedger" ADD COLUMN IF NOT EXISTS "amountUsd" numeric(65,30);
ALTER TABLE "ProviderTopUpLedger" ADD COLUMN IF NOT EXISTS "paymentMethod" text;
ALTER TABLE "ProviderTopUpLedger" ADD COLUMN IF NOT EXISTS "externalReceiptUrl" text;
ALTER TABLE "ProviderTopUpLedger" ADD COLUMN IF NOT EXISTS "note" text;
ALTER TABLE "ProviderTopUpLedger" ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "ProviderTopUpLedger_providerId_idx" ON "ProviderTopUpLedger"("providerId");
CREATE INDEX IF NOT EXISTS "ProviderTopUpLedger_createdAt_idx" ON "ProviderTopUpLedger"("createdAt");

INSERT INTO "ProviderPricingRule" (
  "id",
  "providerId",
  "modelId",
  "nodeType",
  "creditsPerCall",
  "costUsdPerCall",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
  (gen_random_uuid()::text, 'openai',       '*', 'text',  10, 0.001, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'openai',       '*', 'image', 50, 0.011, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'openai-text',  '*', 'text',  10, 0.001, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'openai-image', '*', 'image', 50, 0.011, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'openrouter',   '*', 'text',  15, 0.002, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'fal',          '*', 'image', 30, 0.005, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'fal',          '*', 'video', 200, 0.050, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'replicate',    '*', 'image', 30, 0.005, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'replicate',    '*', 'video', 200, 0.050, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("providerId", "modelId", "nodeType") DO UPDATE SET
  "creditsPerCall" = EXCLUDED."creditsPerCall",
  "costUsdPerCall" = EXCLUDED."costUsdPerCall",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;
