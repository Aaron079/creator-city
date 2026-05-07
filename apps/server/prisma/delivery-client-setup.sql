-- Creator City targeted delivery recipient fields.
-- Safe to run more than once. Does not drop, delete, or truncate data.

ALTER TABLE "DeliveryShare"
ADD COLUMN IF NOT EXISTS "recipientName" TEXT;

ALTER TABLE "DeliveryShare"
ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;

ALTER TABLE "DeliveryShare"
ADD COLUMN IF NOT EXISTS "message" TEXT;

ALTER TABLE "DeliveryShare"
ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;

CREATE INDEX IF NOT EXISTS "DeliveryShare_recipientEmail_idx"
ON "DeliveryShare" ("recipientEmail");
