# Creator City — Current Status

Last updated: 2026-06-01
Last valid commit: `733d29f`

---

## Completed & Validated Tasks

| Task | Status | Commit |
|---|---|---|
| P0 DB pool timeout / session / canvas save 503 | ✅ CLOSED | `3ec63b5` |
| Provider quota fallback + DeepSeek 友好提示 | ✅ CLOSED | `556f406` |
| 中国版默认 Provider 策略（DeepSeek 优先） | ✅ CLOSED | `d0ccb1c` |
| 资产库兜底找回最小版 | ✅ CLOSED | `a990b5b` |
| 中国版入口分流检查 + P1 Delivery hardcode 修复 | ✅ CLOSED | `ad5ae06` |
| User Provider Accounts Phase 2A/2B（schema + crypto） | ✅ CLOSED / foundation added | `778bb2d` |
| User Provider Accounts Phase 2C（CRUD API） | ✅ CLOSED / CRUD API added | `fa088d2` |
| User Provider Accounts Phase 2D（/account/providers 管理页） | ✅ CLOSED / UI shipped | `85c9622` |
| Account monetization navigation（充值降级 + 订阅与套餐入口） | ✅ CLOSED / validated | `5561a80` |
| Decentralized navigation（主导航加"我的 API"，去充值化叙事） | ✅ CLOSED / validated | `733d29f` |
| User Provider Accounts 生产前置（migration + secret 已验证） | ✅ CLOSED / production validated | — |

---

## P0 DB Pool Timeout — CLOSED

**Commit:** `3ec63b5`

- Node card no longer shows raw JSON error ✅
- Canvas save 503 backoff (10s) working ✅
- Cascade 503 (generation fail → immediate canvas PUT) resolved ✅
- Server logs identify stage (auth\_billing / provider / billing\_finalize / asset\_attach) ✅

---

## Provider Quota Fallback — CLOSED

**Commit:** `556f406`

- OpenAI quota error → friendly Chinese message, no code prefix ✅
- Image/video failure panel title shows "Provider 额度不足" (not raw code) ✅
- nextAction guides user to switch DeepSeek in node dialog ✅
- DB unavailable stays distinct ("数据库连接繁忙") ✅

---

## 中国版默认 Provider 策略 — CLOSED

**Commit:** `d0ccb1c`

- `TEXT_NODE_PROVIDER_OPTIONS` reordered: DeepSeek first, OpenAI last ✅
- `NODE_META.text.model` changed from `openai-text` → `deepseek-text` ✅
- `syncPromptPreset` for text uses `TEXT_NODE_PROVIDER_OPTIONS[0]` (was falling back to `anthropic-claude` via broken canvas provider registry lookup) ✅
- Existing nodes with saved `providerId` unaffected — user's choice preserved ✅
- Image/video already defaulted to CN providers (Volcengine); unchanged ✅

---

## 资产库兜底找回最小版 — CLOSED

**Commit:** `a990b5b`

### Acceptance results

| Check | Result |
|---|---|
| `asset_not_found_by_node` / `no_recovery_source` 不再在 UI 暴露 | ✅ |
| 失败面板标题显示中文友好名称（"素材未找回"等） | ✅ |
| 失败面板提供可点击 `/assets` 入口 | ✅ |
| 3 处技术性 `mediaFailureMessage` 改为用户友好文案 | ✅ |
| 正常生成、DeepSeek 默认、DB unavailable 文案不受影响 | ✅ |

### Asset 链路现状（已确认）

- 生成成功后素材保存在 `db.asset`（storageKey + url + providerJobId）✅
- `/assets` 页面 + `/api/assets` GET endpoint 已可用，无需新增 schema ✅
- `api/assets/resolve-by-node` 恢复链路完整 ✅

---

## 中国版入口分流检查 — CLOSED

**Commit:** `ad5ae06`

### 审计结论

核心生成链路（画布 → POST → 轮询 → 显示）完全使用相对路径，无跨域混用风险：

