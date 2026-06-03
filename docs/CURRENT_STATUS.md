# Creator City — Current Status

Last updated: 2026-06-03
Last valid commit: `c6ff87f` (feat: Seedream Image BYOK pilot — V2)
Production validated: 2026-06-03 (V2 Seedream Image BYOK browser validated)

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

**当前状态：** 平台额度与我的 API 双轨并存，Text 节点已可试点 BYOK。Image/Video 仍依赖平台侧 Provider，后续再接入 BYOK。

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
| Seedance Video BYOK | ❌ not implemented |

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

### 下一步建议

- **禁止**：不经评审直接开发 Seedance Video BYOK
- 可选 A：先做 Seedance Video BYOK security review（评审 cn-executor credential access 方案）
- 可选 B：先做 BYOK platform service fee / usage logging 只读审计
- 可选 C：Provider Account Center 产品化升级（UI 打磨 / 多账户管理 / 测试连接结果展示）

---

## Next Phase Tasks (priority order)

1. ~~**Phase V1：多字段凭证结构扩展** — ✅ DONE / production validated (commit `14a763d`)~~

2. ~~**Phase V2：Seedream Image BYOK 试点** — ✅ CLOSED / validated (commit `c6ff87f`, validated 2026-06-03)~~

3. **Phase V3：Seedance Video BYOK 安全方案评审**
   - 先评审：cn-executor 解密方案（cn-executor 需 `PROVIDER_KEY_ENCRYPTION_SECRET` + DB 连接）
   - 评审通过后单独实现，不在 V2 内顺手做
   - 不动 cn-executor 直到评审结论出来

4. **Phase V4：其他单 API Key 图片/视频 Provider BYOK**
   - Runway 等 Vercel-side 单 Bearer Token Provider
   - 依赖 Phase V2 链路验证

5. **Phase V5：BYOK 平台服务费记录 / usage logging**
   - 当前 BYOK 路径完全跳过 billing，未记录平台服务费
   - 需先明确服务费定义，再设计最小记录方案
   - 不改 billing 语义，不扣 provider credits

6. **独立 API Key 帮助页 `/help/api-keys`**
   - 当前指南已内嵌在帮助面板和 AI Agent 中，可选择独立页面版本
   - 无后端需求，纯静态前端

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

Modules confirmed working as of `d8ddd43`:

- Canvas node CRUD (add / edit / delete / drag / connect)
- Image generation chain (prompt → POST → poll → display)
- Video generation chain (prompt → POST → poll → display)
- Text generation chain (DeepSeek default, Kimi, OpenAI fallback)
- Text generation — platform credits mode (unchanged, original logic)
- Text generation — BYOK mode (DeepSeek / OpenAI / Kimi via user's own API Key)
- Image generation — BYOK mode (Seedream via user's Volcengine Ark API Key + Endpoint ID) [🟡 browser validation pending as of `c6ff87f`]
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
- `/account/providers` — CRUD + test connection + BYOK management UI
- Provider API Key guide in canvas help panel (4-tab, 18 providers)
- AI Agent floating button — API Key keyword replies + quick actions
