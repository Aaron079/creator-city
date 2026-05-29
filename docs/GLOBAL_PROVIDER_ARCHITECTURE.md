# Global Provider Architecture

> **Status**: Architecture draft — read-only planning document. No code has been written or committed.
> **Boundary**: P0-BOUNDARY-LOCK-ACTIVE applies. Forbidden Zone files untouched.

---

## 1. 总体目标

Creator City 同时支持 CN Providers 和 Global Providers，但两条链路**严格隔离**：

```
CN链路:   CN Provider → Aliyun FC (cn-executor) → Aliyun OSS → canvas stableUrl
Global链路: Global Provider → Vercel Route (local) → Global Storage → canvas stableUrl
```

禁止：
- 国外 API 混入 cn-executor
- 中国 API 走 global route
- 破坏现有 Seedream / Seedance / Image-to-Video 工作流

---

## 2. 当前系统状态（审计结论）

### 2.1 Provider Registry（已有）

系统有**三层** registry：

| Registry | 文件 | 用途 |
|----------|------|------|
| `ADMIN_PROVIDER_REGISTRY` | `lib/provider-management/index.ts` | Admin 面板管理、env check、toggle |
| `PROVIDER_REGION_REGISTRY` | `lib/regions/registry.ts` | 路由决策（cn vs global executor） |
| `TOOL_PROVIDERS` catalog | `lib/tools/provider-catalog.ts` | 前端 provider 下拉/工具页展示 |

### 2.2 当前每个 Provider 的字段结构

**ADMIN_PROVIDER_REGISTRY** 中的字段（无 region 三元组，由 regions/registry 推导）：

```typescript
type AdminProviderDefinition = {
  providerId: string       // e.g. 'volcengine-seedream-image'
  displayName: string
  capability: AdminProviderCapability[]  // ['Image'], ['Video', 'Text-to-Video'], etc.
  category: string         // 'China' | 'Image' | 'Video' | 'Text' | 'Storage' | 'Payment'
  envKeys: string[]        // required env vars
  optionalEnvKeys?: string[]
  nodeType: string         // 'image' | 'video' | 'text' | 'storage' | 'payment'
  defaultModel?: string
  modelEnvKey?: string     // env var that holds the model name
  defaultBaseUrl?: string
  baseUrlEnvKey?: string
  creditsPerCall?: number
  estimatedCostUsd?: number
  testMode?: 'env-only'
  providerFamily?: 'china-ai'   // 注：仅 CN providers 有此标记
  setupHint: string
}
```

**PROVIDER_REGION_REGISTRY** 中的字段（路由决策用）：

```typescript
type ProviderRegionConfig = {
  id: ProviderAdapterId      // e.g. 'volcengine_seedream'
  region: 'cn' | 'global'   // 决定走哪个 executor
  availability: 'active' | 'future'  // 'future' = 已注册但未激活
  runtimeProviderIds: string[]  // 别名映射 (e.g. ['volcengine-seedream-image'])
  label: string
  notes?: string
}
```

**executorKind / storageRegion 不在 Registry 中**，由 region 推导：
- `region='cn'` → executorKind=`aliyun_fc`, storageRegion=`cn`
- `region='global'` → executorKind=`vercel`, storageRegion=`global`

### 2.3 Image Provider 如何被前端选择

1. 前端 GET `/api/generate/image` → 返回 `providers[]` + `defaultProviderId`
2. providers 来自 `ADMIN_PROVIDER_REGISTRY` 按 `IMAGE_PROVIDER_ORDER` 过滤
3. default = 第一个 `available=true` 的 `volcengine-seedream-image`
4. 用户从 `CanvasPromptBox` 下拉选择 providerId
5. POST `/api/generate/image` 带 `{ providerId, prompt, ... }`

### 2.4 Video Provider 如何被前端选择

与 image 相同模式，default = 第一个可用的 `volcengine-seedance-video`

