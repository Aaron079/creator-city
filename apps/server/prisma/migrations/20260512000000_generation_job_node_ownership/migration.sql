ALTER TABLE "GenerationJob" ADD COLUMN IF NOT EXISTS "nodeId" TEXT;

CREATE INDEX IF NOT EXISTS "GenerationJob_nodeId_idx" ON "GenerationJob"("nodeId");
CREATE INDEX IF NOT EXISTS "GenerationJob_projectId_nodeId_idx" ON "GenerationJob"("projectId", "nodeId");
