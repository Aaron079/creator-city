-- Normalize fresh database bootstrap to the current Prisma-managed schema.
-- Legacy manual SQL objects that are outside Prisma remain preserved.

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "lastOpenedAt" TIMESTAMP(3);

ALTER TABLE "WebAuthnCredential"
  ALTER COLUMN "transports" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "CanvasWorkflow" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Main Canvas',
  "version" INTEGER NOT NULL DEFAULT 1,
  "viewportJson" JSONB,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanvasWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CanvasNode" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT,
  "providerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'idle',
  "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "width" DOUBLE PRECISION NOT NULL DEFAULT 320,
  "height" DOUBLE PRECISION NOT NULL DEFAULT 220,
  "prompt" TEXT,
  "resultText" TEXT,
  "resultImageUrl" TEXT,
  "resultVideoUrl" TEXT,
  "resultAudioUrl" TEXT,
  "resultPreview" TEXT,
  "errorMessage" TEXT,
  "paramsJson" JSONB,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanvasNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CanvasEdge" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "edgeId" TEXT NOT NULL,
  "sourceNodeId" TEXT NOT NULL,
  "targetNodeId" TEXT NOT NULL,
  "type" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanvasEdge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CanvasComment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "nodeId" TEXT,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "x" DOUBLE PRECISION,
  "y" DOUBLE PRECISION,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanvasComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeliveryShare" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "message" TEXT,
  "metadataJson" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeliveryItem" (
  "id" TEXT NOT NULL,
  "shareId" TEXT NOT NULL,
  "assetId" TEXT,
  "canvasNodeId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "url" TEXT,
  "contentText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeliveryComment" (
  "id" TEXT NOT NULL,
  "shareId" TEXT NOT NULL,
  "itemId" TEXT,
  "authorName" TEXT,
  "authorEmail" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'comment',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProviderAccount" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "monthlyBudgetUsd" DECIMAL(65,30),
  "currentMonthCostUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "budgetMonth" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProviderPricingRule" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "modelId" TEXT NOT NULL DEFAULT '*',
  "nodeType" TEXT NOT NULL,
  "creditsPerCall" INTEGER NOT NULL DEFAULT 10,
  "costUsdPerCall" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderPricingRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CanvasWorkflow"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CanvasNode"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CanvasEdge"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "CanvasComment"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "DeliveryShare"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "DeliveryItem"
  ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "DeliveryComment"
  ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "ProviderAccount"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ProviderPricingRule"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryShare_token_key" ON "DeliveryShare"("token");
CREATE INDEX IF NOT EXISTS "DeliveryShare_projectId_idx" ON "DeliveryShare"("projectId");
CREATE INDEX IF NOT EXISTS "DeliveryShare_ownerId_idx" ON "DeliveryShare"("ownerId");
CREATE INDEX IF NOT EXISTS "DeliveryShare_recipientEmail_idx" ON "DeliveryShare"("recipientEmail");
CREATE INDEX IF NOT EXISTS "DeliveryShare_status_idx" ON "DeliveryShare"("status");
CREATE INDEX IF NOT EXISTS "DeliveryShare_createdAt_idx" ON "DeliveryShare"("createdAt");

CREATE INDEX IF NOT EXISTS "DeliveryItem_shareId_idx" ON "DeliveryItem"("shareId");
CREATE INDEX IF NOT EXISTS "DeliveryItem_assetId_idx" ON "DeliveryItem"("assetId");
CREATE INDEX IF NOT EXISTS "DeliveryItem_canvasNodeId_idx" ON "DeliveryItem"("canvasNodeId");
CREATE INDEX IF NOT EXISTS "DeliveryItem_sortOrder_idx" ON "DeliveryItem"("sortOrder");

CREATE INDEX IF NOT EXISTS "DeliveryComment_shareId_idx" ON "DeliveryComment"("shareId");
CREATE INDEX IF NOT EXISTS "DeliveryComment_itemId_idx" ON "DeliveryComment"("itemId");
CREATE INDEX IF NOT EXISTS "DeliveryComment_status_idx" ON "DeliveryComment"("status");
CREATE INDEX IF NOT EXISTS "DeliveryComment_createdAt_idx" ON "DeliveryComment"("createdAt");

CREATE INDEX IF NOT EXISTS "CanvasWorkflow_projectId_idx" ON "CanvasWorkflow"("projectId");

CREATE INDEX IF NOT EXISTS "CanvasNode_workflowId_idx" ON "CanvasNode"("workflowId");
CREATE INDEX IF NOT EXISTS "CanvasNode_kind_idx" ON "CanvasNode"("kind");
CREATE INDEX IF NOT EXISTS "CanvasNode_status_idx" ON "CanvasNode"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "CanvasNode_workflowId_nodeId_key" ON "CanvasNode"("workflowId", "nodeId");

CREATE INDEX IF NOT EXISTS "CanvasEdge_workflowId_idx" ON "CanvasEdge"("workflowId");
CREATE INDEX IF NOT EXISTS "CanvasEdge_sourceNodeId_idx" ON "CanvasEdge"("sourceNodeId");
CREATE INDEX IF NOT EXISTS "CanvasEdge_targetNodeId_idx" ON "CanvasEdge"("targetNodeId");
CREATE UNIQUE INDEX IF NOT EXISTS "CanvasEdge_workflowId_edgeId_key" ON "CanvasEdge"("workflowId", "edgeId");

CREATE INDEX IF NOT EXISTS "CanvasComment_projectId_idx" ON "CanvasComment"("projectId");
CREATE INDEX IF NOT EXISTS "CanvasComment_workflowId_idx" ON "CanvasComment"("workflowId");
CREATE INDEX IF NOT EXISTS "CanvasComment_nodeId_idx" ON "CanvasComment"("nodeId");
CREATE INDEX IF NOT EXISTS "CanvasComment_authorId_idx" ON "CanvasComment"("authorId");
CREATE INDEX IF NOT EXISTS "CanvasComment_createdAt_idx" ON "CanvasComment"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderAccount_providerId_key" ON "ProviderAccount"("providerId");
CREATE INDEX IF NOT EXISTS "ProviderAccount_providerId_idx" ON "ProviderAccount"("providerId");

CREATE INDEX IF NOT EXISTS "ProviderPricingRule_providerId_idx" ON "ProviderPricingRule"("providerId");
CREATE INDEX IF NOT EXISTS "ProviderPricingRule_nodeType_idx" ON "ProviderPricingRule"("nodeType");
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderPricingRule_providerId_modelId_nodeType_key"
  ON "ProviderPricingRule"("providerId", "modelId", "nodeType");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Asset_projectId_fkey'
      AND conrelid = 'public."Asset"'::regclass
  ) THEN
    ALTER TABLE "Asset"
      ADD CONSTRAINT "Asset_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Asset_workflowId_fkey'
      AND conrelid = 'public."Asset"'::regclass
  ) THEN
    ALTER TABLE "Asset"
      ADD CONSTRAINT "Asset_workflowId_fkey"
      FOREIGN KEY ("workflowId") REFERENCES "CanvasWorkflow"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CanvasWorkflow_projectId_fkey'
      AND conrelid = 'public."CanvasWorkflow"'::regclass
  ) THEN
    ALTER TABLE "CanvasWorkflow"
      ADD CONSTRAINT "CanvasWorkflow_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CanvasNode_workflowId_fkey'
      AND conrelid = 'public."CanvasNode"'::regclass
  ) THEN
    ALTER TABLE "CanvasNode"
      ADD CONSTRAINT "CanvasNode_workflowId_fkey"
      FOREIGN KEY ("workflowId") REFERENCES "CanvasWorkflow"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CanvasEdge_workflowId_fkey'
      AND conrelid = 'public."CanvasEdge"'::regclass
  ) THEN
    ALTER TABLE "CanvasEdge"
      ADD CONSTRAINT "CanvasEdge_workflowId_fkey"
      FOREIGN KEY ("workflowId") REFERENCES "CanvasWorkflow"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CanvasComment_projectId_fkey'
      AND conrelid = 'public."CanvasComment"'::regclass
  ) THEN
    ALTER TABLE "CanvasComment"
      ADD CONSTRAINT "CanvasComment_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CanvasComment_workflowId_fkey'
      AND conrelid = 'public."CanvasComment"'::regclass
  ) THEN
    ALTER TABLE "CanvasComment"
      ADD CONSTRAINT "CanvasComment_workflowId_fkey"
      FOREIGN KEY ("workflowId") REFERENCES "CanvasWorkflow"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeliveryShare_projectId_fkey'
      AND conrelid = 'public."DeliveryShare"'::regclass
  ) THEN
    ALTER TABLE "DeliveryShare"
      ADD CONSTRAINT "DeliveryShare_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeliveryShare_ownerId_fkey'
      AND conrelid = 'public."DeliveryShare"'::regclass
  ) THEN
    ALTER TABLE "DeliveryShare"
      ADD CONSTRAINT "DeliveryShare_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeliveryItem_shareId_fkey'
      AND conrelid = 'public."DeliveryItem"'::regclass
  ) THEN
    ALTER TABLE "DeliveryItem"
      ADD CONSTRAINT "DeliveryItem_shareId_fkey"
      FOREIGN KEY ("shareId") REFERENCES "DeliveryShare"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeliveryItem_assetId_fkey'
      AND conrelid = 'public."DeliveryItem"'::regclass
  ) THEN
    ALTER TABLE "DeliveryItem"
      ADD CONSTRAINT "DeliveryItem_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeliveryComment_shareId_fkey'
      AND conrelid = 'public."DeliveryComment"'::regclass
  ) THEN
    ALTER TABLE "DeliveryComment"
      ADD CONSTRAINT "DeliveryComment_shareId_fkey"
      FOREIGN KEY ("shareId") REFERENCES "DeliveryShare"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeliveryComment_itemId_fkey'
      AND conrelid = 'public."DeliveryComment"'::regclass
  ) THEN
    ALTER TABLE "DeliveryComment"
      ADD CONSTRAINT "DeliveryComment_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "DeliveryItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  fn_oid oid;
  fn_def text;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO fn_oid, fn_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname = 'touch_delivery_share_updated_at'
    AND pg_get_function_identity_arguments(p.oid) = ''
    AND l.lanname = 'plpgsql'
    AND p.prosecdef = false;

  IF fn_oid IS NULL THEN
    CREATE FUNCTION touch_delivery_share_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW."updatedAt" = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $fn$;
  ELSIF fn_def !~ 'NEW\."updatedAt"[[:space:]]*=[[:space:]]*(CURRENT_TIMESTAMP|now\(\))'
     OR fn_def !~ 'RETURN NEW'
     OR fn_def ~* '\\mEXECUTE\\M'
     OR fn_def ~* '\\mINSERT\\M|\\mUPDATE\\M|\\mDELETE\\M|\\mALTER\\M|\\mDROP\\M' THEN
    RAISE EXCEPTION 'Incompatible touch_delivery_share_updated_at() definition';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'DeliveryShare'
      AND t.tgname = 'DeliveryShare_updatedAt'
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER "DeliveryShare_updatedAt"
      BEFORE UPDATE ON "DeliveryShare"
      FOR EACH ROW EXECUTE FUNCTION touch_delivery_share_updated_at();
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'DeliveryShare'
      AND t.tgname = 'DeliveryShare_updatedAt'
      AND NOT t.tgisinternal
      AND (t.tgtype & 2) = 2
      AND (t.tgtype & 16) = 16
      AND (t.tgtype & 4) = 0
      AND (t.tgtype & 8) = 0
      AND t.tgfoid = 'public.touch_delivery_share_updated_at()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'Incompatible DeliveryShare_updatedAt trigger';
  END IF;