### 2.5 Global Provider 占位现状

`ADMIN_PROVIDER_REGISTRY` 已有 global provider 条目：
- `openai-text`, `openai-image`, `openrouter-text`
- `fal-image`, `fal-video`, `replicate-image`, `replicate-video`
- `creator-video-gateway`, `custom-video-gateway`

`PROVIDER_REGION_REGISTRY` 已注册（availability: **future**）：
- `openai`, `runway`, `replicate`, `fal`, `stability`, `google`, `midjourney`, `kling_global`

`STORAGE_REGION_REGISTRY` 已注册（availability: **future**）：
- `s3`, `cloudflare_r2`, `vercel_blob`

### 2.6 Executor Gateway 如何判断 CN / Global

```
getExecutorForProvider(providerId)
  → resolveProviderRegionInfo(providerId)
    → normalizeProviderAdapterId(providerId)  // 别名 → ProviderAdapterId
    → PROVIDER_REGION_REGISTRY[id].region
  → if 'cn':  executor = CREATOR_CN_API_BASE_URL (aliyun_fc)
  → if 'global': executor = CREATOR_GLOBAL_API_BASE_URL (vercel)
  → unknown: defaults to 'global', unknownProvider=true
```

### 2.7 Global Provider 被选中时会发生什么（当前）

当用户选择 `openai-image` 且 `CREATOR_GLOBAL_API_BASE_URL` **未设置**：

1. `getExecutorForProvider('openai-image')` → region='global', executor='none'
2. Image route `else` 分支（非 cn executor）执行
3. 检查 `providerRegion === 'cn'` → false，继续
4. 调用 `gatewayGenerate()` → `runGenerate()` → 查 `ADAPTER_MAP`
5. `openai-images` adapter **已注册** → `openaiImagesAdapter.generateImage()` 在 Vercel 直接执行
6. OpenAI 返回 base64 或 URL
7. `persistGeneratedMedia()` → **上传到 Aliyun OSS**（CN storage，跨区）
8. `stableUrl` = Aliyun OSS URL，写回 canvas node

**结论**: OpenAI Image 今天已经可以工作（前提: `OPENAI_API_KEY` 已配置），但结果存到 CN OSS（跨区，V1 可接受）。

当 `CREATOR_GLOBAL_API_BASE_URL` **已设置** 时：
- executor-gateway 会 forward 到该 URL（但该 URL 可能不存在）
- 这是为未来独立 global executor 预留的，目前不使用

### 2.8 CREATOR_GLOBAL_API_BASE_URL 引用情况

- `lib/executors/executor-gateway.ts` — 读取并路由视频/图片到 global executor
- `app/api/admin/p0-media-debug/route.ts` — 诊断报告
- 当前环境**未设置** → global providers 走 Vercel-local 直接执行

### 2.9 现有 Global Provider 代码痕迹

| Provider | Admin Registry | Region Registry | Adapter | 可用性 |
|----------|---------------|-----------------|---------|--------|
| OpenAI Text | ✅ openai-text | ✅ future | ✅ openai.ts | 待 API key |
| OpenAI Images | ✅ openai-image | ✅ future | ✅ openai.ts (openai-images) | 待 API key |
| Runway | ❌ 无 | ✅ future | ✅ runway.ts | 待 RUNWAY_API_KEY |
| fal.ai | ✅ fal-image/video | ✅ future | ❌ 无 | 需要写 adapter |
| Replicate | ✅ replicate-image/video | ✅ future | ❌ 无 | 需要写 adapter |
| Luma | ❌（旧 V1 系统） | ❌ | ❌ 新 adapter 无 | 需要写 adapter |
| Stability | ❌ | ✅ future | ❌ | 需要写 adapter |
| Google/Gemini | ❌ | ✅ future | ❌ | 需要写 adapter |

**重要**: Runway 已有完整 adapter（含 `generateVideo` + `getJob` + `cancelJob`），仅缺 admin registry 条目和 env 配置。

