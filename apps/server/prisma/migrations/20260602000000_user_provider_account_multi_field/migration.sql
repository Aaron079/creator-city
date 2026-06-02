-- V1: Multi-field credential extension for UserProviderAccount
-- Adds columns for storing additional encrypted fields (e.g. endpointId for Volcengine)
-- and safe display metadata for the frontend.
--
-- credentialType: identifies credential structure ("single_api_key" | "bearer_with_endpoint")
-- encryptedFields: additional encrypted field values — NEVER returned to frontend
-- fieldMeta: display-safe metadata ({ fieldName: { label, last4, updatedAt } })
--
-- encryptedApiKey remains the primary credential field and is not affected.
-- Existing single-key accounts remain fully functional.

ALTER TABLE "UserProviderAccount" ADD COLUMN IF NOT EXISTS "credentialType" TEXT;
ALTER TABLE "UserProviderAccount" ADD COLUMN IF NOT EXISTS "encryptedFields" JSONB;
ALTER TABLE "UserProviderAccount" ADD COLUMN IF NOT EXISTS "fieldMeta" JSONB;
