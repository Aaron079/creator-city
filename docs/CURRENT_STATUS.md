# Creator City — Current Status

Last updated: 2026-06-05
Last valid commit: `5b07162` (service credits pricing preview + AI billing help knowledge)
Production validated: 2026-06-05 (User Usage History browser validated · Provider Account Center auth blank screen fix validated · Seedance Video BYOK security review completed · Provider API Key Guide browser validated · Provider Account Usage Summary browser validated · Provider Account Detail / Health Status browser validated · Subpage Navigation Polish browser validated · Provider Account Center UX Polish Batch validated · Account / Billing / BYOK Messaging validated · Provider Account Health Guidance validated · Seedance Video BYOK Safe Logging / Feature Flag Skeleton validated · Platform Service Fee Strategy Audit read-only completed · Pricing / Service Credits Static Preview validated · AI Help Billing Knowledge Sync validated · Service Credits Data Model Audit read-only completed)

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
| User Provider Accounts Phase 3（测试连接） | ✅ CLOSED / test connection shipped | `6890501` |
| P0 Auth/Session 持久化修复（transient DB error 不再登出） | ✅ CLOSED / validated | `dfcd10c` |
| User Provider Accounts Phase 4（Text BYOK 试点） | ✅ CLOSED / Text BYOK validated | `ea2ccc6` |
| Provider UX 修复（API Key 文案误解 + 跳转登录 bug） | ✅ CLOSED / validated | `8d96d09` |
| 画布帮助面板（Provider API Key 接入手册） | ✅ CLOSED / shipped | `def152b` |
| AI Agent 接入 Provider API Key 指南 | ✅ CLOSED / shipped | `d8ddd43` |
| Image/Video BYOK 多字段凭证方案审计（只读） | ✅ CLOSED / read-only audit completed | — |
| User Provider Accounts V1（多字段凭证结构扩展） | ✅ CLOSED / production validated | `14a763d` |
| User Provider Accounts V2 — Seedream Image BYOK | ✅ CLOSED / validated | `c6ff87f` |
| BYOK UsageLog Phase S1（平台用量记录，不扣费） | ✅ CLOSED / production validated | `d693f71` |
| Admin Usage Dashboard（/admin/usage，生成用量观察） | ✅ CLOSED / validated | `fbf7734` |
| Provider Account Center 产品化升级（模型账户中心） | ✅ CLOSED / validated | `e96f916` |
| Provider Account Center auth blank screen fix | ✅ CLOSED / validated | `4710e79` |
| User Usage History（/account/usage，用户端用量历史） | ✅ CLOSED / validated | `8119eb0` |
| Seedance Video BYOK 安全评审（cn-executor credential plan，只读） | ✅ CLOSED / read-only audit completed | — |
| Provider API Key Guide（/help/api-keys，接入教程页） | ✅ CLOSED / validated | `35185b4` |
| Provider Account Usage Summary（账户卡片近 90 天用量汇总） | ✅ CLOSED / validated | `5c4b6e6` |
| Provider Account Detail / Health Status（账户详情页 + 用量 + 健康状态） | ✅ CLOSED / validated | `60aaa95` |
| Subpage Navigation Polish（子页面返回入口审计 + 无效 Workspace 按钮清理） | ✅ CLOSED / validated | `5cb46a8` |
| Provider Account Center UX Polish Batch（文案 + 入口 + 空状态 + 错误提示全面 polish） | ✅ CLOSED / validated | `0f4eee8` |
| Account / Billing / BYOK Messaging（账号/积分/BYOK 费用模式说明统一） | ✅ CLOSED / validated | `4347465` |
| Provider Account Health Guidance（账户健康建议/错误修复引导） | ✅ CLOSED / validated | `4bac934` |
| Seedance Video BYOK 安全日志脱敏 / Feature Flag Skeleton | ✅ CLOSED / validated | `3c2bab6` |
| Platform Service Fee Strategy Audit（平台服务费策略只读审计） | ✅ CLOSED / read-only audit completed | — |
| Pricing / Service Credits Static Preview（价格/服务费静态说明页） | ✅ CLOSED / validated | `5b07162` |
| AI Help Billing Knowledge Sync（AI 帮助费用知识同步） | ✅ CLOSED / validated | `5b07162` |
| Service Credits Data Model Audit（服务积分数据模型只读审计） | ✅ CLOSED / read-only audit completed | — |

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

## User Provider Accounts Phase 3 — CLOSED / test connection shipped

**Commit:** `6890501`

### 已完成内容

| 项目 | 状态 |
|---|---|
| `POST /api/provider-accounts/:id/test` — 测试连接端点 | ✅ |
| 解密 Key 内存中调用 Provider `/models` 端点验证有效性 | ✅ |
| 测试结果写回 DB：`lastTestedAt` / `lastTestStatus` / `lastTestError` | ✅ |
| `auth_failed` 时自动将账户状态改为 `invalid` | ✅ |
| `/account/providers` UI 加入「测试连接」按钮 | ✅ |
| 用户隔离：只能测试自己的账户 | ✅ |
| API Key / 错误信息全程脱敏，不返回明文 Key | ✅ |

### TestStatus 类型

`ok` / `auth_failed` / `timeout` / `rate_limited` / `insufficient_quota` / `unsupported` / `error`

---

## P0 Auth/Session 持久化修复 — CLOSED / validated

**Commit:** `dfcd10c`

### 问题

`/api/auth/me` 在 DB 短暂不可用时返回 `authenticated: false`，`AuthProvider` 误判为真正未登录并调用 `logout()`，清空 zustand 状态，导致刷新后强制登出。

### 修复内容

| 项目 | 状态 |
|---|---|
| `MeResponse` 新增 `errorCode?` 字段，DB 不可用时返回 error code 而非裸 false | ✅ |
| `AuthProvider.tsx`：有 `errorCode` 时跳过 `logout()`，保留当前 session 状态 | ✅ |
| `use-current-user.ts`：有 `errorCode` 时返回 `status: 'unknown'`，而非 `unauthenticated` | ✅ |
| 各页面（TopNavigation / projects/[id] / dashboard / overview）使用 `effectiveIsAuthenticated`，把 `unknown` 等同于 `loading` 处理 | ✅ |

### 效果

DB 短暂不可用 → 用户保持登录状态，页面正常显示；真正未登录 → 仍然跳转登录。

---

## User Provider Accounts Phase 4 — CLOSED / Text BYOK validated

**Commits:** `ea2ccc6`（BYOK 生成）→ `8d96d09`（UX 修复）

### 已验收能力

| 验收项 | 状态 |
|---|---|
| 用户可在 `/account/providers` 添加自己的 Provider API Key | ✅ |
| 可测试连接，验证 Key 有效性 | ✅ |
| Text 节点对话框中可选择「我的 API 账户」计费模式 | ✅ |
| 选择指定账户后点击生成，走用户自己的 API Key 调用 | ✅ |
| BYOK Text 路径不扣平台模型 credits | ✅ |
| 平台额度模式保持原逻辑不变 | ✅ |
| Image / Video 未接入 BYOK，仍走平台侧 | ✅ |
| API Key 文案误解修复：明确 API Key ≠ 网页登录邮箱/密码 | ✅ |
| `/account/providers` zustand hydration race 修复：不再误跳到登录页 | ✅ |
| type-check / lint / build 全部通过 | ✅ |

### 当前 BYOK 支持范围

| Provider | 当前状态 |
|---|---|
| DeepSeek（deepseek-text / deepseek-reasoner） | ✅ 文本试点支持 |
| OpenAI（openai-text） | ✅ 文本试点支持 |
| Kimi（kimi-text / kimi-multimodal） | ✅ 文本试点支持 |
| Image / Video 所有 Provider | ❌ 暂未接入 BYOK |

### 实现方式（关键文件）

- `apps/web/src/app/api/generate/text/route.ts` — 新增 `billingMode: 'user_provider_account'` 早返回分支，完整绕过平台 billing
- `apps/web/src/lib/providers/china/deepseek.ts` / `kimi.ts` — 新增 `apiKeyOverride` 参数
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — 账户选择 UI + 延迟加载账户列表
- `apps/web/src/app/account/providers/page.tsx` — API Key 文案明确化 + hydration race 修复

### 安全边界确认

- `encryptedApiKey` 永不返回前端，解密只在服务端内存进行
- `apiKeyOverride` 参数不扩展到 image/video 生成路由
- 不改 Prisma schema / migration / payment / cn-executor
- setupBilling / finalizeBilling 完全跳过（不扣 credits，不触发扣费链路）

### 当前未完成（后续阶段）

- Image / Video BYOK
- Seedance / 火山 Access Key + Secret Key 多字段凭证支持
- BYOK 模式下平台服务费记录（平台服务费 ≠ provider API 费用）
- 团队共享 API account（多用户共用同一 Key）
- 独立 API Key 帮助页 `/help/api-keys`

---

## Provider API Key 帮助内容 — CLOSED / shipped

**Commits:** `def152b`（画布帮助面板）→ `d8ddd43`（AI Agent 指南）

### 已完成内容

| 项目 | 状态 |
|---|---|
| 画布右下角帮助面板升级为 4 标签（新手 / API Key / Provider / 排查） | ✅ |
| 18 个 Provider 接入指南（DeepSeek~OpenRouter），含状态标注 | ✅ |
| 明确 API Key ≠ 网页登录密码；普通用户不需要 API Key | ✅ |
| Creator City 不是 API 转售平台；Provider 费用由用户直付服务商 | ✅ |
| 浮动 AI Agent 新增「我的 API」和「API Key 指南」快捷动作 | ✅ |
| AI Agent 本地模式新增关键词匹配：DeepSeek/OpenAI/Kimi/Gemini/Claude/通用 API Key/BYOK/认证失败排查 | ✅ |
| 无真实 AI 调用，无新增 API 路由，无生成链路改动 | ✅ |

---

## Image/Video BYOK 多字段凭证方案审计 — CLOSED / read-only audit completed

**审计日期：** 2026-06-02  
**审计性质：** 只读 — 零文件修改，零 commit，零 push

### 当前真实状态

| 能力 | 状态 |
|---|---|
| Text BYOK（DeepSeek / OpenAI / Kimi） | ✅ 已验收 |
| Image BYOK（Seedream / 其他图片 Provider） | ❌ 未实现 |
| Video BYOK（Seedance / 其他视频 Provider） | ❌ 未实现 |
| 多字段凭证存储（encryptedFields） | ❌ 未实现 |

### 核心审计结论

1. **Volcengine Ark API 使用 Bearer Token 格式，不是传统 HMAC AK/SK 签名。**  
   Seedream（图片）和 Seedance（视频）都用同一个 `VOLCENGINE_ARK_API_KEY`（Bearer），调用 OpenAI-compatible endpoint。这意味着 Volcengine BYOK 不需要实现 HMAC 签名逻辑，比预想简单。

2. **Volcengine BYOK 预计需要两个字段：**  
   - `apiKey`（Bearer Token，来自火山方舟控制台 API Key）  
   - `endpointId`（对应 VOLCENGINE_SEEDREAM_MODEL / VOLCENGINE_SEEDANCE_MODEL，每个用户的方舟账号不同）

3. **当前 `UserProviderAccount.encryptedApiKey` 单字段不足以支持需要 Endpoint ID 的 Provider。**  
   需扩展 schema 支持多字段加密存储。

