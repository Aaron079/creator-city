# P0 Production Acceptance Checklist

> Version: 2026-05-27  
> Scope: Image generation, video generation, canvas save/restore, media proxy, favicon  
> Status: Active — run after every P0-class deployment

---

## 1. P0 验收目标

| 目标 | 判定标准 |
|------|---------|
| 图片生成结果显示在画布 | 生成完成后节点显示缩略图，不为空白 |
| 视频生成结果可播放 | 节点播放器能流畅起播，进度条可拖拽 |
| 刷新后结果不丢失 | 页面 reload 后节点仍显示原生成图/视频 |
| canvas 保存稳定 | Network 面板 canvas PUT 主要为 200，无连续 canceled/503 |
| 视频 proxy 稳定 | media/proxy GET 主要为 200/206，无连续 504/ERR_TIMED_OUT |
| favicon 正常 | Console 无 GET /favicon.ico 404 |
| 无重复生成 | 同一节点生成中时无法二次触发，无重复扣费 |

---

## 2. 环境前置检查

```
# 1. 确认 Vercel 已部署到 Production（不是 Preview）
# 2. 确认 cn-executor 在 Aliyun FC 上运行正常
# 3. 确认 OSS bucket 可写
# 4. 以正式账号登录（非 admin 测试账号）
# 5. 打开 DevTools → Network 面板 → 清空
# 6. 打开 DevTools → Console 面板 → 清空
```

---

## 3. 图片生成验收

**步骤：**
1. 进入 `/create?projectId=<real-id>`
2. 添加 Image 节点，填写 prompt
3. 选择 provider（确认 Provider 状态显示绿色）
4. 点击「生成」按钮
5. 等待节点 status 变为 `done`

**期望：**
- 节点显示生成图片缩略图
- Network: `POST /api/generate/image` → 200
- Network: `GET /api/generate/image/status` 轮询直到 done → 200
- Network: `GET /api/media/proxy?url=...` → 200
- Network: `PUT /api/projects/:id/canvas` → 200（不应出现 canceled/503）

**禁止出现：**
- 生成成功但节点仍显示空白
- Network 出现 `POST /api/generate/image` 重复调用同一 nodeId
- status 轮询超过 12 次无结果（应显示 timeout 错误）

---

## 4. 视频生成验收

**步骤：**
1. 添加 Video 节点，填写 prompt
2. 点击「生成视频」按钮
3. 等待节点 status 变为 `done`（视频生成通常 30–120s）

**期望：**
- 节点显示视频播放器，可起播
- Network: `POST /api/generate/video` → 200
- Network: `GET /api/generate/video/status` 轮询 → 200，最终返回 done
- Network: `GET /api/media/proxy?url=...` Range 请求 → **206**（分段流式）
- `x-media-proxy-upstream-status: 206` 响应头存在

**禁止出现：**
- `GET /api/media/proxy` 连续 504（超过 2 次）
- `ERR_TIMED_OUT` 导致视频无法加载
- 视频节点 status 卡在 `generating` 超过 5 分钟
- DB 中 `resultVideoUrl` 被覆盖成 null（触发路径：生成完成后立即手动保存）

---

## 5. Canvas Save 验收

**步骤：**
1. 执行任意画布操作（移动节点、修改 prompt）
2. 观察 Network 面板

**期望：**
- `PUT /api/projects/:id/canvas` → **200**
- 同一时刻 Network 中 canvas PUT **只有 1 个 pending**（无并发）
- 无连续 canceled 状态的 PUT 请求
- 503 出现时：2 秒后自动重试一次

**禁止出现：**
- 多个 canvas PUT 同时 in-flight（会出现竞争写入）
- 成功生成后 canvas save 把 `resultImageUrl` 或 `resultVideoUrl` 覆盖成 null
- canvas save 失败后节点状态被清空（应保留 localStorage 草稿）

---

## 6. 刷新恢复验收

**步骤：**
1. 图片/视频生成完成，节点显示结果
2. 刷新页面（Cmd+R）
3. 等待画布重新加载

**期望：**
- 节点仍显示生成图/视频（不为空白）
- `reloadRecoveryPending` 节点：自动调用 `GET /api/assets/recover-canvas-nodes` → 200
- 若恢复成功，节点 status 变为 `done`

**禁止出现：**
- 刷新后 `resultImageUrl` 变空
- 刷新后 generating 节点被错误标记为 `failed`（应保持原状态或 `reloadRecoveryPending`）

---

## 7. 恢复历史素材验收

**步骤：**
1. 点击顶部「恢复历史素材」按钮
2. 观察按钮状态变化

**期望：**
- 按钮点击后显示 loading 状态
- `GET /api/assets/recover-canvas-nodes?projectId=...` → 200
- 若有可恢复素材：节点更新显示图/视频，canvas 自动保存
- 若无可恢复：按钮恢复正常，无报错

**禁止出现：**
- 按钮重复触发生成 API
- 恢复操作创建新订单或扣除积分

---

## 8. Media Proxy 视频播放验收

