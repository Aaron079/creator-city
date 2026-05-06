-- Creator City delivery MVP tables.
-- Safe to run more than once. Does not drop, delete, or truncate data.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "DeliveryShare" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "projectId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeliveryItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
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
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "shareId" TEXT NOT NULL,
  "itemId" TEXT,
  "authorName" TEXT,
  "authorEmail" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'comment',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryShare_token_key" ON "DeliveryShare"("token");
CREATE INDEX IF NOT EXISTS "DeliveryShare_projectId_idx" ON "DeliveryShare"("projectId");
CREATE INDEX IF NOT EXISTS "DeliveryShare_ownerId_idx" ON "DeliveryShare"("ownerId");
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryShare_projectId_fkey'
  ) THEN
    ALTER TABLE "DeliveryShare"
      ADD CONSTRAINT "DeliveryShare_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryShare_ownerId_fkey'
  ) THEN
    ALTER TABLE "DeliveryShare"
      ADD CONSTRAINT "DeliveryShare_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryItem_shareId_fkey'
  ) THEN
    ALTER TABLE "DeliveryItem"
      ADD CONSTRAINT "DeliveryItem_shareId_fkey"
      FOREIGN KEY ("shareId") REFERENCES "DeliveryShare"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryItem_assetId_fkey'
  ) THEN
    ALTER TABLE "DeliveryItem"
      ADD CONSTRAINT "DeliveryItem_assetId_fkey"
      FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryComment_shareId_fkey'
  ) THEN
    ALTER TABLE "DeliveryComment"
      ADD CONSTRAINT "DeliveryComment_shareId_fkey"
      FOREIGN KEY ("shareId") REFERENCES "DeliveryShare"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryComment_itemId_fkey'
  ) THEN
    ALTER TABLE "DeliveryComment"
      ADD CONSTRAINT "DeliveryComment_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "DeliveryItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "touch_delivery_share_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'DeliveryShare_updatedAt'
  ) THEN
    CREATE TRIGGER "DeliveryShare_updatedAt"
      BEFORE UPDATE ON "DeliveryShare"
      FOR EACH ROW
      EXECUTE FUNCTION "touch_delivery_share_updated_at"();
  END IF;
END $$;