4. **推荐 schema 扩展方向（方案 A，JSON 扩展，非破坏性）：**  
   - `encryptedFields: Json?` — 存储额外加密字段（`{ fieldName: encryptedValue, ... }`）  
   - `fieldMeta: Json?` — 存储额外字段的 UI 元数据（`{ fieldName: { label, last4, updatedAt } }`）  
   无需新表，零破坏性 migration，字段数 ≤3 时足够用。

5. **Seedream Image BYOK 应优先于 Seedance Video BYOK。**  
   Seedream 走 Vercel-side 触发（cn-executor 只是异步执行器），BYOK 路径可控。

6. **Seedance Video BYOK 涉及 cn-executor 安全边界扩张，必须单独排期评审。**  
   cn-executor 当前只读取自身 env var。要支持用户凭证，cn-executor 必须能按需从 DB 解密，意味着 cn-executor 需要 `PROVIDER_KEY_ENCRYPTION_SECRET` 和 Supabase 连接权限，安全边界扩张，不可在图片 BYOK 内顺手做。

7. **OSS 与 BYOK 无关。** `ALIYUN_OSS_ACCESS_KEY_ID` / `ALIYUN_OSS_ACCESS_KEY_SECRET` 是平台存储账号，不属于用户 BYOK 范畴，不动。

### 安全约束（实现时必须全部满足）

- `encryptedApiKey` 和 `encryptedFields` 中的值永远不返回给前端
- 解密只在服务端实际调用 provider 前一刻进行，不 log，不缓存
- 错误信息必须脱敏：不返回 Authorization header、原始 key、request body
- 只能操作自己的 account（`account.userId === currentUser.id`）
- 加密算法与现有 text BYOK 一致（AES-256-GCM，`encryptProviderApiKey` / `decryptProviderApiKey`）

### 推荐分阶段实现顺序

| 阶段 | 内容 | 范围约束 |
|---|---|---|
| **Phase V1** | 多字段凭证结构扩展 | 只改 schema / service / UI，不接生成链路，不动 cn-executor |
| **Phase V2** | Seedream Image BYOK 试点 | 只接图片，不碰视频，不动 cn-executor |
| **Phase V3** | Seedance Video BYOK 安全方案评审与试点 | 单独评审 cn-executor 解密/透传方案，评审通过后再实现 |
| **Phase V4** | 其他单 API Key 图片/视频 Provider BYOK | 在 V2 链路验证后复用 |
| **Phase V5** | BYOK 平台服务费记录 / usage logging | 不触及 billing 语义，仅记录 |
| **Phase V6** | 团队共享凭证（多用户共用同一 Key） | 独立评审 |

---

## 当前商业方向（已明确）

Creator City **不是中心化 API 转售平台**。商业模型为：

| 模式 | 说明 |
|---|---|
| 平台额度（过渡期） | 用户购买积分，平台代付 Provider API 费用 |
| 我的 API（去中心化） | 用户自带 API Key，费用直付给 Provider，Creator City 不代扣 |
| 平台服务费（未来主要收入） | 工作台 / 协作工具 / 交易撮合 / 订阅，不含 API 转售差价 |

**当前状态：** Creator City 已形成"平台额度 + 我的 API 账户 + 用量记录 + 用户端/管理员端可视化 + API Key 教程 + 单账户用量汇总 + 账户详情/健康状态 + 子页面返回体验 + 账户管理 UX 全面 polish + 账号/积分/BYOK 费用模式说明统一 + 账户健康建议/错误修复引导 + cn-executor 日志脱敏 + 视频 BYOK feature flag skeleton + 平台服务费策略只读审计 + 价格/服务费静态说明页面 + AI 帮助费用知识同步 + 服务积分数据模型只读审计"的 BYOK 完整闭环。Provider Account Center 已从 API 账户列表升级为更完整的用户可理解账户管理体验：用户能接入、理解、查看用量、查看详情、看健康状态、看明确修复建议、找到教程，并能从菜单/搜索快速进入关键页面。账户健康状态不仅展示状态，还能指导用户修复 API Key、额度、账单、接入点、最近失败等问题，用户可以从错误状态直接理解下一步动作，而不是只看到失败。/account 页面已在快捷入口下方统一展示三种费用模式说明；/account/credits 页面已明确区分平台 credits 与 Provider 直付费用，防止用户误解。当前不赚 API 差价，不启用平台服务费扣费。Seedance Video BYOK 实施仍暂缓。服务积分数据模型已只读审计：推荐 Option B（独立 ServiceCreditWallet + ServiceCreditLedger），不推荐 Option A/C/D/E；9 项 no-go 条件全部未满足；当前继续观察 BYOK 用量 30-60 天，不做 schema migration，不做 service fee 扣费。

**当前能力矩阵（production 已验收）：**

| 能力 | 状态 |
|---|---|
| Text BYOK（DeepSeek / OpenAI / Kimi） | ✅ validated |
| Seedream Image BYOK | ✅ validated |
| 多字段凭证存储（encryptedFields / fieldMeta） | ✅ production validated |
| UsageLog Phase S1（用量记录，不扣费） | ✅ production validated |
| Admin BYOK Usage Dashboard（`/admin/usage`） | ✅ validated |
| Provider Account Center（模型账户中心 UI） | ✅ validated |
| Provider Account Center auth guard（白屏修复） | ✅ validated |
| User Usage History（`/account/usage`） | ✅ validated |
| Provider API Key Guide（`/help/api-keys`） | ✅ validated |
| Provider Account Usage Summary（账户卡片近 90 天用量） | ✅ validated |
| Provider Account Detail / Health Status（账户详情页） | ✅ validated |
| Subpage Navigation Polish（全站子页面返回入口 + 无效按钮清理） | ✅ validated |
| Provider Account Center UX Polish（文案中文化 + 入口补齐 + 空状态 + 错误提示） | ✅ validated |
| Account / Billing / BYOK Messaging（账号/积分/BYOK 三种费用模式说明统一） | ✅ validated |
| Provider Account Health Guidance（账户健康建议/错误修复引导） | ✅ validated |
| Seedance Video BYOK 安全评审 | ✅ read-only audit completed |
| Seedance Video BYOK Safe Logging / Feature Flag Skeleton | ✅ validated |
| Seedance Video BYOK | ❌ not implemented（feature flag 默认关闭；安全基础已就绪；推荐方案 Option A；暂缓实施） |
| Platform Service Fee Strategy Audit | ✅ read-only audit completed（结论：当前不启用；继续观察 BYOK 用量 30-60 天） |
| Pricing / Service Credits Static Preview（`/pricing-preview` 费用说明页） | ✅ validated（当前费用模式 / Service Credits 草案（未启用）/ 费用 FAQ 全部展示；明确不收费；搜索可达；`5b07162`） |
| AI Help Billing Knowledge Sync（平台 AI 帮助费用知识） | ✅ validated（本地 AI 可回答 7 类费用问题：平台服务费 / 我的API扣费 / 充值≠Provider / 谁收费 / 何时启用 / 失败退款 / 普通用户需要Key；`5b07162`） |
| Command Palette 费用页面搜索词 | ✅ validated（pricing-preview / help-api-keys / my-api / help 已加入搜索索引，含 30+ 中英文关键词） |
| Platform service fee charging | ❌ not implemented（UsageLog.platformServiceFeeCredits 固定为 0；不扣 service credits；UI 显示"未启用"） |
| Service credits wallet | ❌ not implemented（无独立 service credits 余额；当前只有平台额度 wallet） |
| Subscription billing | ❌ not implemented（无 Subscription 数据模型；/pricing-preview 仅静态草案） |
| Service Credits Data Model Audit（服务积分数据模型只读审计） | ✅ read-only audit completed（推荐 Option B：独立 ServiceCreditWallet + ServiceCreditLedger；9 项 no-go 条件；迁移阶段 M0-M6；当前继续观察 30-60 天） |

**下一步商业优先级（2026-06）：** 平台服务费策略只读审计已完成（结论：**当前不启用**）。价格/服务费静态说明页面已上线（`/pricing-preview`），AI 帮助已能回答费用相关问题。Service Credits 数据模型只读审计已完成（结论：**推荐 Option B 独立 wallet，9 项 no-go 条件全部未满足，继续观察**）。UsageLog.platformServiceFeeCredits 固定为 0，所有 UI 显示"未启用"。下一步：继续观察 BYOK 用量 30–60 天，无需立即动作。如需推进商业化：先实施 Admin 模拟服务积分视图（只读，不扣费）→ 再评估 Phase M1（新表，不写数据）→ Phase M2（懒创建 wallet）→ Phase M5（feature flag 内测）。暂不做 schema migration，暂不启用服务费扣费，暂不启动 Seedance Video BYOK 实施。

---

## Current Remaining Issues

**无 P0 / P1 问题。当前系统处于稳定状态。**

P2（非紧急）：`NEXT_PUBLIC_API_URL` / billing webhook / legacy NestJS localhost:4000 需单独排期。

---

## User Provider Accounts V1 多字段凭证 — CLOSED / production validated

**Commits:** `14a763d` (feat) · `da0ab3b` (docs)
**Production migration:** `20260602000000_user_provider_account_multi_field` — 已在 Supabase production 执行

### 新增字段（`UserProviderAccount`）
| 字段 | 类型 | 说明 |
|---|---|---|
| `credentialType` | `TEXT` nullable | `"single_api_key"` / `"bearer_with_endpoint"` |
| `encryptedFields` | `JSONB` nullable | 额外加密字段，每字段独立 AES-256-GCM IV。**绝不返回给前端** |
| `fieldMeta` | `JSONB` nullable | 展示用元数据 `{ fieldName: { label, last4, updatedAt } }`，可安全返回 |

### 验证项目
| 验证项 | 结果 |
|---|---|
| `ACCOUNT_SELECT` 不含 `encryptedFields` | ✅ 确认 |
| API 路由响应不返回 `encryptedFields` | ✅ 确认 |
| `encryptedFields` 仅在 `buildEncryptedFieldsAndMeta` 内存中存在，写入 DB 后不再暴露 | ✅ 确认 |
| migration SQL 使用 `IF NOT EXISTS`，幂等安全 | ✅ 确认 |
| Volcengine Seedream / Seedance 凭证表单含 Endpoint ID 输入 | ✅ 确认 |
| Image / Video BYOK 标记为 `coming_soon`，无生成入口 | ✅ 确认 |
| `/api/generate/image` 和 `/api/generate/video` 未被 V1 修改 | ✅ 确认（git diff 干净） |
| cn-executor 未被 V1 修改 | ✅ 确认 |
| Text BYOK 生成链路未受影响 | ✅ 确认（`ACCOUNT_SELECT` 仅加字段，未删字段） |
| crypto 单元测试 28/28 pass | ✅ 确认 |
| TypeScript type-check 零错误 | ✅ 确认 |
| `next build` 成功 | ✅ 确认 |

### 当前能力（production）
- Text BYOK：已上线并验收（Phase 4，commit `ea2ccc6`）
- 多字段凭证存储结构：V1 已上线（commit `14a763d`）
- Volcengine / Seedream 凭证表单支持 API Key + Endpoint ID
- 保存后只展示 `last4` / `fieldMeta`，不暴露明文或密文
- Image / Video BYOK：**尚未实现**（UI 标注 coming soon，生成链路完全未接入）

---

## User Provider Accounts V2 — Seedream Image BYOK

