# Global Provider Gateway — Architecture & Implementation Plan

> **Phase 2 status**: Types, error normalizer, adapter registry, and gateway skeleton are implemented.
> No existing generate routes have been modified. No real provider calls added.
> **Boundary**: P0-BOUNDARY-LOCK-ACTIVE applies. Forbidden Zone files untouched.

---

## 1. 为什么需要 Provider Gateway

Creator City 目标是让用户**只用自己的 Creator City 账号**，不需要注册 OpenAI / Runway / Seedance / ElevenLabs 等 provider。

平台统一调度所有 provider，用户只消耗 Credits。这要求：

1. 所有 provider API key 必须**只存在于服务端**（Vercel env / server-side secret）
2. 桌面端和浏览器端**永远拿不到** provider key
3. 所有 provider 调用必须经过统一的**权限验证 + billing + 成本追踪**
4. provider 失败时必须有标准化错误码和 credits 自动回退

---

## 2. 核心安全原则

| 原则 | 说明 |
|------|------|
| Provider key 不离开服务端 | key 存 Vercel env，只在 Next.js Route Handler 读取 |
| 桌面版不保存 provider key | Tauri WebView 指向线上 app，key 永远在 Vercel |
| 每次调用先验证 userId + projectId | 确认 project 归属当前用户，防止跨账号泄漏 |
| 先 reserve credits，再调用 provider | 余额不足时不发起 API 调用 |
| provider 失败自动 release credits | finalizeBilling 在失败路径执行 release |
| provider key 无效对用户只显示标准错误码 | 内部日志记录，不暴露 key 信息 |
| BYO Key 暂缓 | V1 主流程是平台统一调度，BYO Key 为未来 Phase 5+ 高级功能 |

---

## 3. 现有架构（Phase 1 审计结论）

### 三层 Registry（已有）

```
TOOL_PROVIDERS catalog         lib/tools/provider-catalog.ts     (60+, UI展示层)
ADMIN_PROVIDER_REGISTRY        lib/provider-management/index.ts  (19条, 启停/成本/env检查)
PROVIDER_REGION_REGISTRY       lib/regions/registry.ts           (路由层, cn vs global)
```

### 已有真实实现的 Provider（12个）

CN 链路（through cn-executor / Aliyun FC）：
- volcengine-seedance（video），volcengine-seedream（image）
- jimeng-image，jimeng-video
- deepseek-text，deepseek-reasoner
- kimi-text，kimi-multimodal

Global 链路（Vercel Route Handler）：
- openai-text，openai-image
- runway-video
- elevenlabs-audio

### 已有 Gateway 基础设施（lib/gateway/）

| 文件 | 用途 |
|------|------|
| `generate.ts` | `gatewayGenerate()` — 包装 `runGenerate()` + 记录成本 |
| `pricing.ts` | `GatewayPricingRule` + 默认定价表 |
| `accounts.ts` | `GATEWAY_PROVIDER_REGISTRY` + env 配置状态检查 |
| `cost-recorder.ts` | `recordProviderCost()` — 写 ProviderCostLedger + ProviderAccount |
| `schema-errors.ts` | DB schema 缺失错误检测 |

---

## 4. Phase 2 新增内容（当前）

### 新增文件

| 文件 | 用途 |
|------|------|
| `lib/gateway/types.ts` | 统一类型：ProviderRequest / ProviderResponse / GatewayErrorCode / GatewayProviderAdapter |
| `lib/gateway/error-normalizer.ts` | `normalizeProviderError()` — 将任意 provider 错误映射到 GatewayErrorCode |
| `lib/gateway/adapter-registry.ts` | `GatewayAdapterRegistry` — Phase 3+ adapter 注册中心 |
| `lib/gateway/provider-gateway.ts` | `ProviderGateway` — skeleton dispatcher（Phase 2 无 billing/DB） |
| `lib/gateway/index.ts` | 统一 export barrel |

### 未改动的文件（Phase 2 严格只读）

- `apps/web/src/app/api/generate/**` — 所有 generate routes
- `apps/web/src/lib/providers/**` — 现有 adapter 和 registry
- `apps/web/src/lib/billing/**` — billing transaction 逻辑
- `apps/web/src/lib/credits/**` — credits 服务端逻辑
- `apps/cn-executor/**` — cn-executor 完全不动
- Prisma schema、env、package.json

### 命名说明

`GatewayProviderAdapter`（新）与 `ProviderAdapter`（`lib/providers/types.ts`，已有）是两个不同接口：

| 接口 | 位置 | 设计 |
|------|------|------|
| `ProviderAdapter` | `lib/providers/types.ts` | 按 nodeType 分方法（generateImage, generateVideo, ...）|
| `GatewayProviderAdapter` | `lib/gateway/types.ts` | 统一 `generate()` + 显式 capabilities 声明 |

Phase 4 包装 generate route 时，会将现有 `ProviderAdapter` 包装为 `GatewayProviderAdapter`，不替换现有实现。

---

## 5. 统一调用流程（Phase 4+ 目标）

