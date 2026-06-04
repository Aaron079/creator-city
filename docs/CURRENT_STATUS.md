# Creator City — Current Status

Last updated: 2026-06-04
Last valid commit: `4347465` (clarify account billing and byok messaging)
Production validated: 2026-06-04 (User Usage History browser validated · Provider Account Center auth blank screen fix validated · Seedance Video BYOK security review completed · Provider API Key Guide browser validated · Provider Account Usage Summary browser validated · Provider Account Detail / Health Status browser validated · Subpage Navigation Polish browser validated · Provider Account Center UX Polish Batch validated · Account / Billing / BYOK Messaging validated)

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

**当前状态：** Creator City 已形成"平台额度 + 我的 API 账户 + 用量记录 + 用户端/管理员端可视化 + API Key 教程 + 单账户用量汇总 + 账户详情/健康状态 + 子页面返回体验 + 账户管理 UX 全面 polish + 账号/积分/BYOK 费用模式说明统一"的 BYOK 基础闭环。Provider Account Center 已从 API 账户列表升级为更完整的用户可理解账户管理体验：用户能接入、理解、查看用量、查看详情、看健康状态、找到教程，并能从菜单/搜索快速进入关键页面。/account 页面已在快捷入口下方统一展示三种费用模式说明；/account/credits 页面已明确区分平台 credits 与 Provider 直付费用，防止用户误解。当前不赚 API 差价，不启用平台服务费扣费。Seedance Video BYOK 实施仍暂缓。

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
| Seedance Video BYOK 安全评审 | ✅ read-only audit completed |
| Seedance Video BYOK | ❌ not implemented（安全评审已完成，推荐方案 Option A，暂缓实施） |
| Platform service fee charging | ❌ not implemented |

**下一步商业优先级（2026-06）：** 继续观察用量数据（admin 已可实时看到 BYOK vs 平台额度分布），30–60 天后再制定服务费策略。下一阶段可做：Provider Account Center 后续迭代（更多 Provider 教程、账号健康建议、错误修复引导）、Seedance Video BYOK feature flag skeleton / safe logging prework、或平台服务费策略审计。暂不直接启用服务费扣费，暂不启动 Seedance Video BYOK 实施。

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

## Next Phase Tasks (priority order)

1. ~~**Phase V1：多字段凭证结构扩展** — ✅ DONE / production validated (commit `14a763d`)~~

2. ~~**Phase V2：Seedream Image BYOK 试点** — ✅ CLOSED / validated (commit `c6ff87f`, validated 2026-06-03)~~

3. **Phase V3：Seedance Video BYOK 安全方案评审 — ✅ 评审完成，实施暂缓**
   - 评审结论：推荐 Option A（Vercel 解密 → HTTPS 传给 cn-executor，镜像 Image BYOK 路径）
   - 不推荐：cn-executor 持有 `PROVIDER_KEY_ENCRYPTION_SECRET` / 直连 `UserProviderAccount` / 写入 `generationJob.input`
   - 实施前提：先完成 cn-executor safe logging + request redaction 基础
   - 实施前提：需要 feature flag skeleton（视频生成链路改动风险高）
   - 暂缓原因：平台 key 已可正常生成视频；BYOK 是 power user 成本优化，优先级低于稳定性
   - 详见：文件内「Seedance Video BYOK Security Review」章节

4. **Phase V4：其他单 API Key 图片/视频 Provider BYOK**
   - Runway 等 Vercel-side 单 Bearer Token Provider
   - 依赖 Phase V2 链路验证

5. ~~**Phase V5：BYOK 平台服务费记录 / usage logging** — ✅ DONE as Phase S1 (commit `d693f71`, validated 2026-06-03)~~

6. ~~**独立 API Key 帮助页 `/help/api-keys`** — ✅ DONE / browser validated (commit `35185b4`, validated 2026-06-04)~~

7. **错误提示产品化（P2）**
   - 去除剩余 `errorCode:`/`provider_*:` 前缀（OSS/media 类还有残留）

8. **NEXT_PUBLIC_API_URL / billing webhook（P2，单独排期）**
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