### 2.10 生成结果如何变成 stableUrl

**CN 路径（已验证稳定）**:
```
cn-executor (Aliyun FC)
  → 调用 Volcengine/Jimeng API
  → 下载媒体文件
  → 上传到 Aliyun OSS
  → PUT /api/canvas/<project>/update-node { stableUrl, resolvedUrl }
  → canvas node metadataJson.stableUrl = "https://oss.xxx.aliyuncs.com/..."
```

**Global 路径（当前: V1 跨区）**:
```
Vercel route (local)
  → 调用 OpenAI/Runway API
  → 下载媒体文件
  → 上传到 Aliyun OSS（跨区）
  → canvas node update (DB)
  → stableUrl = Aliyun OSS URL
```

### 2.11 Global Output 存储现状

`STORAGE_REGION_REGISTRY` 已有全局存储占位：
- `s3`: availability='future'
- `cloudflare_r2`: availability='future'
- `vercel_blob`: availability='future'

`lib/assets/storage-adapter.ts` 的 `CanonicalStorageProvider` 类型已包含 `'vercel_blob'` 和 `'s3'`，但实现层目前只有 `lib/storage/china/` (Aliyun OSS + Tencent COS)。

---

## 3. Region 三元组标准

每个 provider 必须声明（通过 PROVIDER_REGION_REGISTRY 推导）：

| 字段 | CN Provider | Global Provider |
|------|-------------|-----------------|
| `providerRegion` | `cn` | `global` |
| `executionRegion` | `cn` | `global` |
| `storageRegion` | `cn` (Aliyun OSS) | `global` (V1: Aliyun OSS，V2: R2/Blob/S3) |
| `executorKind` | `aliyun_fc` | `vercel` |

示例 — 当前 CN:
```
volcengine_seedance:
  providerRegion: cn
  executionRegion: cn
  storageRegion: cn
  executorKind: aliyun_fc
```

示例 — 未来 Global:
```
openai:
  providerRegion: global
  executionRegion: global
  storageRegion: global
  executorKind: vercel
```

---

## 4. Provider 类型分层

### Text / Agent

| Provider ID | 用途 | Adapter 状态 |
|-------------|------|-------------|
| `openai-chat-agent` | 通用对话、Prompt 优化 | ✅ openai.ts 基础已有 |
| `openai-prompt-agent` | Prompt 增强 | 可复用 openai.ts |
| `openai-storyboard-agent` | 分镜生成 Agent | 待实现 |
| `openai-asset-analysis-agent` | 素材分析 | 待实现 |

### Image

| Provider ID | 用途 | Adapter 状态 |
|-------------|------|-------------|
| `openai-image` | gpt-image-1 图片生成 | ✅ openai.ts `openai-images` |
| `openai-image-edit` | 图片编辑（inpaint/restyle） | ⚠️ 需官方文档确认 |
| `stability-image` | Stability 图片生成 | ❌ 待 adapter |
| `stability-edit` | Stability 编辑 | ❌ 待 adapter |
| `fal-image` | fal.ai 图片（多模型） | ❌ 待 adapter |
| `replicate-image` | Replicate 图片（多模型） | ❌ 待 adapter |

### Video

| Provider ID | 用途 | Adapter 状态 |
|-------------|------|-------------|
| `runway-video` | Gen-4 Turbo text/image-to-video | ✅ runway.ts 完整 |
| `luma-video` | Dream Machine video | ❌ 待 adapter（有旧 V1 代码） |
| `kling-global-video` | Kling Global API | ❌ 待 adapter |
| `fal-video` | fal.ai 视频（多模型） | ❌ 待 adapter |
| `replicate-video` | Replicate 视频 | ❌ 待 adapter |

### Future

