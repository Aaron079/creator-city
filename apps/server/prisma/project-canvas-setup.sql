-- Project + Canvas persistence setup for Supabase SQL Editor.
-- Safe to run multiple times. No data is removed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE "ProjectType" AS ENUM ('SHORT_FILM', 'FEATURE_FILM', 'WEB_SERIES', 'DOCUMENTARY', 'ANIMATION', 'MUSIC_VIDEO', 'COMMERCIAL', 'INTERACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PRE_PRODUCTION', 'IN_PRODUCTION', 'POST_PRODUCTION', 'COMPLETED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProjectVisibility" AS ENUM ('PRIVATE', 'COLLABORATORS', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AssetType" AS ENUM ('VIDEO', 'AUDIO', 'IMAGE', 'SCRIPT', 'DOCUMENT', 'MODEL_3D', 'PRESET', 'TEMPLATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AssetStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Project" (
  "id" text primary key DEFAULT gen_random_uuid()::text,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "type" "ProjectType" NOT NULL DEFAULT 'SHORT_FILM',
  "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility" "ProjectVisibility" NOT NULL DEFAULT 'PRIVATE',
  "ownerId" text NOT NULL,
  "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "genre" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "budgetTotal" integer NOT NULL DEFAULT 0,
  "deadline" timestamp(3),
  "views" integer NOT NULL DEFAULT 0,
  "likes" integer NOT NULL DEFAULT 0,
  "rating" double precision NOT NULL DEFAULT 0,
  "ratingCount" integer NOT NULL DEFAULT 0,
  "thumbnailUrl" text,
  "publishedAt" timestamp(3),
  "lastOpenedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "thumbnailUrl" text;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "lastOpenedAt" timestamp(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX IF NOT EXISTS "Project_updatedAt_idx" ON "Project"("updatedAt");
CREATE INDEX IF NOT EXISTS "Project_lastOpenedAt_idx" ON "Project"("lastOpenedAt");
CREATE INDEX IF NOT EXISTS "Project_ownerId_updatedAt_idx" ON "Project"("ownerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Project_ownerId_lastOpenedAt_idx" ON "Project"("ownerId", "lastOpenedAt");

CREATE TABLE IF NOT EXISTS "CanvasWorkflow" (
  "id" text primary key DEFAULT gen_random_uuid()::text,
  "projectId" text NOT NULL,
  "name" text NOT NULL DEFAULT 'Main Canvas',
  "version" integer NOT NULL DEFAULT 1,
  "viewportJson" jsonb,
  "metadataJson" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "CanvasWorkflow" ADD COLUMN IF NOT EXISTS "id" text DEFAULT gen_random_uuid()::text;
ALTER TABLE "CanvasWorkflow" ADD COLUMN IF NOT EXISTS "projectId" text;
ALTER TABLE "CanvasWorkflow" ADD COLUMN IF NOT EXISTS "name" text NOT NULL DEFAULT 'Main Canvas';
ALTER TABLE "CanvasWorkflow" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "CanvasWorkflow" ADD COLUMN IF NOT EXISTS "viewportJson" jsonb;
ALTER TABLE "CanvasWorkflow" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb;
ALTER TABLE "CanvasWorkflow" ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CanvasWorkflow" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "CanvasWorkflow_projectId_idx" ON "CanvasWorkflow"("projectId");

CREATE TABLE IF NOT EXISTS "CanvasNode" (
  "id" text primary key DEFAULT gen_random_uuid()::text,
  "workflowId" text NOT NULL,
  "nodeId" text NOT NULL,
  "kind" text NOT NULL,
  "title" text,
  "providerId" text,
  "status" text NOT NULL DEFAULT 'idle',
  "x" double precision NOT NULL DEFAULT 0,
  "y" double precision NOT NULL DEFAULT 0,
  "width" double precision NOT NULL DEFAULT 320,
  "height" double precision NOT NULL DEFAULT 220,
  "prompt" text,
  "resultText" text,
  "resultImageUrl" text,
  "resultVideoUrl" text,
  "resultAudioUrl" text,
  "resultPreview" text,
  "errorMessage" text,
  "paramsJson" jsonb,
  "metadataJson" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "workflowId" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "nodeId" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "kind" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "providerId" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'idle';
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "x" double precision NOT NULL DEFAULT 0;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "y" double precision NOT NULL DEFAULT 0;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "width" double precision NOT NULL DEFAULT 320;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "height" double precision NOT NULL DEFAULT 220;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "prompt" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "resultText" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "resultImageUrl" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "resultVideoUrl" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "resultAudioUrl" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "resultPreview" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "errorMessage" text;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "paramsJson" jsonb;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CanvasNode" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "CanvasNode_workflowId_nodeId_key" ON "CanvasNode"("workflowId", "nodeId");
CREATE INDEX IF NOT EXISTS "CanvasNode_workflowId_idx" ON "CanvasNode"("workflowId");
CREATE INDEX IF NOT EXISTS "CanvasNode_workflowId_nodeId_idx" ON "CanvasNode"("workflowId", "nodeId");
CREATE INDEX IF NOT EXISTS "CanvasNode_kind_idx" ON "CanvasNode"("kind");
CREATE INDEX IF NOT EXISTS "CanvasNode_status_idx" ON "CanvasNode"("status");

CREATE TABLE IF NOT EXISTS "CanvasEdge" (
  "id" text primary key DEFAULT gen_random_uuid()::text,
  "workflowId" text NOT NULL,
  "edgeId" text NOT NULL,
  "sourceNodeId" text NOT NULL,
  "targetNodeId" text NOT NULL,
  "type" text,
  "metadataJson" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "CanvasEdge" ADD COLUMN IF NOT EXISTS "workflowId" text;
ALTER TABLE "CanvasEdge" ADD COLUMN IF NOT EXISTS "edgeId" text;
ALTER TABLE "CanvasEdge" ADD COLUMN IF NOT EXISTS "sourceNodeId" text;
ALTER TABLE "CanvasEdge" ADD COLUMN IF NOT EXISTS "targetNodeId" text;
ALTER TABLE "CanvasEdge" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE "CanvasEdge" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb;
ALTER TABLE "CanvasEdge" ADD COLUMN IF NOT EXISTS "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CanvasEdge" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "CanvasEdge_workflowId_edgeId_key" ON "CanvasEdge"("workflowId", "edgeId");
CREATE INDEX IF NOT EXISTS "CanvasEdge_workflowId_idx" ON "CanvasEdge"("workflowId");
CREATE INDEX IF NOT EXISTS "CanvasEdge_workflowId_edgeId_idx" ON "CanvasEdge"("workflowId", "edgeId");
CREATE INDEX IF NOT EXISTS "CanvasEdge_sourceNodeId_idx" ON "CanvasEdge"("sourceNodeId");
CREATE INDEX IF NOT EXISTS "CanvasEdge_targetNodeId_idx" ON "CanvasEdge"("targetNodeId");

CREATE TABLE IF NOT EXISTS "Asset" (
  "id" text primary key DEFAULT gen_random_uuid()::text,
  "name" text NOT NULL,
  "title" text,
  "type" "AssetType" NOT NULL,
  "status" "AssetStatus" NOT NULL DEFAULT 'READY',
  "ownerId" text NOT NULL,
  "projectId" text,
  "workflowId" text,
  "nodeId" text,
  "url" text NOT NULL DEFAULT '',
  "dataUrl" text,
  "thumbnailUrl" text,
  "mimeType" text NOT NULL DEFAULT 'application/octet-stream',
  "sizeBytes" bigint NOT NULL DEFAULT 0,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "metadataJson" jsonb,
  "providerId" text,
  "generationJobId" text,
  "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "isPublic" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "title" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "projectId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "workflowId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "nodeId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "dataUrl" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "providerId" text;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "generationJobId" text;

CREATE INDEX IF NOT EXISTS "Asset_ownerId_idx" ON "Asset"("ownerId");
CREATE INDEX IF NOT EXISTS "Asset_projectId_idx" ON "Asset"("projectId");
CREATE INDEX IF NOT EXISTS "Asset_workflowId_idx" ON "Asset"("workflowId");
CREATE INDEX IF NOT EXISTS "Asset_nodeId_idx" ON "Asset"("nodeId");
CREATE INDEX IF NOT EXISTS "Asset_type_idx" ON "Asset"("type");
CREATE INDEX IF NOT EXISTS "Asset_status_idx" ON "Asset"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CanvasWorkflow_projectId_fkey') THEN
    ALTER TABLE "CanvasWorkflow" ADD CONSTRAINT "CanvasWorkflow_projectId_fkey" foreign key ("projectId") REFERENCES "Project"("id") ON UPDATE CASCADE on delete CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CanvasNode_workflowId_fkey') THEN
    ALTER TABLE "CanvasNode" ADD CONSTRAINT "CanvasNode_workflowId_fkey" foreign key ("workflowId") REFERENCES "CanvasWorkflow"("id") ON UPDATE CASCADE on delete CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CanvasEdge_workflowId_fkey') THEN
    ALTER TABLE "CanvasEdge" ADD CONSTRAINT "CanvasEdge_workflowId_fkey" foreign key ("workflowId") REFERENCES "CanvasWorkflow"("id") ON UPDATE CASCADE on delete CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Asset_projectId_fkey') THEN
    ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" foreign key ("projectId") REFERENCES "Project"("id") ON UPDATE CASCADE on delete SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Asset_workflowId_fkey') THEN
    ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workflowId_fkey" foreign key ("workflowId") REFERENCES "CanvasWorkflow"("id") ON UPDATE CASCADE on delete SET NULL;
  END IF;
END $$;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'Project',
    'CanvasWorkflow',
    'CanvasNode',
    'CanvasEdge',
    'Asset'
  )
order by table_name;