| 检查项 | 结论 |
|---|---|
| 主生成链路 API 路径 | ✅ 全部相对路径 `/api/...` |
| Media proxy URL 生成 | ✅ 相对路径，跟随当前入口域名 |
| Session / cookie 隔离 | ✅ 未设置显式 domain，自动绑定当前域名 |
| 中国版默认 DeepSeek | ✅ `NODE_META.text.model = 'deepseek-text'` 已生效 |
| OpenAI 在 region registry 标注 | ✅ `availability: 'future'`，不会默认出现 |

### P1 修复

- **问题：** `ProjectDeliveryClient.tsx` 中 `CUSTOMER_DELIVERY_ORIGIN` 硬编码为 `https://creator-city-vert.vercel.app`，CN 用户生成的客户交付分享链接会指向 Vercel 域名
- **修复：** 改为 `process.env.NEXT_PUBLIC_APP_URL ?? 'https://creator-city-vert.vercel.app'`
- **文件：** `apps/web/src/app/projects/[id]/delivery/ProjectDeliveryClient.tsx`
- **效果：** CN 部署配置 `NEXT_PUBLIC_APP_URL` 后，交付分享链接自动使用 CN 域名；未配置时保持原 Vercel URL 兜底

### 剩余 P2（需单独排期，不在本次处理）

- `NEXT_PUBLIC_API_URL` 默认指向 `http://localhost:4000`（legacy NestJS）— billing webhook（`settleCredits / refundCredits / fulfillOrder`）在 CN 部署未配置此变量时会打向 localhost 导致失败
- 影响范围：支付宝/微信支付回调 + admin billing 路由，不影响核心画布生成链路
- 处理前提：需要确认 CN 部署是否使用支付链路

---

## User Provider Accounts Phase 2A/2B — CLOSED / foundation added

**Commit:** `778bb2d`

### 已完成内容

| 项目 | 状态 |
|---|---|
| Prisma schema: `UserProviderAccount` 表（14 字段） | ✅ |
| Migration: `20260601000000_user_provider_account` | ✅ |
| Crypto helper: `apps/web/src/lib/provider-accounts/crypto.ts` | ✅ |
| 加密格式: `base64(iv):base64(authTag):base64(ciphertext)`（AES-256-GCM） | ✅ |
| 17 单元测试（node:test）：全部通过 | ✅ |
| type-check / lint / build：全部通过 | ✅ |

### Schema 字段摘要

- `userId` FK → `User.id` (CASCADE)
- `providerId` — 如 `deepseek-text` / `openai-text`
- `encryptedApiKey` — AES-256-GCM 密文，服务端仅内存解密，不返回前端
- `keyLast4` — 原始 key 末 4 位，用于 UI 展示
- `status` — `active` / `disabled` / `invalid`
- `isDefault` — 该 provider 的默认账户（业务逻辑保证唯一性）
- `projectScope` — null = 全局；projectId = 仅限项目
- `lastTestedAt` / `lastTestStatus` / `lastTestError` — 测试连接预留字段
- Indexes: `[userId]`、`[userId, providerId]`、`[userId, status]`

### 当前状态（重要）

- **仅 schema + encryption helper，不可用于真实生成**
- `crypto.ts` 已被 Phase 2C service 层 import，但不影响生成链路
- 管理页 / 测试连接 / 生成链路接入均未实现（见 Phase 2C 节）

### 生产注意事项

Migration `20260601000000_user_provider_account` 已提交到 git，但**进入 Phase 2C（CRUD API）前必须确认 Supabase production migration 已应用**，否则 CRUD 路由会报表不存在错误。应用方式：`pnpm --filter server prisma:migrate deploy`（或通过 Supabase Dashboard 手动执行 migration.sql）。

`PROVIDER_KEY_ENCRYPTION_SECRET` 须在生产环境提前配置（base64 编码的 32 字节随机值），否则 CRUD 路由启动时会抛出服务端配置错误（不影响现有功能）。

### 未完成部分（下一阶段）