| Provider ID | 用途 | 备注 |
|-------------|------|------|
| `google-nano-banana-image` | Gemini Nano Banana 图片生成 | ⚠️ 待官方文档确认 endpoint |
| `google-nano-banana-edit` | Gemini 图片编辑 | Phase 5 |

---

## 5. Adapter Interface 草案

> 不要实现，仅定义接口形状。

### GlobalTextAgentAdapter

```typescript
interface GlobalTextAgentInput {
  prompt: string
  systemPrompt?: string
  projectContext?: {
    projectId: string
    nodeId?: string
  }
  nodeContext?: Record<string, unknown>
  maxTokens?: number
  structured?: boolean  // if true, request JSON output
}

interface GlobalTextAgentOutput {
  text: string
  structuredJson?: unknown
  model: string
  providerRaw?: unknown
  tokensUsed?: number
}
```

### GlobalImageAdapter

```typescript
interface GlobalImageInput {
  prompt: string
  aspectRatio: string           // '16:9' | '1:1' | '9:16' | '4:3' | '3:4'
  imageUrl?: string             // for image-to-image / inpaint / restyle
  maskUrl?: string              // for inpaint
  mode: 'text-to-image' | 'image-to-image' | 'inpaint' | 'restyle'
  projectId?: string
  nodeId?: string
}

interface GlobalImageOutput {
  imageUrl?: string             // https URL or omitted
  imageBase64?: string          // base64 if no URL (e.g. gpt-image-1)
  mimeType: string              // 'image/png' | 'image/jpeg' | 'image/webp'
  width?: number
  height?: number
  model: string
  providerRaw?: unknown
}
```

### GlobalVideoAdapter

```typescript
interface GlobalVideoInput {
  prompt: string
  imageUrl?: string             // for image-to-video
  duration: number              // seconds
  aspectRatio: string           // '16:9' | '9:16' | '1:1'
  resolution?: string           // '720p' | '1080p'
  mode: 'text-to-video' | 'image-to-video'
  projectId?: string
  nodeId?: string
}

interface GlobalVideoOutput {
  videoUrl?: string             // direct URL (async providers return after polling)
  taskId?: string               // for async polling
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  model: string
  providerRaw?: unknown
}
```

---

## 6. Storage Strategy

### 方案 A：Global output 上传 Aliyun OSS（当前 V1 路径）

**优点**:
- `stableUrl` / `media proxy` / canvas display 逻辑无需改动
- `persistGeneratedMedia()` 已支持，零额外代码
- OSS accelerate 对中国用户友好

**缺点**:
- 国外 provider 生成 → 中国 OSS 跨区上传（增加延迟 200-800ms）
- 长期不符合全球链路最佳实践
- 如果 OSS 配置失败，global generation 也失败

### 方案 B：Global output 上传 Cloudflare R2 / Vercel Blob / S3

**优点**:
- global provider → global storage，链路合理
- 海外用户访问快
- 符合未来双区架构

**缺点**:
- 需要新增 env（`BLOB_READ_WRITE_TOKEN` 或 `R2_*`）
- 需要实现 global storage adapter（`lib/storage/global/`）
- `media proxy` allowlist 需要扩展
- `resolveAssetUrl()` 需要新增 global URL 处理
- 增加运维复杂度

### 方案 C：V1 先返回 provider URL，不转存

**优点**: 最快，无 storage 代码

**缺点**:
- Provider URL 可能 15 分钟 ~ 24 小时后过期（OpenAI URL TTL 约 1 小时）
- 不可作为长期资产
- 不符合 Creator City 资产系统（无 stableUrl → canvas reload 后媒体丢失）

### 推荐方案

**V1 采用方案 A（跨区 OSS）**，原因：
1. 今天已经运行（OpenAI Image 生成已走此路径）
2. 改动量为零，不破坏现有守则
3. 上传延迟可接受（Vercel → Aliyun OSS 约 200-500ms，不阻塞用户）
4. 资产系统完整（stableUrl 持久化，canvas reload 安全）

