-- Safe repeatable indexes for Creator City first-screen reads.
-- This file only adds indexes; it does not mutate or remove data.

CREATE INDEX IF NOT EXISTS "Project_ownerId_updatedAt_idx"
ON "Project" ("ownerId", "updatedAt");

CREATE INDEX IF NOT EXISTS "Project_ownerId_lastOpenedAt_idx"
ON "Project" ("ownerId", "lastOpenedAt");

CREATE INDEX IF NOT EXISTS "CanvasWorkflow_projectId_idx"
ON "CanvasWorkflow" ("projectId");

CREATE INDEX IF NOT EXISTS "CanvasNode_workflowId_idx"
ON "CanvasNode" ("workflowId");

CREATE INDEX IF NOT EXISTS "CanvasNode_workflowId_nodeId_idx"
ON "CanvasNode" ("workflowId", "nodeId");

CREATE INDEX IF NOT EXISTS "CanvasEdge_workflowId_idx"
ON "CanvasEdge" ("workflowId");

CREATE INDEX IF NOT EXISTS "CreditLedger_userId_createdAt_idx"
ON "CreditLedger" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "PaymentOrder_userId_createdAt_idx"
ON "PaymentOrder" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "PaymentOrder_externalOrderId_lookup_idx"
ON "PaymentOrder" ("externalOrderId");

CREATE INDEX IF NOT EXISTS "Asset_ownerId_createdAt_idx"
ON "Asset" ("ownerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Asset_projectId_createdAt_idx"
ON "Asset" ("projectId", "createdAt");