**Commit:** `c6ff87f`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-03
**Date validated:** 2026-06-03

### 能力矩阵（当前 production 状态）

| 能力 | 状态 |
|---|---|
| Text BYOK（DeepSeek / OpenAI / Kimi） | ✅ validated |
| 多字段凭证存储结构（encryptedFields / fieldMeta） | ✅ production validated |
| Seedream Image BYOK | ✅ validated |
| UsageLog Phase S1（用量记录，Text + Image） | ✅ production validated |
| Admin BYOK Usage Dashboard（/admin/usage） | ✅ validated |
| Seedance Video BYOK | ❌ not implemented |
| Platform service fee charging | ❌ not implemented |

### 验收结果（2026-06-03 浏览器验收通过）

| 验收项 | 结果 |
|---|---|
| Image 节点出现"生成费用来源"区域，默认平台额度 | ✅ |
| 平台额度 Image 生成路径保持不变 | ✅ |
| 我的 API 账户只显示 volcengine-seedream-image active account | ✅ |
| 缺少 Endpoint ID 时显示提示并禁用生成按钮 | ✅ |
| 有效 Volcengine Ark API Key + Endpoint ID 可生成 Seedream 图片 | ✅ |
| BYOK Image 不扣平台模型 credits | ✅ |
| 生成图片刷新后仍保留（cn-executor 直写 DB） | ✅ |
| Video 节点无"生成费用来源"（Video 未接入 BYOK） | ✅ |
| Text BYOK 无回归 | ✅ |
| cn-executor 视频链路未动 | ✅ |

### 已知非阻塞现象

- 生成后偶发 `/api/projects/<id>/canvas` 返回 503（Chrome DevTools 显示 `/api/projects:1`）
- **根因**：DB pool / canvas auto-save 偶发过载，与 V2 BYOK 代码无关
- **不影响**：图片数据由 cn-executor 直写 DB + localStorage draft 双重保留，页面刷新后图片仍在
- **处理建议**：若 503 密集反复出现，应作为独立 DB pool / canvas save 稳定性任务处理，不属于 BYOK 问题

### 实现摘要

- Image 节点编辑面板新增"生成费用来源"选择（平台额度 / 我的 API 账户）
- 选择"我的 API 账户"后，只列出 `providerId === 'volcengine-seedream-image'` 的活跃账户
- BYOK 路径：Vercel 路由从 DB 读取并解密用户 API Key + Endpoint ID，通过 HTTPS 触发体传入 cn-executor；cn-executor 用用户自己的 Volcengine Ark API Key + Endpoint ID 调用 Seedream
- BYOK Image 不调用平台 credits reserve / finalize / refund
- 生成结果仍保存到平台 Asset / OSS / CanvasNode（与平台额度路径一致）
- 平台额度 Image 生成路径完全不变
- Video / Seedance 未接入 BYOK
- Text BYOK 未受影响

