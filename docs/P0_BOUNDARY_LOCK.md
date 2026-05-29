# P0-BOUNDARY-LOCK-ACTIVE — Creator City 边界安全线

> **状态：ACTIVE**
> 任何代码修改任务开始前，必须先声明：
> ```
> 我已读取 P0-BOUNDARY-LOCK-ACTIVE。
> 本次不会触碰 Forbidden Zone。
> 若必须触碰，我会先停止并请求用户授权。
> ```
> 没有此声明，不允许开始改代码。

---

## 一、已验收稳定能力（不得破坏）

| # | 能力 | 状态 |
|---|------|------|
| 1 | 登录 | ✅ |
| 2 | 图片生成 | ✅ |
| 3 | 视频生成 | ✅ |
| 4 | 火山 Seedance 视频链路 | ✅ |
| 5 | cn-executor → Volcengine → OSS → 前端显示链路 | ✅ |
| 6 | OSS Transfer Acceleration | ✅ `https://creatorcity.oss-accelerate.aliyuncs.com` |
| 7 | OSS CORS / Range（200、206、Content-Range、Accept-Ranges） | ✅ |
| 8 | Vercel 环境变量 | ✅ |
| 9 | 旧素材通过 `/api/media/proxy` 显示 | ✅ |
| 10 | 内容审核/版权限制错误正确显示 | ✅ |
| 11 | 视频节点 poster 通过 proxy（不直连 OSS） | ✅ |

---

## 二、Forbidden Zone — 默认全部禁止改动

改动这些文件/目录必须先获得用户单独授权，并开独立 P0 修复任务。

### 生成 API 路由
```
apps/web/src/app/api/generate/image/route.ts
apps/web/src/app/api/generate/video/route.ts
apps/web/src/app/api/generate/video/status/route.ts
```

### cn-executor（全部）
```
apps/cn-executor/src/**
```
包括：`videoJobRunner.ts`、`imageJobRunner.ts`、`seedance.ts`、`oss.ts`、任何影响 payload/polling/upload/asset/job status 的逻辑。

### Canvas 保存与 DB 写入
```
apps/web/src/app/api/projects/[projectId]/canvas/route.ts
```
包括：CanvasNode upsert / workflow update / resultImageUrl / resultVideoUrl / metadataJson / paramsJson / Asset reference 写入逻辑。

### Media Proxy
```
apps/web/src/app/api/media/proxy/route.ts
```
包括：Range header 透传、allowlist、206/200/304/403/404/502/504 处理、content-type 判断。

### Provider 配置与路由
```
apps/web/src/lib/provider-management/**
```
包括：provider registry、executor gateway、region routing、modelEnvKey 映射。

### 数据库结构
```
prisma/schema.prisma
prisma/migrations/**
supabase/migrations/**
```

### 依赖和运行环境
```
package.json
pnpm-lock.yaml
tsconfig.base.json
.env*
vercel.json（如存在）
```

### 受保护的环境变量（不得删改）
- `VOLCENGINE_SEEDANCE_MODEL`
- `VOLCENGINE_SEEDREAM_MODEL`
- `VOLCENGINE_ARK_API_KEY`
- `CREATOR_CN_API_BASE_URL`
- `CREATOR_GLOBAL_API_BASE_URL`
- `ALIYUN_OSS_PUBLIC_BASE_URL`（当前值：`https://creatorcity.oss-accelerate.aliyuncs.com`）

---

## 三、Safe Zone — 允许触碰（明确任务需要时）

1. 纯 UI 文案
2. 纯 CSS 视觉样式
3. 非生成链路的新页面或独立组件
4. 不影响现有生成/保存/媒体显示的新功能入口
5. `docs/` 文档
6. `scripts/` 工具脚本
7. 明确用户授权的单行展示层修复

**即使 Safe Zone，也必须先声明：改哪些文件、不改哪些 Forbidden Zone、为什么不影响已验收链路。**

---

## 四、任务前必做边界检查（8项）

任何代码修改前输出以下清单：

1. 本次任务目标
2. 是否触碰生成链路：是/否
3. 是否触碰 cn-executor：是/否
4. 是否触碰 canvas save：是/否
5. 是否触碰 media proxy：是/否
6. 是否触碰 provider-management/env/schema/package：是/否
7. 本次允许修改文件清单
8. 本次禁止修改文件清单

---

## 五、修改后 diff 边界检查

