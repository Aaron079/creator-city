# P0: GenerationJob Production DB Migration

## A. 根因说明

生产数据库 `GenerationJob` 表是由第一次迁移 `20260501072452_add_credits_billing` 创建的，但后续两次迁移未执行：

| 迁移文件 | 状态 | 影响 |
|---|---|---|
| `20260501072452_add_credits_billing` | ✅ 已执行 | 建表（缺很多列） |
| `20260510000000_asset_persistence_recovery` | ❌ **未执行** | 缺 projectId / providerJobId / provider / kind / input / output / status / error / completedAt |
| `20260512000000_generation_job_node_ownership` | ❌ **未执行** | 缺 nodeId |

Prisma 报错：`Invalid prisma.generationJob.create() — The column 'projectId' does not exist in the current database.`

图片生成链路：`/api/generate/image` → `createImageGenerationJob()` → 写 `projectId` → **报错** → 返回 `generation_job_create_failed`。

---

## B. Supabase SQL Editor 执行步骤

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入你的 Creator City 项目
3. 左侧菜单 → **SQL Editor**
4. 点击 **New query**
5. 粘贴下方全部 SQL
6. 点击 **Run**（或 Ctrl+Enter）
7. 确认无报错后，返回 `/create` 重新测试图片生成

---

## C. 可直接粘贴执行的 SQL

```sql
-- ============================================================
-- Creator City — GenerationJob Production DB Migration
-- Safe to re-run: all statements use IF NOT EXISTS / DO $$ guards
-- ============================================================

-- 1. Create missing enum (idempotent)
DO $$ BEGIN
  CREATE TYPE "GenerationJobStatus" AS ENUM (
    'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add columns missing from migration 20260510000000
ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "projectId"     TEXT;

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "providerJobId" TEXT;

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "provider"      TEXT;

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "kind"          TEXT;

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "input"         JSONB;

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "output"        JSONB;

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "outputAssetId" TEXT;

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "error"         TEXT;

ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "completedAt"   TIMESTAMP(3);

-- 3. Add status column (conditional — may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'GenerationJob'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE "GenerationJob"
      ADD COLUMN "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED';
  END IF;
END $$;

-- 4. Add column missing from migration 20260512000000
ALTER TABLE "GenerationJob"
  ADD COLUMN IF NOT EXISTS "nodeId" TEXT;

-- 5. Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS "GenerationJob_projectId_idx"
  ON "GenerationJob" ("projectId");

CREATE INDEX IF NOT EXISTS "GenerationJob_providerJobId_idx"
  ON "GenerationJob" ("providerJobId");

CREATE INDEX IF NOT EXISTS "GenerationJob_outputAssetId_idx"
  ON "GenerationJob" ("outputAssetId");

CREATE INDEX IF NOT EXISTS "GenerationJob_status_idx"
  ON "GenerationJob" ("status");

CREATE INDEX IF NOT EXISTS "GenerationJob_nodeId_idx"
  ON "GenerationJob" ("nodeId");

CREATE INDEX IF NOT EXISTS "GenerationJob_projectId_nodeId_idx"
  ON "GenerationJob" ("projectId", "nodeId");
```

---

## D. 执行后验证 SQL

```sql
-- 验证所有列都已存在
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'GenerationJob'
ORDER BY ordinal_position;
```

期望看到（至少包含）：

| column_name | data_type |
|---|---|
| id | text |
| userId | text |
| projectId | text |
| nodeId | text |
| walletId | text |
| providerJobId | text |
| providerId | text |
| provider | text |
| nodeType | text |
| kind | text |
| status | USER-DEFINED |
| prompt | text |
| input | jsonb |
| output | jsonb |
| outputAssetId | text |
| errorMessage | text |
| error | text |
| completedAt | timestamp without time zone |
| createdAt | timestamp without time zone |
| updatedAt | timestamp without time zone |

---

## E. 执行 SQL 后如何测试

1. 在浏览器打开 `/create`
2. 选择一个已有项目节点
3. 点击"图片生成"
4. 节点状态应变为 `running`（异步流程）
5. 等待 30-60 秒
6. 节点图片应显示生成结果

如果仍然报 `generation_job_create_failed`，查看浏览器 Network 面板中 `/api/generate/image` 的响应体，里面的 `message` 字段会显示下一个缺失的列名。

---

## F. 代码侧同步修复（已部署）

`createImageGenerationJob` 已改为重试循环：Prisma 报告哪个列缺失，就跳过那个列重试，最多重试 10 次。即使数据库迁移尚未执行，也能降级写入（但 `projectId` / `nodeId` 等字段会为 null）。

执行迁移后，所有字段都能正常写入。