**V2（Phase 3+）考虑方案 B**：
- 当全球用户量增长后，迁移 global output → Vercel Blob
- `Vercel Blob` 最容易：已在 Vercel 环境，只需 `BLOB_READ_WRITE_TOKEN`
- 优先于 R2 和 S3（减少第三方账户数量）

---

## 7. 安全边界

### API Key 安全

- 所有 API key 只存在 server side（Vercel env vars）
- 禁止在 API 响应中返回 key、model endpoint、或原始 API URL
- 前端只知道 `providerId`，不知道 key 或 model 名

### SSRF 防护

- `imageUrl` / `videoUrl` 输入必须通过 `assertProviderReadableImageUrl()` 验证（已有）
- 只允许 `https://` URL
- 只允许已知 media host（OSS domain、Vercel Blob domain、R2 domain）或内部 stableUrl
- 禁止 `data:` URI、`localhost`、内网 IP 传入 provider

### 资产隔离

- Provider output 必须转存 stable storage（方案 A: OSS）
- 不覆盖原资产，只生成新 asset / 新节点（现有守则，继续保持）
- Global provider 不得调用 cn-executor
- CN provider 不得走 global route（image route 已有硬检查：`provider_region_mismatch`）

### 错误透明度

- Provider failure 必须保留真实 errorCode + provider message
- 禁止被 "asset missing" 或通用 500 覆盖
- upstreamStatus + upstreamMessage 必须透传到前端（现有机制，保持）

---

## 8. UI 接入位置

### OpenAI / ChatGPT Text

位置：
- 内部 Agent 调用链（不加新按钮）
- Prompt 优化（可在 CanvasPromptBox 加"优化"图标，Phase 2）
- 分镜 Agent（未来工作流节点）
- 素材分析 Agent（节点 inspector panel）
- 节点诊断 Agent（错误展示层的"分析问题"按钮）

**V1 不加 UI**，在 server route 内部验证 adapter 可用性。

### OpenAI Images / Stability / fal / Replicate

位置：
- Image 节点 provider 下拉（canvas prompt dialog）→ 已有下拉，只需出现在 `getImageProviderRows()`
- 不加新按钮或 toolbar（Phase 2 之后考虑）

### Runway / Luma / Kling Global / fal video / Replicate video

位置：
- Video 节点 provider 下拉（canvas prompt dialog）→ 同上
- Image → Video workflow 的 global provider 选项（已有 imageUrl injection，只需 provider 出现在列表）
- 生成新视频节点，不覆盖原视频（现有守则，保持）

---

## 9. 接入顺序建议

### Phase 1：OpenAI Text Agent

**目标**: 验证 global text API 链路  
**工作量**: 极小（adapter 已有，只需 server route）  
**风险**: 低（纯文本，无媒体文件，无 OSS 依赖）  
**原因**: 
- 不处理大文件
- 不涉及 storage
- 适合作为 Prompt 优化 / Storyboard / Asset Analysis Agent 底座
- API key 配置一次，后续 Phase 共用

**需要**:
- `apps/web/src/app/api/agents/text/route.ts`（新增，非 Forbidden Zone）
- `OPENAI_API_KEY` env（已有 admin registry 条目，只需配置）
- 确认官方文档：Chat Completions 当前推荐 endpoint 和 model

### Phase 2：OpenAI Images

**目标**: 验证 global image 生成链路 + OSS 转存  
**工作量**: 极小（adapter 已完整，OSS 转存已有）  
**风险**: 低（同步返回，无 polling）  
**原因**: 
- 验证 global output → Aliyun OSS 跨区存储路径
- 验证 stableUrl 在 canvas 正确显示
- 为后续图片编辑 API 打基础

**需要**:
- `OPENAI_API_KEY` 配置
- 确认官方文档：当前推荐 model（gpt-image-1 vs DALL-E 3）和 response_format
- `openai-image` 出现在 `IMAGE_PROVIDER_ORDER`（image route 当前 order 需确认）

