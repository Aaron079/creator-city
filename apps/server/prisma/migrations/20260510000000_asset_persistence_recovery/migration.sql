-- Persist generated media with permanent storage credentials and recovery state.

ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'CHARACTER';
ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'STORYBOARD';
ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'REFERENCE';
ALTER TYPE "AssetType" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'MISSING';
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'NEEDS_RECOVERY';
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'UNRECOVERABLE';

DO $$
BEGIN
  CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'uploaded';
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "name" text NOT NULL DEFAULT 'Recovered legacy asset';
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "type" "AssetType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "status" "AssetStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "ownerId" text NOT NULL DEFAULT 'legacy-unknown-owner';
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "projectId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "workflowId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "nodeId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "providerJobId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "providerAssetId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "storageProvider" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "bucket" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "storageKey" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "url" text NOT NULL DEFAULT '';
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "dataUrl" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "thumbnailUrl" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "originalUrl" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "filename" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "mimeType" text NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "size" bigint;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "sizeBytes" bigint NOT NULL DEFAULT 0;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "width" integer;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "height" integer;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "duration" double precision;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "prompt" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "negativePrompt" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "providerId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "recoveryStatus" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "error" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "generationJobId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "isPublic" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Asset_storageKey_idx" ON "Asset"("storageKey");
CREATE INDEX IF NOT EXISTS "Asset_providerJobId_idx" ON "Asset"("providerJobId");
CREATE INDEX IF NOT EXISTS "Asset_generationJobId_idx" ON "Asset"("generationJobId");
CREATE INDEX IF NOT EXISTS "Asset_ownerId_idx" ON "Asset"("ownerId");
CREATE INDEX IF NOT EXISTS "Asset_projectId_idx" ON "Asset"("projectId");
CREATE INDEX IF NOT EXISTS "Asset_workflowId_idx" ON "Asset"("workflowId");
CREATE INDEX IF NOT EXISTS "Asset_nodeId_idx" ON "Asset"("nodeId");
CREATE INDEX IF NOT EXISTS "Asset_type_idx" ON "Asset"("type");
CREATE INDEX IF NOT EXISTS "Asset_status_idx" ON "Asset"("status");

ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "projectId" text;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "providerJobId" text;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "provider" text;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "kind" text;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "input" jsonb;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "output" jsonb;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "outputAssetId" text;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "error" text;
ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "completedAt" timestamp(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'GenerationJob'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE "GenerationJob" ADD COLUMN "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "GenerationJob_projectId_idx" ON "GenerationJob"("projectId");
CREATE INDEX IF NOT EXISTS "GenerationJob_status_idx" ON "GenerationJob"("status");
CREATE INDEX IF NOT EXISTS "GenerationJob_providerJobId_idx" ON "GenerationJob"("providerJobId");
CREATE INDEX IF NOT EXISTS "GenerationJob_outputAssetId_idx" ON "GenerationJob"("outputAssetId");