- **Phase 2C**：`/api/provider-accounts` CRUD — ✅ 已在 commit `fa088d2` 完成
- **Phase 2D**：`/account/providers` 管理页（添加 Key、查看状态、删除）
- **Phase 3**：`POST /api/provider-accounts/:id/test` 测试连接
- **Phase 4**：先只接 text 生成链路试点（`apiKeyOverride` + `billingMode`）

### 安全边界确认

- 未修改 `/api/generate/*`（text / image / video）
- 未修改 `VisualCanvasWorkspace.tsx` / `CanvasNodeCard.tsx`
- 未修改 `billing/` / `credits/` / `reserve` / `finalize` / `refund`
- 未修改 provider adapter 真实调用逻辑
- 未修改 payment / Stripe / 支付宝 / 微信
- 未修改 `apps/cn-executor`
- 未改 billingMode 语义 / credits 计费

---

## User Provider Accounts Phase 2C — CLOSED / CRUD API added

**Commit:** `fa088d2`

### 已完成内容

| 项目 | 状态 |
|---|---|
| `GET /api/provider-accounts` — 列出当前用户账户（无 encryptedApiKey） | ✅ |
| `POST /api/provider-accounts` — 创建账户，Key 立即 AES-256-GCM 加密 | ✅ |
| `PATCH /api/provider-accounts/:id` — 更新 label / status / isDefault / projectScope | ✅ |
| `DELETE /api/provider-accounts/:id` — 硬删除，encrypted key 永久消失 | ✅ |
| Service 层：`apps/web/src/lib/provider-accounts/service.ts` | ✅ |
| 响应白名单：永不返回 `encryptedApiKey` 或原始 `apiKey` | ✅ |
| isDefault 冲突：同 provider 其他账户自动取消默认 | ✅ |
| 用户隔离：所有查询带 `userId` 约束，越权访问返回 404 | ✅ |
| env 缺失：`PROVIDER_KEY_ENCRYPTION_SECRET` 未配置时返回安全 503 | ✅ |
| type-check / lint / build：全部通过 | ✅ |

### API 字段说明

**POST 请求体：** `providerId`（必填）、`apiKey`（必填，≥8 字符）、`accountLabel`（必填）、`isDefault?`、`projectScope?`

**PATCH 请求体（白名单）：** `accountLabel?`、`status?`（active / disabled / invalid）、`isDefault?`、`projectScope?`；其余字段（含 `apiKey`）静默忽略

**所有响应 summary 字段：** `id` / `providerId` / `accountLabel` / `keyLast4` / `status` / `isDefault` / `projectScope` / `lastTestedAt` / `lastTestStatus` / `lastTestError` / `createdAt` / `updatedAt`

### 当前状态（重要）

- **CRUD API 可正常使用，但还不可用于真实生成**
- 生成路由（text / image / video）尚未接入 `apiKeyOverride` / `billingMode`
- `/account/providers` 前端管理页尚未实现

### 生产前置条件（上线前必做）

1. 应用 migration：`pnpm --filter server prisma:migrate deploy`（migration: `20260601000000_user_provider_account`）
2. Vercel / CN 部署配置环境变量：`PROVIDER_KEY_ENCRYPTION_SECRET=<base64 of 32 random bytes>`
3. 未配置 secret 时，POST 创建 provider account 会安全返回 503（预期行为，不影响现有生成链路）

### 未完成部分（下一阶段）

- **Phase 2D**：✅ `/account/providers` 管理页 — 已在 commit `85c9622` 完成
- **Phase 3**：`POST /api/provider-accounts/:id/test` 测试连接
- **Phase 4**：先只接 text 生成链路试点（`apiKeyOverride` + `billingMode`）

### 安全边界确认

- 未修改 `/api/generate/*`（text / image / video）
- 未修改 `VisualCanvasWorkspace.tsx` / `CanvasNodeCard.tsx`
- 未修改 `billing/` / `credits/` / `reserve` / `finalize` / `refund`
- 未修改 provider adapter 真实调用逻辑
- 未修改 payment / Stripe / 支付宝 / 微信
- 未修改 `apps/cn-executor`
- 未接入真实生成链路