### Phase 3：fal.ai 或 Replicate（图片聚合）

**目标**: 验证多模型聚合 + 白名单控制  
**工作量**: 中（需要写 adapter，需要确认 API 格式）  
**风险**: 中（模型众多，需要白名单；fal/Replicate 模型质量和许可证差异大）  
**原因**:
- 聚合多模型适合扩展 provider marketplace
- 但必须只暴露白名单模型，不允许用户自填 model ID

**需要**:
- 官方文档确认 fal.ai client API 和 Replicate prediction API
- `FAL_KEY` / `REPLICATE_API_TOKEN` env
- 新增 `apps/web/src/lib/providers/adapters/fal.ts`
- 新增 `apps/web/src/lib/providers/adapters/replicate.ts`
- 模型白名单（写在 adapter 内，不暴露到前端）

### Phase 4：Runway / Luma / Kling Global（视频）

**目标**: 验证 global async 视频生成 + polling  
**工作量**: 中-高（视频异步，需要 polling route，Runway adapter 已有但需接入 job system）  
**风险**: 高（成本高、任务时间长、失败形态复杂）  
**原因**:
- 视频 API 成本高（Runway Gen-4 约 $0.05/s）
- 必须沿用无前端硬超时策略（已有 while(!signal.aborted) 模式）
- Runway adapter 已完整（`generateVideo` + `getJob` + `cancelJob`）
- 但需要接入 Vercel-side job system（类似 cn-executor 的 GenerationJob queue）

**需要**:
- `RUNWAY_API_KEY` / `LUMA_API_KEY` env
- 官方文档确认当前 endpoint 和 model 名（禁止硬编码未知 model）
- Vercel-side async job tracking（`/api/generate/video/status` 目前轮询 cn-executor，需新增 global path）

### Phase 5：Gemini Nano Banana

**目标**: 高价值图片编辑 Agent  
**前提**: Phase 2 global image adapter 已稳定，global storage 已验证  
**风险**: 低（但 API 较新，需确认官方文档）

---

## 10. 最小代码执行计划（不执行，仅规划）

### Step A：新增 Global Provider Types

```
apps/web/src/lib/global-providers/types.ts
```

定义 `GlobalTextAgentAdapter`, `GlobalImageAdapter`, `GlobalVideoAdapter` 接口。

### Step B：新增 OpenAI Text Agent adapter

```
apps/web/src/lib/global-providers/openaiText.ts
```

包装现有 `openaiTextAdapter`，加 `systemPrompt` 支持和 `projectContext` 注入。

### Step C：新增 server route

```
apps/web/src/app/api/agents/text/route.ts
```

- POST: `{ prompt, systemPrompt?, projectId?, nodeId? }`
- 鉴权：必须登录
- 调用 `openaiTextAdapter.generateText()`
- 返回 `{ text, model }`（不写 canvas，不触 storage）

### Step D：Image Provider Order 更新

在 image route 的 `IMAGE_PROVIDER_ORDER` 末尾追加：
```typescript
'openai-image',  // global, falls back to Vercel-local + OSS
```

这样 `openai-image` 出现在前端 provider 下拉中（但需 `OPENAI_API_KEY` 才 available）。

### Step E：Admin Registry 确认 Runway

在 `ADMIN_PROVIDER_REGISTRY` 中补充 `runway` 条目（已有 adapter，只缺注册）：

```typescript
{
  providerId: 'runway',
  displayName: 'Runway Gen-4 Turbo',
  capability: ['Video', 'Text-to-Video', 'Image-to-Video'],
  category: 'Global',
  envKeys: ['RUNWAY_API_KEY'],
  nodeType: 'video',
  creditsPerCall: 200,
  estimatedCostUsd: 0.10,
  testMode: 'env-only',
  setupHint: '配置 RUNWAY_API_KEY。当前模型: gen4_turbo（待官方文档确认最新版本）。',
}
```

