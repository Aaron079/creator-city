-- Creator City canvas comments setup.
-- Safe to run repeatedly in Supabase SQL editor.
-- This file only creates/adds schema objects; it never drops, deletes, or truncates data.

CREATE TABLE IF NOT EXISTS "CanvasComment" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "projectId" text NOT NULL,
  "workflowId" text NOT NULL,
  "nodeId" text,
  "authorId" text,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "x" double precision,
  "y" double precision,
  "metadataJson" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "id" text DEFAULT gen_random_uuid()::text;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "projectId" text;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "workflowId" text;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "nodeId" text;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "authorId" text;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "body" text;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'open';
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "x" double precision;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "y" double precision;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CanvasComment" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "CanvasComment_projectId_idx" ON "CanvasComment" ("projectId");
CREATE INDEX IF NOT EXISTS "CanvasComment_workflowId_idx" ON "CanvasComment" ("workflowId");
CREATE INDEX IF NOT EXISTS "CanvasComment_nodeId_idx" ON "CanvasComment" ("nodeId");
CREATE INDEX IF NOT EXISTS "CanvasComment_authorId_idx" ON "CanvasComment" ("authorId");
CREATE INDEX IF NOT EXISTS "CanvasComment_createdAt_idx" ON "CanvasComment" ("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CanvasComment_projectId_fkey') THEN
    ALTER TABLE "CanvasComment"
      ADD CONSTRAINT "CanvasComment_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CanvasComment_workflowId_fkey') THEN
    ALTER TABLE "CanvasComment"
      ADD CONSTRAINT "CanvasComment_workflowId_fkey"
      FOREIGN KEY ("workflowId") REFERENCES "CanvasWorkflow"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

SELECT 'canvas comments setup complete' AS status;