---

## User Provider Accounts Phase 2D — CLOSED / UI shipped

**Commits:** `b7182ce` (nav surface) → `85c9622` (管理页)

### 已完成内容

| 项目 | 状态 |
|---|---|
| `/account/providers` 管理页（列出账户、添加 Key、设为默认、启停、删除） | ✅ |
| 账单模式对比卡（平台额度 vs 我的 API 账户） | ✅ |
| 阶段提示：明确 Key 仅存储，未接入生成链路 | ✅ |
| 前端永不显示完整 apiKey / encryptedApiKey | ✅ |
| 用户头像 hover 下拉菜单加入 Provider API 账户入口 | ✅ |
| `/account` 快速入口卡片加入 Provider API 账户 | ✅ |
| type-check / lint / build：全部通过 | ✅ |

### 当前状态

- CRUD API 可正常使用，管理页已上线
- **Key 仅加密存储，未用于生成调用**
- 生成路由（text / image / video）尚未接入 `apiKeyOverride` / `billingMode`
- ✅ Supabase production migration `20260601000000_user_provider_account` 已应用
- ✅ `PROVIDER_KEY_ENCRYPTION_SECRET` 已在 Vercel 配置
- ✅ `GET /api/provider-accounts` 线上正常（不再显示"获取账户列表失败"）

---

## Account Monetization Navigation — CLOSED / validated

**Commits:** `5561a80` → `733d29f`

### 已完成内容

| 项目 | 状态 |
|---|---|
| 移除顶部导航 amber "充值" 独立按钮 | ✅ |
| "积分与充值" href 统一改为 `/account/credits` | ✅ |
| `/account` 快速入口扩展为 3 列：平台额度 / 我的 API 账户 / 订阅与套餐 | ✅ |
| 用户头像菜单加入"订阅与套餐（即将开放）"灰色入口 | ✅ |
| `/account/providers` 账单模式卡文案：平台额度 / 未来平台服务费说明 | ✅ |
| ⌘K 搜索加入"订阅与套餐"条目 | ✅ |
| 主导航加入"我的 API"组（API 账户管理 + 平台模型中心） | ✅ |
| ⌘K 搜索"Provider API 账户"更名为"API 账户管理"，分组改为"我的 API" | ✅ |

### 当前导航状态

**主导航（从左到右）：** 创作 · 市场 · 工作台 · 我的 API · 平台 · 社区与帮助

- **我的 API** hover 展开：API 账户管理（→ `/account/providers`）、平台模型中心（→ `/providers`）
- 主导航不再出现充值/积分相关按钮

**用户头像下拉菜单：**
- ⚙ 账号设置 → `/account`
- ⚡ Provider API 账户 → `/account/providers`（紫色高亮）
- ◎ 积分与充值 → `/account/credits`
- ★ 订阅与套餐（即将开放，灰色不可点）
- ↩ 登出

### 商业叙事转向

| 维度 | 旧叙事 | 新叙事 |
|---|---|---|
| 核心商业动作 | 充值积分，平台代付 API | 双轨：平台额度 OR 接入自己的 API Key |
| Provider 费用 | 平台统一代付 | 用户直接支付给 Provider，不经过平台 |
| 平台收入来源 | API 转售差价 | 未来：平台服务费 / 订阅 / 协作 / 交易服务费 |
| 主导航叙事 | 充值（核心按钮） | 我的 API（去中心化能力） |
| 充值入口 | 主导航 + 用户菜单 | 仅用户菜单（积分与充值） |

### 安全边界确认

- 未修改 `/api/generate/*` / billing / credits / payment / schema / cn-executor
- 仅修改：`TopNavigation.tsx`、`account/page.tsx`、`account/providers/page.tsx`

---

## User Provider Accounts Production Setup — CLOSED / validated

### 已完成内容