---

## 11. 环境变量清单（本轮不改，仅记录）

### Phase 1（OpenAI Text）
```
OPENAI_API_KEY=sk-...
OPENAI_TEXT_MODEL=              # 可选，默认 gpt-4.1-mini（待官方文档确认）
```

### Phase 2（OpenAI Images）
```
OPENAI_API_KEY=sk-...           # 与 Phase 1 共用
OPENAI_IMAGE_MODEL=             # 可选，默认 gpt-image-1（待官方文档确认）
```

### Phase 3（fal / Replicate）
```
FAL_KEY=...
REPLICATE_API_TOKEN=...
```

### Phase 4（Runway / Luma / Kling Global）
```
RUNWAY_API_KEY=...
LUMA_API_KEY=...
KLING_GLOBAL_API_KEY=...        # 与 CN KLING_ACCESS_KEY 分开，不共用
```

### Phase 5（Gemini Nano Banana）
```
GOOGLE_AI_API_KEY=...           # 或 GEMINI_API_KEY
GOOGLE_AI_MODEL=                # 待官方文档确认
```

### Global Storage（V2，Phase 3+ 可选）
```
BLOB_READ_WRITE_TOKEN=...       # Vercel Blob（推荐先试）
GLOBAL_MEDIA_PUBLIC_BASE_URL=https://...vercel-storage.com/
# 或
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=creator-city-global
```

---

## 12. 待官方文档确认项（接入前必须查）

以下内容**不凭记忆硬编码**，接入前通过官方文档确认：

| Provider | 确认项 | 参考文档 |
|----------|--------|---------|
| OpenAI Text | 当前推荐 Chat Completions vs Responses API；推荐 model name | platform.openai.com/docs |
| OpenAI Images | gpt-image-1 vs DALL-E 3 推荐路径；response_format；size 参数；inpaint API | platform.openai.com/docs/guides/images |
| fal.ai | client API 调用方式；queue vs subscribe；model ID 格式 | fal.ai/docs |
| Replicate | prediction API；polling vs webhook；model version format | replicate.com/docs/api |
| Runway | 当前生产 API base URL（dev vs prod）；model 名；版本号 | docs.dev.runwayml.com |
| Luma | Dream Machine API endpoint；video generation 参数 | lumalabs.ai/api |
| Stability | 当前推荐 image generation endpoint；inpaint API | platform.stability.ai/docs |
| Google Gemini | Nano Banana 正式名称和 endpoint；image generation API | ai.google.dev/docs |

---

## 13. 风险与成本

| 风险 | 级别 | 缓解 |
|------|------|------|
| OpenAI 文本成本 | 低 | gpt-4.1-mini ≈ $0.0004/千 tokens，内部 Agent 调用量小 |
| OpenAI 图片成本 | 中 | gpt-image-1 按生成计费，需用户 credits 前置扣除 |
| fal/Replicate 模型质量差异 | 中 | 必须白名单，不允许自填 model ID |
| Runway/Luma 视频成本 | 高 | 必须有 credits estimate；任务慢，沿用无超时轮询 |
| Global output → OSS 跨区 | 低-中 | V1 可接受；V2 迁移 Vercel Blob 后消除 |
| Provider output URL 过期 | 已消除 | 所有路径均转存 OSS（方案 A），无裸 URL 显示 |
| Provider 错误被覆盖 | 已有防护 | image/video route 已透传 errorCode+upstreamMessage |

---

## 14. 本轮确认

- ✅ 只读审计，未修改任何代码文件
- ✅ 未运行 commit 或 push
- ✅ P0-BOUNDARY-LOCK-ACTIVE 所有 Forbidden Zone 文件未触碰
- ✅ 本文档为草案，不含硬编码的未知 model 名或 endpoint
- ✅ 所有接入步骤在执行前必须先查官方文档
