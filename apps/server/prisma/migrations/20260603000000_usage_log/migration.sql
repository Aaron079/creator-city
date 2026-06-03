-- Phase S1: UsageLog — platform usage logging
-- Records generation attempts (BYOK and platform_credits) without billing changes.
-- Never stores prompt text, API keys, or encrypted credentials.

CREATE TABLE "UsageLog" (
  "id"                        TEXT         NOT NULL,
  "userId"                    TEXT         NOT NULL,
  "projectId"                 TEXT,
  "workflowId"                TEXT,
  "nodeId"                    TEXT,
  "generationJobId"           TEXT,
  "providerId"                TEXT         NOT NULL,
  "modelId"                   TEXT,
  "outputType"                TEXT         NOT NULL,
  "billingMode"               TEXT         NOT NULL,
  "providerAccountId"         TEXT,
  "assetId"                   TEXT,
  "status"                    TEXT         NOT NULL,
  "providerCostPaidBy"        TEXT         NOT NULL,
  "platformServiceFeeCredits" INTEGER      NOT NULL DEFAULT 0,
  "promptChars"               INTEGER      NOT NULL DEFAULT 0,
  "durationSeconds"           DOUBLE PRECISION,
  "errorCode"                 TEXT,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsageLog_userId_idx"              ON "UsageLog"("userId");
CREATE INDEX "UsageLog_userId_billingMode_idx"  ON "UsageLog"("userId", "billingMode");
CREATE INDEX "UsageLog_generationJobId_idx"     ON "UsageLog"("generationJobId");
CREATE INDEX "UsageLog_providerId_idx"          ON "UsageLog"("providerId");
CREATE INDEX "UsageLog_outputType_idx"          ON "UsageLog"("outputType");
CREATE INDEX "UsageLog_billingMode_idx"         ON "UsageLog"("billingMode");
CREATE INDEX "UsageLog_createdAt_idx"           ON "UsageLog"("createdAt");