END $$;

DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(format('%I.%I', spec.table_name, spec.column_name), ', ')
    INTO missing
  FROM (
    VALUES
      ('Project','thumbnailUrl','text','YES'),
      ('Project','lastOpenedAt','timestamp','YES'),
      ('CanvasWorkflow','id','text','NO'),
      ('CanvasWorkflow','projectId','text','NO'),
      ('CanvasWorkflow','name','text','NO'),
      ('CanvasWorkflow','version','int4','NO'),
      ('CanvasWorkflow','viewportJson','jsonb','YES'),
      ('CanvasWorkflow','metadataJson','jsonb','YES'),
      ('CanvasWorkflow','createdAt','timestamp','NO'),
      ('CanvasWorkflow','updatedAt','timestamp','NO'),
      ('CanvasNode','id','text','NO'),
      ('CanvasNode','workflowId','text','NO'),
      ('CanvasNode','nodeId','text','NO'),
      ('CanvasNode','kind','text','NO'),
      ('CanvasNode','title','text','YES'),
      ('CanvasNode','providerId','text','YES'),
      ('CanvasNode','status','text','NO'),
      ('CanvasNode','x','float8','NO'),
      ('CanvasNode','y','float8','NO'),
      ('CanvasNode','width','float8','NO'),
      ('CanvasNode','height','float8','NO'),
      ('CanvasNode','prompt','text','YES'),
      ('CanvasNode','resultText','text','YES'),
      ('CanvasNode','resultImageUrl','text','YES'),
      ('CanvasNode','resultVideoUrl','text','YES'),
      ('CanvasNode','resultAudioUrl','text','YES'),
      ('CanvasNode','resultPreview','text','YES'),
      ('CanvasNode','errorMessage','text','YES'),
      ('CanvasNode','paramsJson','jsonb','YES'),
      ('CanvasNode','metadataJson','jsonb','YES'),
      ('CanvasNode','createdAt','timestamp','NO'),
      ('CanvasNode','updatedAt','timestamp','NO'),
      ('CanvasEdge','id','text','NO'),
      ('CanvasEdge','workflowId','text','NO'),
      ('CanvasEdge','edgeId','text','NO'),
      ('CanvasEdge','sourceNodeId','text','NO'),
      ('CanvasEdge','targetNodeId','text','NO'),
      ('CanvasEdge','type','text','YES'),
      ('CanvasEdge','metadataJson','jsonb','YES'),
      ('CanvasEdge','createdAt','timestamp','NO'),
      ('CanvasEdge','updatedAt','timestamp','NO'),
      ('CanvasComment','id','text','NO'),
      ('CanvasComment','projectId','text','NO'),
      ('CanvasComment','workflowId','text','NO'),
      ('CanvasComment','nodeId','text','YES'),
      ('CanvasComment','authorId','text','YES'),
      ('CanvasComment','body','text','NO'),
      ('CanvasComment','status','text','NO'),
      ('CanvasComment','x','float8','YES'),
      ('CanvasComment','y','float8','YES'),
      ('CanvasComment','metadataJson','jsonb','YES'),
      ('CanvasComment','createdAt','timestamp','NO'),
      ('CanvasComment','updatedAt','timestamp','NO'),
      ('DeliveryShare','id','text','NO'),
      ('DeliveryShare','projectId','text','NO'),
      ('DeliveryShare','ownerId','text','NO'),
      ('DeliveryShare','token','text','NO'),
      ('DeliveryShare','title','text','NO'),
      ('DeliveryShare','status','text','NO'),
      ('DeliveryShare','recipientName','text','YES'),
      ('DeliveryShare','recipientEmail','text','YES'),
      ('DeliveryShare','message','text','YES'),
      ('DeliveryShare','metadataJson','jsonb','YES'),
      ('DeliveryShare','expiresAt','timestamp','YES'),
      ('DeliveryShare','createdAt','timestamp','NO'),
      ('DeliveryShare','updatedAt','timestamp','NO'),
      ('DeliveryItem','id','text','NO'),
      ('DeliveryItem','shareId','text','NO'),
      ('DeliveryItem','assetId','text','YES'),
      ('DeliveryItem','canvasNodeId','text','YES'),
      ('DeliveryItem','type','text','NO'),
      ('DeliveryItem','title','text','YES'),
      ('DeliveryItem','url','text','YES'),
      ('DeliveryItem','contentText','text','YES'),
      ('DeliveryItem','sortOrder','int4','NO'),
      ('DeliveryItem','createdAt','timestamp','NO'),
      ('DeliveryComment','id','text','NO'),
      ('DeliveryComment','shareId','text','NO'),
      ('DeliveryComment','itemId','text','YES'),
      ('DeliveryComment','authorName','text','YES'),
      ('DeliveryComment','authorEmail','text','YES'),
      ('DeliveryComment','body','text','NO'),
      ('DeliveryComment','status','text','NO'),
      ('DeliveryComment','createdAt','timestamp','NO'),
      ('ProviderAccount','id','text','NO'),
      ('ProviderAccount','providerId','text','NO'),
      ('ProviderAccount','displayName','text','NO'),
      ('ProviderAccount','monthlyBudgetUsd','numeric','YES'),
      ('ProviderAccount','currentMonthCostUsd','numeric','NO'),
      ('ProviderAccount','budgetMonth','text','YES'),
      ('ProviderAccount','lastCheckedAt','timestamp','YES'),
      ('ProviderAccount','isActive','bool','NO'),
      ('ProviderAccount','createdAt','timestamp','NO'),
      ('ProviderAccount','updatedAt','timestamp','NO'),
      ('ProviderPricingRule','id','text','NO'),
      ('ProviderPricingRule','providerId','text','NO'),
      ('ProviderPricingRule','modelId','text','NO'),
      ('ProviderPricingRule','nodeType','text','NO'),
      ('ProviderPricingRule','creditsPerCall','int4','NO'),
      ('ProviderPricingRule','costUsdPerCall','numeric','NO'),
      ('ProviderPricingRule','isActive','bool','NO'),
      ('ProviderPricingRule','createdAt','timestamp','NO'),
      ('ProviderPricingRule','updatedAt','timestamp','NO'),
      ('WebAuthnCredential','transports','_text','YES'),
      ('WebAuthnCredential','updatedAt','timestamp','NO')
  ) AS spec(table_name, column_name, udt_name, is_nullable)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name = spec.table_name
   AND c.column_name = spec.column_name
   AND c.udt_name = spec.udt_name
   AND c.is_nullable = spec.is_nullable
  WHERE c.column_name IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Schema normalization missing or incompatible columns: %', missing;
  END IF;