**步骤：**
1. 视频节点显示播放器
2. 点击播放，拖拽进度条
3. 观察 Network 面板

**期望：**
- `GET /api/media/proxy?url=...` 带 `Range` 请求头 → **206**
- 响应头包含 `Content-Range`, `Accept-Ranges`
- 响应头 `Cache-Control: private, max-age=3600`
- 视频起播时间 < 5s（cn-hangzhou OSS 跨地域可允许适当延迟）

**禁止出现：**
- `GET /api/media/proxy` 返回 504 超过 2 次（超时已延长至 30s）
- `ERR_TIMED_OUT` 导致视频完全无法播放
- proxy 响应 `Content-Type: application/json`（说明返回了错误 JSON 而非媒体流）

---

## 9. Network 面板预期

| 请求 | 期望状态 | 禁止出现 |
|------|---------|---------|
| `POST /api/generate/image` | 200 | 重复调用同 nodeId |
| `GET /api/generate/image/status` | 200，轮询 ≤12 次 | 无限轮询 |
| `POST /api/generate/video` | 200 | 重复调用同 nodeId |
| `GET /api/generate/video/status` | 200，轮询 ≤24 次 | 无限轮询 |
| `PUT /api/projects/:id/canvas` | 200 | 多个并发 / 连续 canceled / 503 |
| `GET /api/media/proxy` (image) | 200 | 504, ERR_TIMED_OUT |
| `GET /api/media/proxy` (video, Range) | 206 | 504, ERR_TIMED_OUT |
| `GET /api/assets/recover-canvas-nodes` | 200 | 非幂等调用 |
| `GET /favicon.ico` | 200 | 404 |

---

## 10. Console 面板预期

**允许出现（已知 warning）：**
- `react-hooks/exhaustive-deps` warning（已知，不影响功能）
- `Using <img> could result in slower LCP`（已知 warning）

**禁止出现：**
- `GET /favicon.ico 404`
- `OSS_UPLOAD_ERROR` 反复出现（说明视频上传链路有问题）
- `CLIENT_FETCH_FAILED` 反复出现（说明网络或 API 异常）
- `canvas_save_unauthorized` 出现（说明 session 失效）
- `resultVideoUrl` / `resultImageUrl` 被写入 null 的日志

---

## 11. 失败判定标准

以下任一情况出现即判定验收失败：

| # | 失败场景 |
|---|---------|
| F1 | 图片生成成功后节点不显示图片 |
| F2 | 视频生成成功后无法播放（非网络抖动，而是持续失败） |
| F3 | 刷新页面后生成结果消失（不可通过「恢复历史素材」找回） |
| F4 | `resultImageUrl` 或 `resultVideoUrl` 被 canvas save 覆盖成 null |
| F5 | canvas PUT 连续出现 5 次以上 canceled 或 503 |
| F6 | 视频 proxy 连续出现 3 次以上 504 / ERR_TIMED_OUT |
| F7 | 同一节点触发了 2 次以上 generate POST |
| F8 | 积分余额在未操作生成时异常减少 |
| F9 | `GET /favicon.ico 404` 仍出现在 Console |

---

## 12. 回归禁止项

在 P0 验收期间，以下操作 **严禁** 执行：

| 禁止操作 | 原因 |
|---------|------|
| 修改 `apps/cn-executor/**` 并部署 | 影响视频写库链路（P0c 已修复） |
| 修改 `apps/web/src/app/api/generate/**` | 影响生成链路 |
| 修改 `apps/web/src/app/api/media/proxy/route.ts` timeout 降回 15s | 视频 Range 请求会重新超时 |
| 修改 canvas route 的 `mediaResultPatch` 逻辑 | 会重新引入 null 覆盖问题 |
| 修改 `saveCanvas` 的 in-flight lock | 会重新引入并发 canceled |
| 向生成 payload 增加 `inputAssets` 或 `system` | 可能引入 prompt 污染或额外扣费 |
| 删除 `reloadRecoveryPending` 逻辑 | 刷新后恢复会失败 |
| 改动 `VisualCanvasWorkspace.tsx` 拖拽核心逻辑 | 可能破坏画布稳定性 |
| 修改 `prisma schema` | 可能破坏 DB 兼容性 |
| 修改 `package.json` / `pnpm-lock.yaml` | 可能引入依赖冲突 |

---

## 附录：P0 修复历史

| Commit | 内容 |
|--------|------|
| `dec0f54` | P0a: 新增 recover-canvas-nodes API，applyCanvasSnapshot 保留 active 状态 |
| `9cae2d5` | P0b: 顶部「恢复历史素材」手动入口 |
| `34b6921` | P0c: cn-executor videoJobRunner 写库从 query 改为 writeQuery |
| `2c2abb3` | P0d-3: canvas save update 分支增加 mediaResultPatch，不覆盖 resultImageUrl/resultVideoUrl |
| `9e6a1dc` | P0d-1: canvas save in-flight lock + pending merge + 503 retry + batch upsert |
| `8ce41dd` | P0d-2: media proxy 视频/Range 超时延长至 30s，cache 1 小时 |