### 修改文件（共 6 个）

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/app/api/generate/image/route.ts` | BYOK 早返回分支（+190 行） |
| `apps/web/src/lib/provider-accounts/service.ts` | `getProviderAccountForByok`（解密 + 验权，+77 行） |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | Image 节点 BYOK UI（+78/-25 行） |
| `apps/cn-executor/src/volcengine.ts` | `SeedreamInput` 加 overrides（+17 行） |
| `apps/cn-executor/src/handlers/generateImage.ts` | `ImageExecutionInput` 加 overrides（+4 行） |
| `apps/cn-executor/src/handlers/jobRunner.ts` | 解析 `userCredential`，传入执行链（+24/-3 行） |

### 安全边界确认

| 安全项 | 状态 |
|---|---|
| `generationJob.input` 不保存明文 API Key | ✅ 只存 `billingMode: 'user_provider_account'` + `userProviderAccountId` |
| Vercel logs 不记录明文 Key | ✅ `route.ts` 不 log `userCredential` |
| cn-executor logs 不记录明文 Key | ✅ 只 log `hasByokCredential: boolean` |
| 前端不返回 `encryptedApiKey` / `encryptedFields` | ✅ `getProviderAccountForByok` select 不含密文 |
| cn-executor `submittedInput` 不含 Key 值 | ✅ 只含 `modelSource: 'user_provider_account'` |
| Video / Seedance 未接入 | ✅ 生成路由未动 |
| Text BYOK 不受影响 | ✅ 仅扩展 Image UI 条件，Text 路径不变 |
| 用户只能使用自己的账户 | ✅ `where: { id: accountId, userId }` 强制所有权 |
| Provider 白名单校验 | ✅ `SEEDREAM_BYOK_PROVIDER_IDS = ['volcengine-seedream-image']` |

### 浏览器验收重点

| # | 步骤 | 预期结果 |
|---|---|---|
| 1 | 打开 Image 节点编辑面板 | 出现"生成费用来源"区域，默认选中"平台额度" |
| 2 | 平台额度模式点击生成 | 正常生成，画布显示图片，无任何变化 |
| 3 | 切换到"我的 API 账户" | 只显示 `volcengine-seedream-image` 类型的活跃账户 |
| 4 | 选中缺少 Endpoint ID 的账户 | 显示 amber 警告，生成按钮 disabled |
| 5 | 选中有效 Ark API Key + Endpoint ID 的账户 | 警告消失，生成按钮可用 |
| 6 | 点击生成 | 成功生成 Seedream 图片，画布节点显示图片 |
| 7 | 生成后检查平台模型 credits | 无扣减（BYOK 完全绕过平台 billing） |
| 8 | 打开 Video 节点编辑面板 | 无"生成费用来源"区域（Video 未接入） |
| 9 | 测试 Text BYOK | 行为与之前一致，无回归 |
| 10 | 使用非 volcengine-seedream-image 账户 | 不可选（前端过滤 + 后端 whitelist 校验） |

### 下一步建议（基于 UsageLog Phase S1 生产验证后）

- **已完成**：UsageLog Phase S1 已生产验证（commit `d693f71`），Text + Image BYOK 用量可记录
- **禁止**：不经评审直接开发 Seedance Video BYOK
- ✅ **已验收**：Phase S3 — admin BYOK usage dashboard (`/admin/usage`，commit `fbf7734`，validated 2026-06-03)
- 可选 A：Phase S2 — 用户端 usage history（`/account/providers` 展示每账户调用次数）
- 可选 B：Seedance Video BYOK 安全审计（评审 cn-executor credential access 方案后再实现）
- 可选 C：Provider Account Center 产品化升级（UI 打磨 / 多账户管理 / 测试连接结果展示）
- **暂不建议**：立刻启用平台服务费扣费（先观察 30–60 天真实用量后再决定服务费策略）

---

## Admin BYOK Usage Dashboard — IMPLEMENTED / browser validation pending

**Commit:** `fbf7734`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-03
**Date validated:** 2026-06-03

### 新增文件（共 3 个）

| 文件 | 说明 |
|---|---|
| `apps/web/src/app/admin/usage/page.tsx` | admin 用量看板页面（client component） |
| `apps/web/src/app/api/admin/usage/route.ts` | 只读 usage API route |
| `apps/web/src/app/admin/page.tsx` | 新增"生成用量观察"入口卡片 |

### 功能说明

| 功能 | 状态 |
|---|---|
| 时间范围切换（近 24h / 7d / 30d） | ✅ |
| Summary cards：总调用数、BYOK 调用、平台额度调用、成功率、失败数、服务费总计 | ✅ |
| 生成类型分布（text / image / video）+ 简单 bar | ✅ |
| 计费模式分布（BYOK vs 平台额度）+ 简单 bar | ✅ |
| 状态分布（成功 / 失败）+ 简单 bar | ✅ |
| Provider 分布（前 20）+ 简单 bar | ✅ |
| Top 10 用户（email + displayName + 调用次数） | ✅ |
| 最近 50 条 UsageLog 记录（不含 prompt 明文，仅展示 promptChars） | ✅ |
| 明确标注：当前仅统计用量，不启用平台服务费扣费 | ✅ |
| 明确区分：platform_credits = 平台代付；user_provider_account = 用户自带 API Key | ✅ |
| 显示当前 platformServiceFeeCredits 总和（预期为 0） | ✅ |

### API 说明

`GET /api/admin/usage`

**Query 参数：**
- `range=24h|7d|30d`（默认 7d）
- `outputType=all|text|image|video`（默认 all）
- `billingMode=all|platform_credits|user_provider_account`（默认 all）

**返回字段：** summary / byOutputType / byProvider / byBillingMode / byStatus / topUsers / recent

### 安全边界确认

| 安全项 | 状态 |
|---|---|
| 仅 `user.role === 'ADMIN'` 可访问 | ✅ API route + page 双重保护 |
| 不显示 prompt 明文（UsageLog 本身不含 prompt 字段） | ✅ |
| 不显示 API Key / encryptedApiKey / encryptedFields | ✅ |
| topUsers 只显示 email / displayName，无凭证字段 | ✅ |
| recent 列表只 select 安全字段，无敏感凭证 | ✅ |
| 不启用收费，无 credits reserve/settle/release 调用 | ✅ |
| 不修改 text/image/video 生成链路 | ✅ |
| 不修改 credits / billing 核心语义 | ✅ |
| 不修改 cn-executor | ✅ |
| type-check / lint / build 全部通过 | ✅ |

### 浏览器验收重点

| # | 步骤 | 预期结果 |
|---|---|---|
| 1 | 管理员访问 `/admin/usage` | 正常显示 dashboard，有 summary cards 和数据表格 |
| 2 | 普通用户（非 ADMIN）访问 `/admin/usage` | 显示"无权限"错误，不能看到数据 |
| 3 | 未登录访问 `/api/admin/usage` | 返回 401 |
| 4 | 切换 24h / 7d / 30d 范围 | 数据刷新，总调用数变化 |
| 5 | 查看最近记录表 | 无 prompt 明文列，有 promptChars（字符数）列 |
| 6 | 查看最近记录表 | 无 API Key / encryptedFields 列 |
| 7 | 查看服务费 summary card | 显示 0（当前 platformServiceFeeCredits 固定为 0） |
| 8 | 页面底部说明 | 显示"当前仅统计用量，不启用平台服务费扣费" |
| 9 | 生成一条 Text BYOK 记录后刷新 dashboard | 总调用数 +1，BYOK 调用 +1 |
| 10 | 生成一条 Image（平台额度）记录后刷新 dashboard | 总调用数 +1，平台额度 +1 |

### 浏览器验收结果（2026-06-03 通过）

| 验收项 | 结果 |
|---|---|
| 管理员访问 `/admin/usage` 可见 dashboard | ✅ |
| 普通用户访问被拒绝（无权限错误） | ✅ |
| 24h / 7d / 30d 时间范围切换正常 | ✅ |
| Summary cards：总调用数、BYOK 调用、平台额度调用、成功率、失败数、服务费总计 | ✅ |
| outputType / billingMode / provider / status 分布显示正常 | ✅ |
| Top users 显示 email + displayName + 调用次数 | ✅ |
| 最近 UsageLog 只显示 promptChars，不显示 prompt 明文 | ✅ |
| 不显示 API Key / encryptedApiKey / encryptedFields | ✅ |
| platformServiceFeeCredits 显示为 0，不启用扣费 | ✅ |

### 下一步建议

- ~~可选 B：Provider Account Center 产品化升级~~ ✅ DONE (commit `e96f916`, validated 2026-06-03)
- 可选 A：用户端 usage history（`/account/providers` 展示每账户调用次数）
- 可选 C：Seedance Video BYOK 安全评审（评审 cn-executor credential access 方案后再实现）
- 可选 D：平台服务费策略审计（先观察 30–60 天用量数据后制定）
- **暂不建议**：立刻启用平台服务费扣费

---

## Provider Account Center 产品化升级 — CLOSED / validated

**Commit:** `e96f916`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-03
**Date validated:** 2026-06-03

### 升级内容

| 项目 | 状态 |
|---|---|
| 页面更名：Provider API 账户 → 模型账户中心 | ✅ |
| Hero section：价值主张 + 3 项关键说明（加密存储 / 直接调用 / 不经平台） | ✅ |
| 计费模式卡：2 列 → 3 列（平台额度 / 我的 API / 未来纯平台服务费） | ✅ |
| 能力矩阵（CAPABILITY_MATRIX，display-only，不接表单）：9 个 Provider × 状态 | ✅ |
| 布局扩宽：`max-w-2xl` → `max-w-4xl` | ✅ |
| 阶段提示升级：由 amber（待开放）→ emerald（Seedream 已上线） | ✅ |
| 已连接账户卡片加入类别标签（文本 / 图片 / 视频） | ✅ |
| 修复 `volcengine-seedream-image` byokStatus：`coming_soon` → `live` | ✅ |
| 修复 `testAccount` 条件：从 `byokStatus===coming_soon && bearer` 改为 `bearer_with_endpoint` | ✅ |
| 测试连接提示更新：火山方舟账户提示"请通过画布生成验证"，不触发图片 API | ✅ |
| 表单安全说明升级：5 条详细说明（加密/不持有/删除/吊销指引） | ✅ |
| 前端不显示 API Key / encryptedApiKey / encryptedFields | ✅ |

### 浏览器验收结果（2026-06-03）

| 验收项 | 结果 |
|---|---|
| `/account/providers` 标题更新为"模型账户中心" | ✅ |
| 页面明确说明普通用户无需 API Key，可继续使用平台额度 | ✅ |
| 页面明确说明 API Key 不是网页登录账号密码 | ✅ |
| 页面明确说明用户 API 费用直接支付给 Provider，不经过平台 | ✅ |
| 展示三种模式：平台额度 / 我的 API（BYOK）/ 未来纯平台服务费 | ✅ |
| 能力矩阵展示：Text BYOK ✅、Seedream Image ✅、Seedance Video 🟡、其他 ○ | ✅ |
| Seedream Image 状态显示"已上线" | ✅ |
| Seedance Video 显示"存凭证，生成接入中" | ✅ |
| 已连接账户卡片显示文本 / 图片 / 视频类别标签 | ✅ |
| Seedream 账户点击"测试连接"显示"不支持自动测试"，不触发图片生成 API | ✅ |
| 不显示 API Key / encryptedApiKey / encryptedFields | ✅ |

### 安全边界确认

- 未修改 `/api/generate/*` / billing / credits / payment / schema / cn-executor
- 未新增真实 Provider（capability matrix 仅为展示常量，不接 form select）
- 未修改 Provider Account CRUD API 语义
- 未修改 UsageLog / Admin Dashboard
- 仅修改 `apps/web/src/app/account/providers/page.tsx`

---

## Provider Account Center Auth Blank Screen Fix — CLOSED / validated

**Commit:** `4710e79`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 问题背景

用户从右上角头像菜单点击「Provider API 账户」进入 `/account/providers` 时出现完全白屏（永久空白，无法恢复）。

### 根本原因

`/account/providers` 页面存在两个互相冲突的 auth guard：

1. `effectiveIsAuthenticated`（正确逻辑）：当 Zustand 本地登录态有效时（`isAuthenticated = true`），即使 `/api/auth/me` server check 还在加载中，也应允许显示页面内容。
2. 显式 guard `if (sessionStatus === 'loading' || sessionStatus === 'unknown') return null`：**覆盖了上面的逻辑**，无论 Zustand 状态如何，只要 server auth check 还在进行（最多 5 秒超时），就强制返回 null（白屏）。

**结果**：有效登录用户点击该页面 → `/api/auth/me` 请求超时或网络慢（≥5s）→ `sessionStatus` 变为 `'unknown'` → 页面永久空白，无法自动恢复。

### 修复内容

| 项目 | 状态 |
|---|---|
| 移除覆盖性 guard `if (sessionStatus === 'loading' \|\| 'unknown') return null` | ✅ |
| 改为由 `effectiveIsAuthenticated` 单一控制渲染 | ✅ |
| 有 Zustand 本地有效 session 时，页面立即显示（不再等待 server check） | ✅ |
| server auth check 继续在后台异步进行，session 过期时 useEffect 执行重定向 | ✅ |
| `sessionStatus === 'unknown'` 且无本地 session 时，显示可见 retry 状态（不再永久白屏） | ✅ |
| 从 `useCurrentUser` 获取 `refresh` 函数，retry 按钮可重新发起 auth check | ✅ |
| type-check 通过 | ✅ |

### 浏览器验收结果（2026-06-04 通过）

| 验收项 | 结果 |
|---|---|
| 用户菜单 → 「Provider API 账户」→ `/account/providers` 正常打开，不白屏 | ✅ |
| 有本地 session（localStorage Zustand）时，页面立即渲染，不等待 server auth check | ✅ |
| 慢网络或 `/api/auth/me` pending 期间，已连接账户列表显示"加载中…"而非白屏 | ✅ |
| 已连接账户列表正常显示（空态 or 账户列表） | ✅ |
| API 错误时显示友好错误信息，不崩溃 | ✅ |
| Text 账户「测试连接」功能无回归 | ✅ |
| Seedream 账户「测试连接」仍显示"不支持自动测试" | ✅ |
| `/account/usage` 未受影响 | ✅ |

### 安全边界确认

- 未修改 `/api/generate/*` / billing / credits / payment / schema / cn-executor
- 未修改 Provider Account CRUD API 语义
- 未修改 UsageLog / Admin Dashboard
- 仅修改 `apps/web/src/app/account/providers/page.tsx`（2 行删除，24 行添加）

---

## User Usage History — CLOSED / validated

**Commits:** `dc69df8`（实现）→ `338c2a3`（标签中文化）→ `f928f10`（auth 白屏修复）→ `673dfbc`（用户菜单入口）→ `8119eb0`（线上查询修复）
**Status:** ✅ CLOSED / validated
**Date validated:** 2026-06-04

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/app/account/usage/page.tsx` | 用户端用量历史页面（client component） |
| `apps/web/src/app/api/account/usage/route.ts` | 用户自身用量 API route，userScope 强隔离 |

### 功能说明

| 功能 | 状态 |
|---|---|
| 时间范围切换（近 24h / 7d / 30d / 全部） | ✅ |
| 费用来源筛选（全部 / 平台额度 / 我的 API） | ✅ |
| 生成类型筛选（全部 / 文本 / 图片 / 视频） | ✅ |
| Summary cards：总生成次数 / 我的 API / 平台额度 / 文本·图片 / 成功率 / 平台服务费 | ✅ |
| 分布面板：生成类型 / 计费模式 / Provider 来源 | ✅ |
| 最近生成记录表（桌面 8 列 + 移动卡片视图） | ✅ |
| 不显示 prompt 明文 / API Key / encryptedApiKey / encryptedFields | ✅ |
| 全部标签中文化（底层 API 枚举值不变） | ✅ |
| `/account` 快速入口加入"生成用量"入口卡 | ✅ |

### 安全边界

- `GET /api/account/usage`：每条查询都注入 `userScope = { userId: user.id }`，用户只能看自己的数据
- `select` 白名单：不含 prompt 字段（UsageLog 本身无此字段）、不含凭证字段
- 独立于 `GET /api/admin/usage`（admin 专用，不共享代码或权限）

### 浏览器验收结果（2026-06-04）

| 验收项 | 结果 |
|---|---|
| 用户头像菜单新增「生成用量」入口 → `/account/usage` | ✅ |
| `/account` 页面保留「生成用量」卡片入口 | ✅ |
| `/account/usage` 页面可正常打开 | ✅ |
| 页面不白屏 | ✅ |
| 页面不显示数据库查询错误 | ✅ |
| 中文筛选：近 24 小时 / 近 7 天 / 近 30 天 / 全部 | ✅ |
| 中文筛选：全部来源 / 平台额度 / 我的 API | ✅ |
| 中文筛选：全部类型 / 文本 / 图片 / 视频 | ✅ |
| 最近记录展示 Prompt 字符数，不展示 prompt 明文 | ✅ |
| 不展示 API Key / encryptedApiKey / encryptedFields | ✅ |
| 只展示当前用户自己的 UsageLog（userId 强隔离） | ✅ |
| 平台服务费显示为当前未启用 / 0 | ✅ |
| 未登录访问 → 401 / 跳转登录 | ✅ |
| `/account/providers` 无回归 | ✅ |
| `/admin/usage` 无回归 | ✅ |

---

## Seedance Video BYOK Security Review — CLOSED / read-only audit completed

**审计日期：** 2026-06-04
**审计性质：** 只读 — 零文件修改，零 commit，零 push

### 当前状态（已确认）

| 项目 | 状态 |
|---|---|
| Seedance Video BYOK | ❌ 未实现 |
| 当前 Seedance Video 使用 | 平台 `VOLCENGINE_ARK_API_KEY`（cn-executor env var） |
| 视频生成实际执行点 | cn-executor（Aliyun FC 异步函数） |
| Vercel video route 是否扣平台 credits | ❌ 不扣（早返回于 setupBilling/finalizeBilling 之前） |
| cn-executor videoJobRunner 是否有 UsageLog 写入 | ❌ 无（视频生成全链路暂无 UsageLog） |
| cn-executor videoJobRunner 是否接受 userCredential | ❌ 不接受（当前只读取 generationJob.input） |
| generationJob.input 是否包含 API Key | ✅ 不包含（只存 prompt / model / duration / aspectRatio / providerId） |

### 推荐方案（Option A — 镜像现有 Image BYOK 路径）

**不推荐的方案：**
- ❌ 将 `PROVIDER_KEY_ENCRYPTION_SECRET` 放入 cn-executor — 扩大密钥攻击面
- ❌ 让 cn-executor 直连 `UserProviderAccount` 表并解密 — 同上，且破坏服务层边界
- ❌ 将 encrypted credential 写入 `generationJob.input` — 若 DB 和 secret 同时泄漏则 key 外泄
- ❌ 现在启用平台服务费扣费 — 时机未到，用量数据不足

**推荐方案 Option A（与 Image BYOK 完全一致）：**

```
Browser → POST /api/generate/video { providerAccountId?, billingMode?, ... }

Vercel video route（新增）：
  if billingMode === 'user_provider_account':
    cred = getProviderAccountForByok(userId, providerAccountId, ['volcengine-seedance-video'])
    if !cred.ok → 400 早返回
    triggerBody.userCredential = { apiKey: cred.apiKey }  // 明文只存在 HTTPS 传输中
  POST cn-executor /api/jobs/run-video { generationJobId, userCredential? }

cn-executor videoJobRunner（新增）：
  const { userCredential } = triggerBody
  console.log({ hasByokCredential: Boolean(userCredential) })  // 只记录 boolean
  submitSeedanceTask({ ..., apiKeyOverride: userCredential?.apiKey })  // 不 log key 值
  pollSeedanceTaskUntilDone(taskId, { apiKeyOverride: userCredential?.apiKey })
  // key 用完即丢，不写 DB，不写 generationJob.input，不返回前端

cn-executor seedance.ts（新增）：
  SeedanceSubmitInput.apiKeyOverride?: string
  const apiKey = input.apiKeyOverride?.trim() || process.env.VOLCENGINE_ARK_API_KEY?.trim()
```

### 硬性 no-go（实施时全部必须满足）

| no-go 条件 | 说明 |
|---|---|
| key 不得写入 `generationJob.input` | JSON 列，任何有 DB 访问权限的人都能读取 |
| key 不得写入 cn-executor 日志 | 只允许 `hasByokCredential: boolean` |
| key 不得返回前端 | 任何 API 响应都不得含明文 key |
| 未验证 `userId` 不得使用 `providerAccountId` | `getProviderAccountForByok` 强制 `{ id, userId }` 所有权校验 |
| BYOK Video 不得扣平台模型 credits | Video route 已在 setupBilling 前早返回，保持不变 |
| `auth_failed` 不得透传 provider 原始敏感响应给用户 | 错误信息脱敏后再返回 |
| 没有 feature flag skeleton 和日志脱敏基础不得上线 | 必须先完成 safe logging 基础 |

### 实施时涉及文件（V1 最小改动）

| 文件 | 改动说明 |
|---|---|
| `apps/cn-executor/src/seedance.ts` | 新增 `apiKeyOverride?: string` 到 `SeedanceSubmitInput`；submit + poll 函数用 override 优先 |
| `apps/cn-executor/src/handlers/videoJobRunner.ts` | 接受 `userCredential?: { apiKey: string }` from trigger body；仅 log `hasByokCredential`；forward 到 seedance 函数 |
| `apps/web/src/app/api/generate/video/route.ts` | 接受 `providerAccountId`；调用 `getProviderAccountForByok`；添加到 trigger body |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | 视频节点添加"生成费用来源"选择器 UI（镜像 Image 节点条件） |

**不需要改动的文件（已可复用）：**
- `apps/web/src/lib/provider-accounts/service.ts` — `getProviderAccountForByok` 已支持任意 `allowedProviderIds`
- `apps/web/src/lib/provider-accounts/crypto.ts` — 加密层稳定
- Prisma schema — 仅 API Key 即可，无需 endpointId（Seedance 不用 endpoint ID，model 由平台 env 控制）

### UsageLog 计划（实施时一并补充）

当前 Seedance video **无任何 UsageLog 写入**，BYOK 实施时应同步补充：

```typescript
// Vercel video route，GenerationJob 创建后写入
await db.usageLog.create({
  data: {
    userId, projectId, nodeId,
    providerId: 'volcengine-seedance-video',
    outputType: 'video',
    billingMode: isByok ? 'user_provider_account' : 'platform_credits',
    status: 'pending',
    providerCostPaidBy: isByok ? 'user' : 'platform',
    promptChars: prompt.length,
    platformServiceFeeCredits: 0,
  },
})
```

### 当前不实施的理由

- Video BYOK 对现有用户无阻塞（平台 key 已可正常生成视频）
- cn-executor 改动须单独测试，风险高于收益
- 应先做 cn-executor safe logging 和 request redaction 基础，再接 BYOK
- 30–60 天观察用量数据后，再决定是否值得为 power user 做此优化

---

## Provider Account Detail / Health Status — CLOSED / validated

**Commit:** `60aaa95`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/app/api/provider-accounts/[id]/summary/route.ts` | 只读 summary API，返回账户信息 + 90 天用量 + 近 20 条记录 + 健康状态 |
| `apps/web/src/app/account/providers/[id]/page.tsx` | 账户详情页（7 个 section） |

### 功能说明

| 功能 | 状态 |
|---|---|
| `GET /api/provider-accounts/[id]/summary` — 双重 scope：userId + providerAccountId | ✅ |
| 账户身份 section：名称、状态、Provider、日期、范围、凭证类型 | ✅ |
| 健康状态 section：基于 lastTestStatus + 90 天失败率计算 | ✅ |
| 凭证安全 section：仅显示 API Key 末 4 位 + Endpoint ID 末 4 位（fieldMeta） | ✅ |
| 近 90 天用量汇总（总调用 / 成功 / 失败 / 文本 / 图片 / 视频 / 服务费） | ✅ |
| 最近 20 条调用记录（时间 / 类型 / 计费模式 / 状态 / errorCode） | ✅ |
| 操作 section：测试 / 启用 / 停用 / 设为默认 / 删除（复用现有端点） | ✅ |
| 安全说明 section | ✅ |
| 面包屑：账号设置 / 模型账户中心 / 账户名 | ✅ |
| 不返回 encryptedApiKey / encryptedFields / prompt 明文 | ✅ |
| UsageLog 查询强制 where: { userId, providerAccountId } 双条件 | ✅ |
| UsageLog 失败降级：账户信息正常返回，用量显示"暂时不可用" | ✅ |
| /account/providers 每个账户卡片新增「查看详情」按钮 | ✅ |

### 浏览器验收结果（2026-06-04 通过）

| # | 步骤 | 结果 |
|---|---|---|
| 1 | `/account/providers` 每个账户卡片有「查看详情」按钮 | ✅ |
| 2 | 点击「查看详情」→ 进入 `/account/providers/[id]`，面包屑正确 | ✅ |
| 3 | 详情页显示账户名称、Provider、状态、默认标识 | ✅ |
| 4 | 凭证 section 只显示 API Key 末 4 位，不显示完整 Key | ✅ |
| 5 | Seedream 等账户显示 Endpoint ID 末 4 位（如适用） | ✅ |
| 6 | 健康状态 section 显示绿 / 橙 / 红 / 灰色徽章及原因文本 | ✅ |
| 7 | 近 90 天用量汇总正确，无记录显示空态 | ✅ |
| 8 | 最近 20 条调用记录表显示时间 / 类型 / 状态，无 prompt 明文 | ✅ |
| 9 | 不显示 encryptedApiKey / encryptedFields / prompt 明文 | ✅ |
| 10 | 只能查看当前用户自己的账户 | ✅ |
| 11 | `/account/providers` 列表无回归 | ✅ |
| 12 | `/account/usage` 无回归 | ✅ |
| 13 | `/admin/usage` 无回归 | ✅ |
| 14 | 没有改生成链路 / Provider CRUD / billing / schema | ✅ |

---

## Subpage Navigation Polish — CLOSED / validated

**Commit:** `5cb46a8`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 本次变更

| 项目 | 状态 |
|---|---|
| CurrentContextBar：删除 workspace 上下文无效 quick actions（Open Project / Notifications / My Work） | ✅ |
| 项目上下文真实 quick actions（Producer Dashboard / Team / Delivery / Review 等）未删除 | ✅ |
| `/account/credits`：新增「← 账号设置」返回按钮 | ✅ |
| `/help`（DiagnosticsCenter）：新增「← 返回首页」和「API Key 接入指南」入口 | ✅ |
| `/admin/usage`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/users`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/health`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/billing`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/china`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/credits`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/providers`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/payments/china`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/storage/china`：新增「← 管理员面板」返回按钮 | ✅ |
| 已有返回入口的页面未重复堆叠（`/account`、`/account/usage`、`/account/providers`、`/account/providers/[id]`、`/help/api-keys`） | ✅ |

### 审计结论

| 页面 | 判断 | 结果 |
|---|---|---|
| `/account` | 已有「← 返回工作台」 | 未改 |
| `/account/usage` | 已有「← 账号设置」 | 未改 |
| `/account/credits` | 无返回入口 → 新增 | ✅ |
| `/account/providers` | 已有「← 账号设置」 | 未改 |
| `/account/providers/[id]` | 已有 3 段面包屑 | 未改 |
| `/help/api-keys` | 上次已修复 3 个按钮 | 未改 |
| `/help` | 无返回入口 → 新增 | ✅ |
| `/admin/*`（9 个子页面） | 均无返回入口 → 全部新增 | ✅ |
| 顶级页面（`/create` / `/community` 等） | TopNav 已足够，不堆按钮 | 判断不需要 |

### 浏览器验收结果（2026-06-04）

| 验收项 | 结果 |
|---|---|
| Workspace / Dashboard 顶部 Open Project / Notifications / My Work 已删除 | ✅ |
| 项目上下文 quick actions 未受影响 | ✅ |
| `/account/credits` 右上角「← 账号设置」可见且可点击 | ✅ |
| `/help` 顶部「← 返回首页」和「API Key 接入指南」可见 | ✅ |
| 所有 `/admin/*` 子页面顶部「← 管理员面板」可见且可点击 | ✅ |
| `/help/api-keys` 原 3 个返回按钮保留，无回归 | ✅ |
| `/account/providers`、`/account/providers/[id]`、`/account/usage` 无回归 | ✅ |
| 没有改生成链路 / BYOK / UsageLog / Provider CRUD / billing / schema | ✅ |
| type-check / lint 通过 | ✅ |

---

## Provider Account Center UX Polish Batch — CLOSED / validated

**Commit:** `0f4eee8`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 修复内容

| 修复项 | 说明 |
|---|---|
| `billingModeLabel` 映射修复 | `user_provider_account` → 我的 API；`platform_credits` → 平台额度（原代码检查 byok/platform，DB 值不匹配，所有行显示 —） |
| 调用记录状态中文化 | `pending` / `queued` / `running` → 处理中；`canceled` → 已取消（原显示英文枚举值） |
| 凭证类型文案中文化 | `API Key + Endpoint` → `API Key + 接入点 ID` |
| 接入点 ID 预览中文化 | 账户卡片中 `Endpoint: •••• xxxx` → `接入点 ID：•••• xxxx` |
| 支付状态中文化 | `/account/credits` 支付宝/微信状态从 `available / 可用` / `checking...` / `not-configured` 改为 `已配置 / 可用` / `检测中…` / `未配置` |
| 顶部"我的 API"菜单补齐 | 新增 API Key 接入指南 → `/help/api-keys`，生成用量 → `/account/usage` |
| 头像菜单文案统一 | `Provider API 账户` → `我的 API 账户` |
| `/account` 增加 API Key 指南入口 | 快捷入口下方增加浅蓝色文字链接 |
| `/account/providers` 空状态改善 | 新增"📖 查看 API Key 接入指南"按钮 |
| `/account/usage` 错误状态改善 | 新增"刷新重试"按钮和"← 账号设置"返回链接 |
| Volcengine 账户验证引导 | `/account/providers/[id]` 中 `bearer_with_endpoint` 账户操作区显示"如何验证此账户"蓝色提示框，引导用户通过画布图片节点实际验证 |

### 安全边界确认

- 未改生成链路 / billing / schema / cn-executor ✅
- 未新增 API 路由 ✅
- 未展示 API Key / encryptedApiKey / encryptedFields / prompt 明文 ✅
- type-check / lint / build 全部通过 ✅

---

## Account / Billing / BYOK Messaging — CLOSED / validated

**Commit:** `4347465`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/app/account/page.tsx` | 快捷入口下方新增三种费用模式一行说明（平台额度 / 我的 API / 平台服务费） |
| `apps/web/src/app/account/credits/page.tsx` | WalletBalanceCard 上方新增费用说明框（3 行，分别解释三种模式） |

### 验收结果（2026-06-04 静态核查通过）

| 验收项 | 结果 |
|---|---|
| `/account` 快捷入口下方出现三种费用模式说明 | ✅ |
| 平台额度：「购买积分，Creator City 代付 API 调用」 | ✅ |
| 我的 API：「自带 Provider Key，API 费用直付给服务商，不扣平台积分」 | ✅ |
| 平台服务费：「当前未启用（0）」 | ✅ |
| `/account/credits` WalletBalanceCard 上方出现费用说明框 | ✅ |
| 明确本页是平台额度余额与流水（Creator City 代付 AI 模型 API 调用） | ✅ |
| 明确「我的 API 账户」时 API 费用由用户直接支付给服务商，不经过平台积分 | ✅ |
| 明确平台服务费当前未启用，显示为 0 | ✅ |
| 防止用户误以为充值这里会充值到 Provider 账户 | ✅ |
| 防止用户误以为 Provider API 费用由 Creator City 代收 | ✅ |
| `/account/providers` 无回归 | ✅ |
| `/account/providers/[id]` 无回归 | ✅ |
| `/account/usage` 无回归 | ✅ |
| `/help/api-keys` 无回归 | ✅ |
| 不显示 API Key / encryptedApiKey / encryptedFields / prompt 明文 | ✅ |
| 未改生成链路 / billing / credits / Provider CRUD / UsageLog / cn-executor / schema | ✅ |

### 安全边界确认

- 仅修改 JSX 展示文案（2 个文件，各加一小块 info div）
- 未触碰任何业务逻辑、API 路由、schema、billing / credits 语义
- type-check 全部通过

---

## Provider Account Health Guidance — CLOSED / validated

**Commit:** `4bac934`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 修改文件（共 3 个，仅 UI）

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/app/account/providers/[id]/page.tsx` | 新增 `getHealthExplanation` + `RepairTip` 类型 + `getRepairTips` 函数；健康卡片下增加中文扩展说明；插入「建议操作」修复建议 section |
| `apps/web/src/app/account/providers/page.tsx` | 新增 `getAccountHint` 函数；异常账户卡片显示轻量健康 chip |
| `apps/web/src/app/help/api-keys/page.tsx` | FAQ section 重命名为「出错了怎么办？」；新增 3 条 FAQ |

### 功能说明

| 功能 | 状态 |
|---|---|
| `/account/providers/[id]` 健康卡片下显示扩展中文解释（healthy / disabled / auth_failed / quota / timeout / unsupported / warning / unknown 各一句） | ✅ |
| `/account/providers/[id]` 健康卡片与凭证之间插入「建议操作」section（最多 3 条，severity 颜色区分） | ✅ |
| auth_failed / unauthorized / invalid_api_key / provider_auth_failed → 提示重新生成 API Key，链接接入指南 | ✅ |
| insufficient_quota / rate_limited → 提示检查 Provider 账户余额和 API billing | ✅ |
| bearer_with_endpoint 缺失 endpointId → 提示补充接入点 ID，链接接入指南 | ✅ |
| timeout → 提示稍后重试或切换平台额度 | ✅ |
| unsupported（Seedream 不支持自动测试）→ 提示在画布图片节点切换「我的 API 账户」实际验证 | ✅ |
| 最近失败记录 errorCode 正则匹配（auth / quota / endpoint 三类），补充对应 tip | ✅ |
| 未测试 + 无用量账户 → info tip 引导测试连接或实际生成 | ✅ |
| 用量数据不可用 → "用量数据暂时不可用，请稍后重试" | ✅ |
| `/account/providers` 异常账户卡片显示轻量 chip（4 种异常，正常账户不显示） | ✅ |
| chip 使用现有 `usageSummaries` 数据，不发新 API 请求 | ✅ |
| `/help/api-keys` FAQ section 重命名「出错了怎么办？」 | ✅ |
| `/help/api-keys` 新增：Seedream 不支持自动测试说明、连接超时说明、BYOK 不扣平台服务费说明 | ✅ |

### 验收结果（2026-06-04 静态核查通过）

| 验收项 | 结果 | 备注 |
|---|---|---|
| `/account/providers/[id]` 健康卡片显示中文扩展解释 | ✅ PASS | `getHealthExplanation` → secondary `<p>` |
| auth_failed / provider_auth_failed / unauthorized / invalid_api_key 覆盖 | ✅ PASS | lastTestStatus + recentUsage 正则双重覆盖 |
| quota / billing / insufficient_quota 覆盖 | ✅ PASS | lastTestStatus + recentUsage 正则双重覆盖 |
| provider_model_invalid / endpoint_invalid / model_not_found 覆盖 | ✅ PASS | credentialType 检查 + recentUsage 正则 |
| timeout / provider_timeout 覆盖 | ✅ PASS | lastTestStatus === 'timeout' |
| db_unavailable / 用量数据不可用 | ✅ PASS | `usageSummaryUnavailable` → "暂时不可用" |
| asset_not_found / media_not_found | ⚠️ WARN | 非账户健康问题，未在 getRepairTips 中显式覆盖；recentUsage 表展示原始 errorCode；不在原始任务规格内；非阻塞 |
| Seedream 不支持自动测试，有画布验证引导 | ✅ PASS | 两处：getHealthExplanation + getRepairTips（含「去画布创作」链接） |
| 不触发真实生成 / 不调用 Provider | ✅ PASS | 所有 tip 均为静态文案 |
| `/account/providers` 异常 chip 正常（4 种异常类型） | ✅ PASS | `getAccountHint` 函数覆盖 auth/quota/endpointId/fail-rate |
| 正常账户不显示 chip | ✅ PASS | `if (!hint) return null` |
| `/help/api-keys` FAQ 重命名「出错了怎么办？」 | ✅ PASS | |
| `/help/api-keys` 新增 3 条 FAQ | ✅ PASS | Seedream unsupported / timeout / BYOK 服务费 |
| 不显示 API Key / encryptedApiKey / encryptedFields / prompt 明文 | ✅ PASS | 无 grep 命中 |
| `/account/usage` 无回归 | ✅ PASS | 文件未修改 |
| `/admin/usage` 无回归 | ✅ PASS | 文件未修改 |
| cn-executor 未改动 | ✅ PASS | commit diff 只含 3 个 web UI 文件 |
| 生成链路 / billing / schema 未改动 | ✅ PASS | commit diff 只含 3 个 web UI 文件 |
| type-check / lint / build 全部通过 | ✅ PASS | 零新错误 |

### 安全边界确认

- 未修改任何 API 路由、Provider CRUD、billing、credits、UsageLog schema
- 未修改 `/api/generate/*` / cn-executor / Prisma schema / payment
- 未新增真实 Provider 调用
- 所有 tip 文案静态渲染，不触发任何后端请求
- 不显示 API Key 明文 / encryptedApiKey / encryptedFields / prompt 明文 / endpointId 明文

---

## Seedance Video BYOK Safe Logging / Feature Flag Skeleton — CLOSED / validated

**Commit:** `3c2bab6`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 目标

为未来 Seedance Video BYOK 实施准备安全基础，不开放 BYOK 给用户。

### 修改文件（共 4 个）

| 文件 | 改动说明 |
|---|---|
| `apps/cn-executor/src/logSafe.ts` | 新文件：`redactCredentialFields` + `sanitizeExecutorLogPayload` + `safeLogVideoJob` 三个工具函数 |
| `apps/cn-executor/src/handlers/videoJobRunner.ts` | 使用 `safeLogVideoJob`；start log 加 `hasByokCredential: false`；task done / job completed log 改为 boolean 标志，不再 slice 签名 URL |
| `apps/cn-executor/src/seedance.ts` | submit / poll 日志移除 `responseBody`（可能含签名 URL / token），改用已提取的安全字段 |
| `apps/web/src/app/api/generate/video/route.ts` | 新增 `ENABLE_SEEDANCE_VIDEO_BYOK` feature flag（默认 false）；缺少 env var 时也默认 false；`billingMode=user_provider_account` 请求返回 403 `VIDEO_BYOK_NOT_ENABLED` |

### 功能说明

| 功能 | 状态 |
|---|---|
| `logSafe.ts`：`CREDENTIAL_KEYS` 集合覆盖 apiKey / Authorization / encryptedApiKey / encryptedFields / userCredential / endpointId 等 | ✅ |
| `redactCredentialFields`：深度递归脱敏，不处理数组（数组不含凭证字段） | ✅ |
| `safeLogVideoJob`：统一 `[cn-executor][videoJobRunner]` 前缀 + 自动脱敏 | ✅ |
| videoJobRunner start log：`hasByokCredential: false`（当前平台路径，为 BYOK 实施预留 boolean 标志位） | ✅ |
| videoJobRunner task done log：`hasProviderVideoUrl: true` + `providerVideoUrlLength`（不再 slice 签名 URL） | ✅ |
| videoJobRunner job completed log：`hasStableVideoUrl: true`（不再 slice OSS URL） | ✅ |
| seedance.ts submit log：移除 `responseBody` 字段，只保留已提取的 taskId / httpStatus / model / hasImageUrl / duration / ratio | ✅ |
| seedance.ts poll log：移除 `responseBody` 字段，只保留 taskId / pollIndex / httpStatus / hasVideoUrl / taskStatus | ✅ |
| video route feature flag：`ENABLE_SEEDANCE_VIDEO_BYOK = process.env.ENABLE_SEEDANCE_VIDEO_BYOK === 'true'`；env var 缺失时必定 false | ✅ |
| video route guard：flag 为 false 且 `billingMode === 'user_provider_account'` → 403 `VIDEO_BYOK_NOT_ENABLED` | ✅ |
| 平台 video 路径（无 billingMode / billingMode=platform_credits）完全不受影响 | ✅ |
| 平台 credits reserve / finalize / refund 语义不变 | ✅ |

### 关键状态记录

| 项目 | 状态 |
|---|---|
| Seedance Video BYOK 实施 | ❌ 未实现（feature flag 默认关闭） |
| `ENABLE_SEEDANCE_VIDEO_BYOK` 默认值 | `false`（env var 缺失时也为 false） |
| userCredential 是否进入 run-video | ❌ 不进入（videoJobRunner 不接受 userCredential，guard 在 Vercel 层拦截） |
| 手工发 `billingMode=user_provider_account` video 请求 | 返回 403 `VIDEO_BYOK_NOT_ENABLED` |
| cn-executor video logs | ✅ 已脱敏：无签名 URL slice，无 responseBody，只有 boolean 标志 |
| 平台 video 生成路径 | ✅ 完全不变（setupBilling / finalizeBilling 调用链路不变） |

### 验收结果（2026-06-04 静态核查通过）

| 验收项 | 结果 | 文件:行号 |
|---|---|---|
| `ENABLE_SEEDANCE_VIDEO_BYOK` 默认 false（env var 缺失时也为 false） | ✅ PASS | `route.ts:496` — `=== 'true'` 比较 |
| `billingMode=user_provider_account` 返回 403 `VIDEO_BYOK_NOT_ENABLED` | ✅ PASS | `route.ts:500-510`，guard 在任何 DB / billing 操作之前 |
| guard 未解密 UserProviderAccount / 未读 encryptedApiKey | ✅ PASS | guard 在 auth check 后立即返回 |
| cn-executor trigger body 仅含 `{ generationJobId }` — 无 userCredential | ✅ PASS | `route.ts:769` |
| Video 节点 UI 无"生成费用来源"选择器 | ✅ PASS | `VisualCanvasWorkspace.tsx:8245` — `(kind === 'text' \|\| kind === 'image')` |
| start log 含 `hasByokCredential: false`，无 key / Authorization | ✅ PASS | `videoJobRunner.ts:342` |
| task done log 改为 boolean 标志 `hasProviderVideoUrl: true` — 无签名 URL | ✅ PASS | `videoJobRunner.ts:470` |
| job completed log 改为 `hasStableVideoUrl: true` — 无 OSS URL | ✅ PASS | `videoJobRunner.ts:601` |
| seedance.ts submit log 无 responseBody | ✅ PASS | `seedance.ts:249-253` |
| seedance.ts poll log 无 responseBody | ✅ PASS | `seedance.ts:286-291` |
| 平台 video 路径不变（普通请求完全跳过 guard） | ✅ PASS | guard 仅对 `user_provider_account` 触发 |
| Text 生成路由未被修改 | ✅ PASS | `git log 3c2bab6..HEAD -- generate/text/route.ts` 无结果 |
| Image 生成路由未被修改 | ✅ PASS | `git log 3c2bab6..HEAD -- generate/image/route.ts` 无结果 |
| billing / credits / Prisma schema 未修改 | ✅ PASS | git diff 只含 4 个已记录文件 |
| prompt 明文不进日志 | ✅ PASS | safeLogVideoJob payload 无 prompt 字段 |
| imageUrl 不完整输出 | ✅ PASS | submittedInput 中用 `hasImageUrl: Boolean` 代替完整 URL |

### 安全边界确认

| 安全项 | 状态 |
|---|---|
| userCredential 不传入 cn-executor run-video | ✅ guard 在 Vercel 层 |
| API key 不写入 `generationJob.input` | ✅（BYOK 未实现，平台路径不含 key） |
| cn-executor logs 不含签名 URL / responseBody | ✅ |
| feature flag 缺失 env var 时默认关闭 | ✅ `=== 'true'` 比较，undefined → false |
| 平台 video 路径不变 | ✅ `billingMode` 未设置时完全跳过 guard |
| cn-executor 未动真实调用逻辑 | ✅ 只改日志，apiKey fallback 逻辑不变 |
| 未改 Prisma schema / migration / payment / billing / credits | ✅ |
| 未改 Text / Image 生成路由 | ✅ |
| 未改 Provider Account CRUD / UsageLog / Admin Dashboard | ✅ |

---

## Pricing / Service Credits Static Preview + AI Help Billing Knowledge Sync — CLOSED / validated

**Commit:** `5b07162`
**验收日期：** 2026-06-05
**验收方式：** 静态代码逐条核查（10/10 PASS）

### 验收结果

| 验收项 | 结果 |
|---|---|
| `/pricing-preview` 顶部展示「当前费用模式（实际生效）」4 张卡片 | ✅ PASS |
| 明确「平台服务费：当前未启用，显示为 0」 | ✅ PASS |
| 明确「我的 API：Provider 费用由用户直接支付，不赚差价」 | ✅ PASS |
| 明确「充值 credits ≠ 给 Provider 充值」 | ✅ PASS |
| 「当前不会发生的事」7 条列表（含"不扣平台积分"/"不代收"/"不赚差价"/"不自动续费"） | ✅ PASS |
| Service Credits 草案黄色警告横幅「未来商业化草案，当前未启用，不会扣费」 | ✅ PASS |
| 草案表格含 Text/Image/Video BYOK 三行，标注「草案（未启用）」 | ✅ PASS |
| 启用前提 8 条（含失败退款 / feature flag / 通知 / 30-60 天观察） | ✅ PASS |
| 费用 FAQ 7 问 7 答（覆盖任务要求全部问题） | ✅ PASS |
| 命令面板：`平台服务费` / `pricing` / `API Key 接入` / `我的 API` 可搜到对应页面 | ✅ PASS |
| AI 助手：能回答「我的API会扣费吗」「充值是给Provider吗」「平台服务费是什么」「普通用户需要Key吗」 | ✅ PASS |
| AI 助手：平台服务费答案包含「当前未启用/0/不扣」 | ✅ PASS |
| 安全检查：无 encryptedApiKey / Authorization / sk- / endpointId 明文泄露 | ✅ PASS |
| 业务边界：generate routes / credits / billing / payment / prisma / cn-executor 零修改（diff = 0 行） | ✅ PASS |
| type-check / lint（0 Error）/ build 全部通过 | ✅ PASS |

### 变更文件（仅静态文案 / AI 知识 / 搜索索引）

| 文件 | 改动 |
|---|---|
| `pricingPreviewData.ts` | 新增 currentFeeFacts / currentFeeNeverList / serviceCreditsDraftRows / serviceCreditsNoGoList / billingFaqItems |
| `PricingPreviewPage.tsx` | 新增 CurrentFeeModeSection / ServiceCreditsDraftSection / BillingFaqSection 三个 section（Hero 之后最优先展示） |
| `local-model.ts` | 新增 7 个 if-else 分支覆盖全部费用类问题 |
| `context.ts` | 新增 `/pricing-preview` 等 5 个页面上下文 |
| `palette.ts` | 新增 4 个命令面板搜索条目含 30+ 关键词 |

### 安全边界确认

- 未启用平台服务费 ✅
- 未改 billing / credits / payment / schema / 生成链路 ✅
- 未暴露任何敏感字段 ✅
- Platform service fee charging 仍 not implemented ✅

---

## Platform Service Fee Strategy Audit — CLOSED / read-only audit completed

**审计日期：** 2026-06-04
**审计性质：** 只读 — 零文件修改，零 commit，零 push

### 核心结论

**当前不启用平台服务费。** 继续观察 BYOK 用量 30–60 天后再决策。

### 当前状态确认

| 项目 | 状态 |
|---|---|
| `UsageLog.platformServiceFeeCredits` 字段 | ✅ 已存在于 Prisma schema（`Int @default(0)`） |
| 当前所有路径写入值 | 固定为 0（`usage-log.ts:63` 硬编码 `?? 0`） |
| 平台服务费扣费逻辑 | ❌ 无。`billing-middleware.ts` 完全未实现 service credits 检查 |
| UI 显示 | `/account/usage`、`/account/providers`、`/account/providers/[id]`、`/admin/usage` 均显示"未启用 / 0" |
| `/pricing-preview` 页面 | ✅ 存在，静态草案，标注为预览，未接导航，不代表最终定价 |
| Service credits wallet | ❌ 未实现，当前只有平台额度单一 wallet |
| CreditLedger service_fee 类型 | ❌ 未定义（现有类型：reserve/settle/release/refund/admin_adjustment） |
| 订阅数据模型 | ❌ 未实现，Prisma schema 无 Subscription 表 |
| Creator City 是否赚 API 差价 | ❌ 否。BYOK 路径平台零收入，Provider 费用由用户直接支付 |

### No-Go 条件（任何一项未满足则不得启用收费）

| No-Go 条件 | 当前状态 |
|---|---|
| 没有生成前价格展示 | ❌ 未实现 |
| 没有失败退款机制 | ❌ 未实现 |
| 没有清晰区分 Provider 费用和平台服务费 | ⚠️ 已有文案说明，但无账单级别区分 |
| 没有用户账单明细 | ❌ 未实现 |
| 没有管理员审计（admin usage）| ✅ 已有基础，但 platformServiceFeeCredits 全为 0 |
| 没有 feature flag | ❌ 未实现（参照 ENABLE_SEEDANCE_VIDEO_BYOK 模式） |
| 没有提前通知（至少 14 天）和免费过渡期 | ❌ 未实现 |
| 没有客服 / 争议处理渠道 | ❌ 未实现 |
| 会让用户误以为平台代收 Provider 费用 | ❌ 必须在每个扣费入口明确说明 |

### 推荐路线（只读设计，不实施）

| 阶段 | 内容 | 技术改动 |
|---|---|---|
| **Phase 0（当前）** | 继续免费 BYOK，用 `/admin/usage` 观察用量 30–60 天 | 无 |
| **Phase 1** | 服务费策略文档 + `/pricing-preview` 文案更新（不改 billing） | 仅静态 UI |
| **Phase 2** | Service credits 数据模型只读审计（`Wallet` 扩展方案 vs 新表） | 只读设计 |
| **Phase 3** | 前端生成前价格预览（显示"预计消耗 N 平台服务 credits，当前未收费"） | 仅 UI，不改 billing |
| **Phase 4** | 后台 `ENABLE_SERVICE_FEE_CHARGING` feature flag 配置，仍不扣费 | Feature flag only |
| **Phase 5** | 小范围内测扣费，必须先实现 reserve / settle / refund service fee | 完整 billing 改动 |
| **Phase 6** | 公开启用 + 14 天提前通知 + Free tier 免费配额 + 账单导出 | 通知 + 账单 API |
| **Phase 7** | 订阅套餐（Subscription 数据模型 + 支付集成） | 全新 subscription 系统 |

### 草案定价参考（仅供内部讨论，不实施，不承诺）

| 操作 | 草案 service credits |
|---|---|
| Text BYOK 1 次 | 0（建议免费，计算成本极低） |
| Image BYOK 1 次 | 1 service credit |
| Video BYOK 5s 1 次 | 5 service credits |
| Video BYOK 10s 1 次 | 10 service credits |
| 失败是否退还 | 全额退还 |
| Free tier 月免费配额 | 5 service credits / 月 |

### 安全边界确认

- 未修改任何功能代码、billing、credits、Prisma schema、payment ✅
- 未新增 API 路由或修改现有路由 ✅
- 未修改 UsageLog 写入逻辑（仍固定写 0） ✅
- 未修改 setupBilling / finalizeBilling / reserve / settle / refund ✅
- 未修改 cn-executor ✅

---

## Service Credits Data Model Audit — CLOSED / read-only audit completed

**审计日期：** 2026-06-05  
**审计性质：** 只读 — 零文件修改，零 commit，零 push

### 当前状态

| 项目 | 状态 |
|---|---|
| Service credits wallet | ❌ 未实现（当前只有 `UserCreditWallet`，无独立服务积分 wallet） |
| Subscription billing | ❌ 未实现（Prisma schema 无 `Subscription` 表） |
| Platform service fee charging | ❌ 未实现（`UsageLog.platformServiceFeeCredits` 固定为 0） |
| Prisma schema / migration 变更 | ❌ 未做 |
| `CreditLedger` service_fee 类型 | ❌ 未定义（现有类型：PURCHASE / BONUS / RESERVE / SETTLE / RELEASE / REFUND / ADMIN_ADJUSTMENT / EXPIRE） |
| `UserCreditWallet` walletType | ❌ 不存在（只有单一 wallet 结构，无 walletType 字段） |
| `CreditLedger` idempotencyKey | ❌ 不存在（仅 app-layer settle guard，无 DB UNIQUE 约束） |

### 推荐数据模型（Option B：独立 ServiceCreditWallet + ServiceCreditLedger）

**核心原则：**
- 新建 `ServiceCreditWallet` 表，与 `UserCreditWallet` 完全隔离
- 新建 `ServiceCreditLedger` 表，独立 reserve / settle / release / refund 语义
- `UserCreditWallet` 继续只处理平台模型 credits（代付 Provider API 费用）
- `idempotencyKey`（格式：`service_reserve:{generationJobId}:{attempt}`）加 UNIQUE 约束，实现 DB 层幂等
- `generationJobId` + `usageLogId` 双向关联，逐笔可审计

### 不推荐方案

| 方案 | 原因 |
|---|---|
| ❌ Option A：在 `UserCreditWallet` 加 `serviceBalance` 字段 | 两种业务语义混在同一 wallet 中，会计混乱，审计困难 |
| ❌ Option C：walletType 泛化 wallet | 过度设计，查询复杂，审计困难，无法清晰隔离 |
| ❌ Option D：只用 `UsageLog` 统计服务费 | 无法做 reserve / settle / refund，不适合真实收费场景 |
| ❌ Option E：先做 Subscription 订阅 | 用量不足，无法定价，架构跃进，暂无用户需求数据支撑 |

### No-Go 条件（任何一项未满足则不得启用服务费收费）

| No-Go 条件 | 当前状态 |
|---|---|
| `UserCreditWallet` 与 `ServiceCreditWallet` 不混用 | ❌ service credits 未实现，风险存在于设计阶段 |
| 每笔 service fee reserve 必须有 DB 层 idempotencyKey（UNIQUE 约束） | ❌ 未实现 |
| 失败时必须全额退还 service credits（refund 语义完整） | ❌ 未实现 |
| 生成前必须展示预计消耗（preflight price preview） | ❌ 未实现 |
| 必须有独立 `ServiceCreditLedger`（逐笔可审计） | ❌ 未实现 |
| 必须有 `ENABLE_SERVICE_FEE_CHARGING` feature flag（默认 false） | ❌ 未实现（参照 `ENABLE_SEEDANCE_VIDEO_BYOK` 模式） |
| 必须提前 14 天通知用户并提供免费过渡期 | ❌ 未实现 |
| 必须有 admin 级别 service credit 审计界面 | ❌ 仅基础 `/admin/usage`，无 service credit 专项视图 |
| 负余额防护（DB CHECK constraint 或 app-layer preflight + 事务） | ❌ 当前仅 app-layer check，无 DB CHECK constraint |

### 关键发现：视频异步计费结构性缺陷

当前 Vercel video route 在 `generationJobId` 创建后（12s timeout 内）同步调用 `finalizeBilling`，但视频实际生成由 cn-executor 异步执行（可能耗时数分钟）。若未来视频 service fee 依赖 Next.js 侧 `finalizeBilling` 模式，**计费将在实际生成完成前就 settle**，导致无论成功/失败都已扣费。实施视频 service fee 时，必须先评审 cn-executor 主动回调 settle/release 的方案，不能沿用现有同步 finalizeBilling 路径。

### 迁移阶段建议（只读设计，当前不实施）

| 阶段 | 内容 | 约束 |
|---|---|---|
| **M0（当前）** | 继续免费 BYOK，用 `/admin/usage` 观察用量 30-60 天，无任何 schema 变更 | 只读 |
| **M1** | 新建 `ServiceCreditWallet` + `ServiceCreditLedger` 表，零业务逻辑 | 只加表，不写数据 |
| **M2** | 生成路由中懒创建 ServiceCreditWallet（balance=0），写 UsageLog 关联 `serviceWalletId` | 无扣费 |
| **M3** | Admin 手动 grant service credits（测试账户），验证 ledger 结构 | 仅后台操作 |
| **M4** | 前端展示 service credits 余额（只读 UI，不影响生成流程） | 仅 UI |
| **M5** | `ENABLE_SERVICE_FEE_CHARGING` feature flag 内测（小范围真实扣费） | 完整 reserve / settle / refund |
| **M6** | 公开启用 + 14 天提前通知 + Free tier 免费配额 + 账单导出 | 通知 + 账单 API |

### 下一步建议

- **当前**：继续观察 BYOK 用量 30-60 天，不做 schema migration，不做 service fee 扣费
- **可选（下阶段）**：Admin 模拟服务积分视图（只读报表，UsageLog × 草案费率，不真实扣费）— 最低风险的下一步
- **不建议**：立刻进入 M1（新表），无用量数据支撑时无法验证草案费率是否合理
- **禁止**：不经 9 项 no-go 条件全部满足就启用任何 service fee 扣费逻辑

### 安全边界确认

- 未修改任何功能代码、billing、credits、Prisma schema、payment ✅
- 未新增 API 路由或修改现有路由 ✅
- 未修改 UsageLog 写入逻辑（仍固定写 0）✅
- 未修改 setupBilling / finalizeBilling / reserve / settle / refund ✅
- 未修改 cn-executor ✅

---

## Next Phase Tasks (priority order)

1. ~~**Phase V1：多字段凭证结构扩展** — ✅ DONE / production validated (commit `14a763d`)~~

2. ~~**Phase V2：Seedream Image BYOK 试点** — ✅ CLOSED / validated (commit `c6ff87f`, validated 2026-06-03)~~

3. **Phase V3：Seedance Video BYOK 安全方案评审 — ✅ 评审完成，实施暂缓**
   - 评审结论：推荐 Option A（Vercel 解密 → HTTPS 传给 cn-executor，镜像 Image BYOK 路径）
   - 不推荐：cn-executor 持有 `PROVIDER_KEY_ENCRYPTION_SECRET` / 直连 `UserProviderAccount` / 写入 `generationJob.input`
   - ✅ **前提条件 1 已完成**：cn-executor safe logging + video route feature flag skeleton (commit `3c2bab6`)
   - 暂缓原因：平台 key 已可正常生成视频；BYOK 是 power user 成本优化，优先级低于稳定性
   - 启动前提：设置 `ENABLE_SEEDANCE_VIDEO_BYOK=true` 并实施 videoJobRunner userCredential 接收逻辑
   - 详见：文件内「Seedance Video BYOK Security Review」章节

4. **Phase V4：其他单 API Key 图片/视频 Provider BYOK**
   - Runway 等 Vercel-side 单 Bearer Token Provider
   - 依赖 Phase V2 链路验证

5. ~~**Phase V5：BYOK 平台服务费记录 / usage logging** — ✅ DONE as Phase S1 (commit `d693f71`, validated 2026-06-03)~~

6. ~~**独立 API Key 帮助页 `/help/api-keys`** — ✅ DONE / browser validated (commit `35185b4`, validated 2026-06-04)~~

7. **Platform Service Fee Phase 0：持续观察 BYOK 用量（P2）**
   - ✅ 已完成：平台服务费策略只读审计（结论：当前不启用）
   - ✅ 已完成：Pricing / Service Credits 静态文案预览包（`/pricing-preview` + AI 帮助费用知识同步，`5b07162`）
   - ✅ 已完成：Service Credits 数据模型只读审计（推荐 Option B；9 项 no-go 条件；M0-M6 迁移阶段；当前继续观察）
   - 用 `/admin/usage` 每周观察 BYOK 调用量、用户分布、成功率
   - 判断门槛：BYOK 用量比例 > 30% 且高频用户 ≥ 50 人后再考虑启用
   - **下一步可做**：Admin 模拟服务积分视图（只读报表，UsageLog × 草案费率，不真实扣费，不改 schema）

8. **错误提示产品化（P2）**
   - 去除剩余 `errorCode:`/`provider_*:` 前缀（OSS/media 类还有残留）

9. **NEXT_PUBLIC_API_URL / billing webhook（P2，单独排期）**
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

Modules confirmed working as of `8119eb0`:

- Canvas node CRUD (add / edit / delete / drag / connect)
- Image generation chain (prompt → POST → poll → display)
- Video generation chain (prompt → POST → poll → display)
- Text generation chain (DeepSeek default, Kimi, OpenAI fallback)
- Text generation — platform credits mode (unchanged, original logic)
- Text generation — BYOK mode (DeepSeek / OpenAI / Kimi via user's own API Key)
- Image generation — BYOK mode (Seedream via user's Volcengine Ark API Key + Endpoint ID) [✅ browser validated 2026-06-03]
- UsageLog Phase S1 — BYOK + platform_credits usage recording (Text + Image, no fee deduction)
- Admin Usage Dashboard — `/admin/usage` read-only view (total, byok, platform_credits, success rate, provider distribution, top users, recent logs) [✅ browser validated 2026-06-03]
- Canvas save / load (PUT/GET with localStorage draft fallback)
- Canvas save 503 backoff (10s, no cascade)
- Media proxy (`/api/media/proxy`) for cross-region OSS display
- Session auth (Supabase + Prisma, with pgBouncer pool guard)
- Session persistence on transient DB error (no spurious logout)
- Provider quota error → friendly Chinese message + DeepSeek CTA
- Asset failure panel → friendly titles + `/assets` recovery link
- DeepSeek as default text provider for new nodes
- `/assets` page listing all generated assets with recovery status
- Customer delivery share URL follows `NEXT_PUBLIC_APP_URL` (CN-safe)
- `/account/providers` — 模型账户中心：CRUD + test connection + BYOK management + capability matrix + 3-mode billing explanation [✅ browser validated 2026-06-03]
- `/account/providers` auth guard — Zustand session shown immediately; server check async; unknown+no-session shows retry UI [✅ browser validated 2026-06-04]
- `/account/providers/[id]` — Provider Account Detail: identity + health status + masked credentials (last4 / fieldMeta) + 90-day usage summary + recent 20 call log; userId+providerAccountId double-scope; no key/prompt exposure; UsageLog graceful degradation [✅ browser validated 2026-06-04]
- `/api/provider-accounts/[id]/summary` — read-only summary API; safe fields only; ownership enforced; UsageLog failure returns usageSummaryUnavailable:true [✅ browser validated 2026-06-04]
- `/account/usage` — User Usage History: time/billing/type filters, summary cards, distribution panels, recent log table; userId-scoped; no prompt/key exposure [✅ browser validated 2026-06-04]
- User avatar dropdown → "生成用量" direct entry [✅ browser validated 2026-06-04]
- Provider API Key guide in canvas help panel (4-tab, 18 providers)
- AI Agent floating button — API Key keyword replies + quick actions
- `/account` — 3-mode billing legend (平台额度 / 我的 API / 平台服务费) below quick-links grid [✅ validated 2026-06-04]
- `/account/credits` — clarification box above WalletBalanceCard: platform credits only; BYOK Provider fees paid direct to vendor; service fee = 0/未启用 [✅ validated 2026-06-04]
- `/account/providers/[id]` — Health Guidance: getHealthExplanation (secondary text below health.message) + getRepairTips 建议操作 section (auth/quota/endpoint/timeout/unsupported/high-fail coverage; links to /help/api-keys and /projects) [✅ validated 2026-06-04]
- `/account/providers` — Health hint chips on abnormal accounts (auth_failed→请检查 API Key, quota→请检查 Provider 余额, missing endpointId→请补充接入点 ID, high fail rate→最近有失败记录); normal accounts show no chip [✅ validated 2026-06-04]
- `/help/api-keys` — FAQ section renamed "出错了怎么办？"; 3 new entries (Seedream unsupported test, timeout, BYOK service fee clarification) [✅ validated 2026-06-04]
- cn-executor video logs — sanitized via `safeLogVideoJob`; no signed URL slices, no responseBody; `hasByokCredential: false` in start log [✅ validated 2026-06-04]
- Video BYOK feature flag — `ENABLE_SEEDANCE_VIDEO_BYOK` (defaults false when env var absent); requests with `billingMode=user_provider_account` rejected with 403 `VIDEO_BYOK_NOT_ENABLED` [✅ validated 2026-06-04]