```
POST /api/generate/image (or video, audio, text)
  │
  ├─ 1. Auth: validateUserSession()
  ├─ 2. Auth: verifyProjectOwnership(userId, projectId)
  ├─ 3. Billing: setupBilling() → reserve credits
  ├─ 4. Gateway: ProviderGateway.call(request)
  │    ├─ registry.get(providerId)
  │    ├─ capability check
  │    ├─ adapter.generate(request)
  │    │    ├─ [cn path] → cn-executor (Aliyun FC)
  │    │    └─ [global path] → Vercel Route Handler → provider API
  │    └─ normalizeProviderError() on failure
  ├─ 5. Asset: persistGeneratedMedia() → Aliyun OSS → Asset DB
  ├─ 6. Billing: finalizeBilling(success) → settle or release
  └─ 7. Cost: recordProviderCost() → ProviderCostLedger + ProviderAccount
```

---

## 6. 分阶段实施路线

### Phase 1 ✅ 只读审计（已完成）

只读扫描，报告 provider 现状和架构问题。

### Phase 2 ✅ Gateway Skeleton（当前）

新增 types / error-normalizer / adapter-registry / provider-gateway。
不改任何现有文件。

### Phase 3 — Text Agent Billing + 成本追踪

目标：接 `/api/agents/text` 的 `setupBilling()` / `finalizeBilling()`，使其扣 credits。

改动范围：
- `/api/agents/text/route.ts` — 接入 billing
- `lib/gateway/cost-ledger.ts`（可选） — 统一成本写入逻辑

不改：generate/image, generate/video, cn-executor

### Phase 4 — Image/Video Route → Gateway 包装

目标：generate/image 和 generate/video 内部换用 `ProviderGateway.call()`。

改动范围：
- `api/generate/image/route.ts` — 在调用 `runGenerate` 处替换为 `gateway.call()`
- `api/generate/video/route.ts` — 同上
- 保留原有 fallback 路径，通过 env flag 控制

不改：cn-executor、billing-middleware

### Phase 5 — Admin 成本监控 Dashboard

目标：admin 后台显示调用量、失败率、平台成本、毛利。

改动范围：
- `/admin/providers/costs` 新页面
- `/api/admin/providers/costs` route 接入 ProviderCostLedger 聚合

### Phase 6 — Kling / fal / Replicate Adapter 实现

注册真实 GatewayProviderAdapter 到 gatewayRegistry。

### Phase 7 — 桌面版 Tauri WebView Shell

独立 repo，WebView 加载 `https://creator.city`。
所有 provider API key 保持在 Vercel，桌面端永远拿不到。

---

## 7. 桌面版架构（为什么选 Tauri WebView）

| 方案 | API Key 安全 | 开发成本 | 推荐 |
|------|------------|--------|------|
| 打包 Next.js 本地运行 | ❌ key 在本地 | 低 | 不推荐 |
| **Tauri + WebView → 线上 app** | ✅ key 在 Vercel | **最低** | **推荐** |
| Electron + Web shell | ✅ key 在 server | 中 | 可选 |
| 真正本地离线版 | N/A | 极高 | 未来 |

Tauri V1 策略：
- WebView 加载 `https://creator.city`（生产域名）
- Native 文件系统访问：上传本地素材 + 下载生成结果
- 系统通知：生成完成推送
- 自动更新：Tauri updater
- Cookie 由 creator.city 管控，桌面端无法读取 HttpOnly session

---

## 8. cn-executor boundary（永久不动）

cn-executor（`apps/cn-executor/`）是独立的 Aliyun FC 服务，处理 CN provider 的异步生成任务。

Gateway 规则：
- CN provider → 继续通过 cn-executor 路由，Gateway 不介入 cn-executor 内部
- Global provider → Gateway 直接在 Vercel Route Handler 调用
- 绝不将海外 API key 传入 cn-executor
- 绝不将 CN provider 迁移到 global route

---

## 9. 错误码标准（GatewayErrorCode）

| 错误码 | 含义 | 可重试 |
|--------|------|-------|
| PROVIDER_NOT_CONFIGURED | env key 缺失或 provider 未注册 | 否 |
| PROVIDER_DISABLED | 管理员已停用 | 否 |
| PROVIDER_UNSUPPORTED_CAPABILITY | provider 不支持该 nodeType | 否 |
| PROVIDER_AUTH_FAILED | API key 无效（HTTP 401/403）| 否 |
| PROVIDER_RATE_LIMITED | 触发限流（HTTP 429）| 是 |
| PROVIDER_TIMEOUT | 网络超时（HTTP 408/504）| 是 |
| PROVIDER_BAD_REQUEST | 参数错误（HTTP 400/422）| 否 |
| PROVIDER_CONTENT_POLICY | 内容审核拒绝 | 否 |
| PROVIDER_INSUFFICIENT_CREDITS | 平台 credits 不足 | 否 |
| PROVIDER_BUDGET_EXCEEDED | 月度预算超限 | 否 |
| PROVIDER_TASK_FAILED | 异步任务失败 | 否 |
| PROVIDER_TASK_CANCELLED | 任务被取消 | 否 |
| PROVIDER_OUTPUT_INVALID | provider 返回无效输出 | 否 |
| ASSET_PERSIST_FAILED | 媒体文件持久化失败 | 是 |
| BILLING_RESERVE_FAILED | credits reserve 失败 | 否 |
| BILLING_SETTLE_FAILED | credits settle 失败 | 否 |
| BILLING_RELEASE_FAILED | credits release 失败（非致命）| 否 |
| UNKNOWN_PROVIDER_ERROR | 未归类错误 | 否 |