| 项目 | 状态 |
|---|---|
| Supabase production migration `20260601000000_user_provider_account` 已执行 | ✅ |
| `UserProviderAccount` 表已成功创建（Supabase SQL Editor 显示 Success） | ✅ |
| `PROVIDER_KEY_ENCRYPTION_SECRET` 已在 Vercel 环境变量配置（32 bytes base64） | ✅ |
| `GET /api/provider-accounts` 线上恢复正常 | ✅ |
| `/account/providers` 页面不再显示"获取账户列表失败" | ✅ |

### 当前状态

- **Provider account 管理基础链路已在生产可用：列出 / 添加 / 设默认 / 启停 / 删除**
- Key 加密存储后仍**未用于真实生成调用**
- 生成路由（text / image / video）尚未接入 `apiKeyOverride` / `billingMode`

### 未完成部分

- **Phase 3**：`POST /api/provider-accounts/:id/test` 测试连接
- **Phase 4**：先只接 text 生成链路试点（`apiKeyOverride` + `billingMode`）
- 团队共享 API 账户（多用户共享同一 Key）
- 平台服务费 / 订阅逻辑

---

## Current Remaining Issues

**无 P0 / P1 问题。当前系统处于稳定状态。**

P2（非紧急）：`NEXT_PUBLIC_API_URL` / billing webhook / legacy NestJS localhost:4000 需单独排期。

---

## Next Phase Tasks (priority order)

1. **User Provider Accounts Phase 3（下一优先）**
   - `POST /api/provider-accounts/:id/test` — 测试连接，验证 API Key 是否有效
   - 生产 migration + secret 已就绪，前置条件满足

2. **User Provider Accounts Phase 4（Phase 3 完成后）**
   - text 生成节点试点接入 `apiKeyOverride` + `billingMode`
   - 禁止在 Phase 3 完成前推进本阶段

3. **新手创作路径**
   - 第一次进入画布的用户引导（如何创建节点、如何生成）
   - 空状态优化：空画布有明确的开始按钮/提示

4. **错误提示产品化**
   - 统一剩余错误提示的语气和格式
   - 去除所有 `errorCode:`/`provider_*:` 前缀（已处理 quota、asset 相关；其余 OSS/media 类还有残留）

5. **NEXT_PUBLIC_API_URL / billing webhook（P2，单独排期）**
   - 确认 CN 部署是否启用支付链路
   - 如启用：配置 `NEXT_PUBLIC_API_URL` 或将 billing webhook 改为直接 DB 调用

---

## Forbidden Areas (do not touch)

- `apps/cn-executor` — China executor, separate deploy
- `/api/generate/image`, `/api/generate/video` — generation routes
- `apps/web/src/lib/billing/` — billing, reserve, settle logic
- `apps/web/src/lib/credits/` — credit deduction
- Payment / Stripe / Alipay / WeChat
- Prisma schema / migrations
- `package.json` / `pnpm-lock.yaml`
- `.env` files
- Provider adapter real call logic
- Adding new providers
- Changing `providerId` / `modelId` / credit amounts

---

## Stable Baseline (do not regress)

Modules confirmed working as of `ad5ae06`:

- Canvas node CRUD (add / edit / delete / drag / connect)
- Image generation chain (prompt → POST → poll → display)
- Video generation chain (prompt → POST → poll → display)
- Text generation chain (DeepSeek default, Kimi, OpenAI fallback)
- Canvas save / load (PUT/GET with localStorage draft fallback)
- Canvas save 503 backoff (10s, no cascade)
- Media proxy (`/api/media/proxy`) for cross-region OSS display
- Session auth (Supabase + Prisma, with pgBouncer pool guard)
- Provider quota error → friendly Chinese message + DeepSeek CTA
- Asset failure panel → friendly titles + `/assets` recovery link
- DeepSeek as default text provider for new nodes
- `/assets` page listing all generated assets with recovery status
- Customer delivery share URL follows `NEXT_PUBLIC_APP_URL` (CN-safe)