```bash
cd /Users/aaron/creator-city
bash scripts/check-boundary-touch.sh
git diff --name-only
git diff --stat
git status --short
```

报告：
1. 是否只改了允许文件
2. 是否误碰 Forbidden Zone
3. 若误碰 → 立即 revert，不得继续扩大修改
4. 实际修改文件列表

---

## 六、测试要求

```bash
cd /Users/aaron/creator-city
pnpm type-check
pnpm build
pnpm lint
```

前端改动还须确认：
- 页面不白屏
- DevTools Console 无新增 error
- Network 无新增 401/403/500/502/503/504
- 旧素材仍显示
- 新生成链路不受影响

媒体显示改动还须验证：
- 图片/视频正常显示
- poster 不直连 OSS
- 媒体走 `/api/media/proxy` 或批准的 CDN 路径
- Range 请求仍返回 206

---

## 七、Commit/Push/Deploy 纪律

```bash
cd /Users/aaron/creator-city
pnpm type-check && pnpm build && pnpm lint
git status --short
git diff --name-only
git diff --stat
git add <明确列出的文件>
git commit -m "<clear commit message>"
git log --oneline -5
git push origin main
git status --short
```

然后确认：
1. 最新 commit hash
2. push 成功
3. Vercel Production 已部署最新 commit
4. 工作区干净
5. 用户浏览器验收

**不得留下本地未提交/未 push/未部署的修改。**

---

## 八、中国区 / 海外区架构原则

**中国区 provider**（Seedance、Seedream、Jimeng、DeepSeek 等）：
- `providerRegion=cn`、`executionRegion=cn`、`storageRegion=cn`、`executorKind=aliyun_fc`
- 输出走 cn OSS / OSS Transfer Acceleration
- 不得改回 Vercel global 处理中国区生成任务

**海外 provider**（OpenAI、Runway、Replicate、FAL 等）：
- `providerRegion=global`、`executionRegion=global`、`storageRegion=global`
- 不得混用 cn OSS 或 cn-executor

---

## 九、已验收 CDN/OSS 配置（不得回退）

| 配置项 | 当前值 | 禁止改回 |
|--------|--------|----------|
| OSS base URL | `https://creatorcity.oss-accelerate.aliyuncs.com` | `https://creatorcity.oss-cn-hangzhou.aliyuncs.com` |
| OSS CORS AllowedOrigin | `https://creator-city-vert.vercel.app` | — |
| OSS CORS Methods | `GET HEAD` | — |
| OSS CORS ExposeHeaders | `Content-Range Accept-Ranges ETag Last-Modified Content-Length Content-Type` | — |
| OSS CORS MaxAgeSeconds | `3600` | — |

---

## 十、内容审核错误处理边界

provider 返回明确 errorCode 时，UI 必须优先显示真实错误，不得被以下 fallback 覆盖：
- 历史 Asset 记录不存在 / assetRecordMissing / generation_failed / recovery polling / unknown error

需保留明确诊断的 errorCode：
- `SEEDANCE_TASK_FAILED`
- `SEEDANCE_TASK_CREATE_FAILED`
- `content_policy_rejected`
- `provider_timeout`
- `executor_not_started`
- `generation_job_stalled`

---

## 十一、安全测试 Prompt

**推荐**：
```
一位原创东方幻想战士从云层中缓缓降落，身披黑金铠甲，手持发光长枪，天空电光闪烁，电影感镜头，史诗氛围，慢动作，超现实幻想场景。
```

**禁止使用**：雷神、Thor、漫威、复仇者、奥丁、DC、迪士尼、任天堂、知名游戏/动漫/电影角色名、明星姓名、受版权保护 IP

---

## 十二、异常排查顺序（禁止跳步）

1. 浏览器 Network 返回 JSON
2. provider errorCode / message
3. cn-executor FC 日志
4. Vercel Function 日志
5. Supabase GenerationJob / Asset / CanvasNode
6. OSS URL / proxy / Range / CORS
7. 最后才判断基础设施或代码回归

---

## 十三、检查工具

```bash
# 在提交前运行，检测是否误碰 Forbidden Zone
bash scripts/check-boundary-touch.sh

# 检查当前 diff 范围
git diff --name-only HEAD
git diff --stat HEAD
```

---

*本文档由 P0-BOUNDARY-LOCK-ACTIVE 协议生成，禁止在未经用户授权的情况下删除或修改。*