END $$;

DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(name, ', ')
    INTO missing
  FROM (
    VALUES
      ('Asset_projectId_fkey'),
      ('Asset_workflowId_fkey'),
      ('CanvasWorkflow_projectId_fkey'),
      ('CanvasNode_workflowId_fkey'),
      ('CanvasEdge_workflowId_fkey'),
      ('CanvasComment_projectId_fkey'),
      ('CanvasComment_workflowId_fkey'),
      ('DeliveryShare_projectId_fkey'),
      ('DeliveryShare_ownerId_fkey'),
      ('DeliveryItem_shareId_fkey'),
      ('DeliveryItem_assetId_fkey'),
      ('DeliveryComment_shareId_fkey'),
      ('DeliveryComment_itemId_fkey')
  ) AS spec(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_namespace n ON n.oid = con.connamespace
    WHERE n.nspname = 'public'
      AND con.conname = spec.name
      AND con.contype = 'f'
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Schema normalization missing foreign keys: %', missing;
  END IF;

  SELECT string_agg(name, ', ')
    INTO missing
  FROM (
    VALUES
      ('DeliveryShare_token_key'),
      ('DeliveryShare_projectId_idx'),
      ('DeliveryShare_ownerId_idx'),
      ('DeliveryShare_recipientEmail_idx'),
      ('DeliveryShare_status_idx'),
      ('DeliveryShare_createdAt_idx'),
      ('DeliveryItem_shareId_idx'),
      ('DeliveryItem_assetId_idx'),
      ('DeliveryItem_canvasNodeId_idx'),
      ('DeliveryItem_sortOrder_idx'),
      ('DeliveryComment_shareId_idx'),
      ('DeliveryComment_itemId_idx'),
      ('DeliveryComment_status_idx'),
      ('DeliveryComment_createdAt_idx'),
      ('CanvasWorkflow_projectId_idx'),
      ('CanvasNode_workflowId_idx'),
      ('CanvasNode_kind_idx'),
      ('CanvasNode_status_idx'),
      ('CanvasNode_workflowId_nodeId_key'),
      ('CanvasEdge_workflowId_idx'),
      ('CanvasEdge_sourceNodeId_idx'),
      ('CanvasEdge_targetNodeId_idx'),
      ('CanvasEdge_workflowId_edgeId_key'),
      ('CanvasComment_projectId_idx'),
      ('CanvasComment_workflowId_idx'),
      ('CanvasComment_nodeId_idx'),
      ('CanvasComment_authorId_idx'),
      ('CanvasComment_createdAt_idx'),
      ('ProviderAccount_providerId_key'),
      ('ProviderAccount_providerId_idx'),
      ('ProviderPricingRule_providerId_idx'),
      ('ProviderPricingRule_nodeType_idx'),
      ('ProviderPricingRule_providerId_modelId_nodeType_key')
  ) AS spec(name)
  WHERE to_regclass(format('public.%I', spec.name)) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Schema normalization missing indexes: %', missing;
  END IF;
END $$;
