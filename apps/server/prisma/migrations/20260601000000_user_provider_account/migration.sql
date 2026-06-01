-- Phase 2A: UserProviderAccount foundation (BYOK — bring-your-own-key)
-- Schema only. Not wired into generation chain.

CREATE TABLE "UserProviderAccount" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "providerId"      TEXT NOT NULL,
  "accountLabel"    TEXT NOT NULL,
  "encryptedApiKey" TEXT NOT NULL,
  "keyLast4"        TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'active',
  "isDefault"       BOOLEAN NOT NULL DEFAULT false,
  "projectScope"    TEXT,
  "lastTestedAt"    TIMESTAMP(3),
  "lastTestStatus"  TEXT,
  "lastTestError"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserProviderAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserProviderAccount"
  ADD CONSTRAINT "UserProviderAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "UserProviderAccount_userId_idx"            ON "UserProviderAccount"("userId");
CREATE INDEX "UserProviderAccount_userId_providerId_idx" ON "UserProviderAccount"("userId", "providerId");
CREATE INDEX "UserProviderAccount_userId_status_idx"     ON "UserProviderAccount"("userId", "status");
