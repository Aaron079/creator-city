# P0 Production Hotfix — Media Generation & Asset Resolution

> Date: 2026-05-10 | Status: Fixed (hotfix branch p0-production-media-hotfix)

---

## 1. 为什么上一次没有修好

上一次报告（commit `5cc4a17`）修复了 `getAliyunOssSignedDownloadUrl()` stub 和 `asset-resolver.ts` fallback 逻辑，代码是对的，但实际线上 **所有 Node.js Lambda 函数都在启动时 crash**，根本没有执行到 OSS 修复代码。

| 问题 | 结论 |
|------|------|
| Vercel 部署了最新 commit？ | 是，但 Node.js Lambda 全部 crash |
| OSS signedUrl 仍是 stub？ | 否，代码已修复，但 Lambda crash 导致修复无法运行 |
| 前端是否用了 resolvedUrl？ | 是，`applyResolvedAssetToNode()` 正确，但 API 500 无结果可用 |
| resolve-batch 误标 UNRECOVERABLE？ | 否，Lambda crash 直接返回 500，前端收不到任何 resolve 结果 |
| 生产 env 缺失？ | 排查中（Lambda crash 掩盖了更深层问题） |
| 新生成 API 报错？ | `/api/generate/image`、`/api/generate/video` 均 500 |
| Canvas node 写入 assetId？ | 逻辑正确，但 API crash 导致无法完成 |

---

## 2. 真实根因

### 错误信息（生产 Vercel 日志）

```
Cannot find module 'next/dist/compiled/next-server/server.runtime.prod.js'
Require stack:
- /var/task/apps/web/___next_launcher.cjs
Node.js process exited with exit status: 1.
```

### 根因链

```
commit 407a12c "fix vercel function tracing for asset recovery routes"
  → 在 next.config.mjs 添加:
    experimental.outputFileTracingExcludes: {
      "*": ["./.next/**/*", ".next/**/*"]
    }
  → 这排除了 .next/ 目录下的文件（看似无害）
  
BUT:
  apps/web/node_modules/next
    → symlink → ../../../node_modules/.pnpm/next@14.2.35_.../node_modules/next
  
  当 outputFileTracingRoot = apps/web/ (默认值) 时:
    next/dist/compiled/next-server/server.runtime.prod.js
    解析后实际路径: creator-city/node_modules/.pnpm/next@14.2.35_.../next/dist/...
    相对于 apps/web/: ../../../node_modules/.pnpm/...
    → 路径超出 tracingRoot → 文件不被打包进 Lambda bundle

  结果: 所有 Node.js serverless 函数在冷启动时找不到 server.runtime.prod.js → exit status 1 → HTTP 500
```

---

## 3. 受影响路由（全部 Node.js runtime）

| 路由 | 影响 |
|------|------|
| `POST /api/assets/resolve-batch` | 500 → 所有资产显示"不可恢复" |
| `GET /api/generate/image` | 500 → 图片生成失败 |
| `POST /api/generate/image` | 500 → 图片生成失败 |
| `GET /api/generate/video` | 500 → 视频生成失败 |
| `POST /api/generate/video` | 500 → 视频生成失败 |
| `PUT /api/projects/[id]/canvas` | 间歇 500 → Canvas 保存失败 |
| `POST /api/assets/resolve-batch` | 500 |

不受影响（Edge Runtime / Static）:
- 静态页面 (`/create`, `/dashboard` 等)
- 部分 Middleware 处理的路由

---

## 4. 修复方案

### 文件: `apps/web/next.config.mjs`

**修复前（broken）**:
```js
const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  experimental: {
    outputFileTracingExcludes: {
      "*": ["./.next/**/*", ".next/**/*"],
    },
  },
  // ...
}
```

**修复后**:
```js
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const nextConfig = {
  transpilePackages: ["@creator-city/shared"],
  experimental: {
    // 设置 tracingRoot 为 monorepo 根目录，使 pnpm symlink 解析到
    // node_modules/.pnpm/next@.../node_modules/next/ 的文件
    // 能被正确打包进 Vercel Lambda bundle。
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  // ...
}
```

---

## 5. 为什么这样修复

pnpm 使用 content-addressable store + symlink：

```
apps/web/node_modules/next
  → ../../../node_modules/.pnpm/next@14.2.35_.../node_modules/next
```

当 `outputFileTracingRoot = apps/web/` (Next.js 默认) 时：
- 文件真实路径: `creator-city/node_modules/.pnpm/next@.../dist/...`
- 相对路径: `../../../node_modules/.pnpm/...`
- **超出 tracing root → 不被打包 → Lambda 找不到模块 → 500**

当 `outputFileTracingRoot = creator-city/` (monorepo root) 时：
- 相对路径: `node_modules/.pnpm/...`
- **在 tracing root 内 → 被打包 → Lambda 正常启动**

---

## 6. 旧资产显示修复

OSS signedUrl stub fix (commit `5cc4a17`) 已经正确实现，修复包括：
- `getAliyunOssSignedDownloadUrl()` 返回真实 `publicUrl` 而不是 empty stub
- `resolveAssetRecord()` 在 `checkObjectExists()` 失败时先尝试 `resolveAssetUrl()` fallback

在 Lambda 修复后，这些修复将正常生效。

## 7. 新生成链路修复

`generate/image` 和 `generate/video` 的 Lambda 修复后将正常工作。链路：
1. 前端调用 `POST /api/generate/image` or `/api/generate/video`
2. API 调用 `generateSeedreamImage()` / `generateSeedanceVideo()`
3. 调用 `persistGeneratedMedia()` → 下载 → 上传 OSS → 创建 Asset
4. 返回 `{ assetId, stableUrl }` → 写入 Canvas node

---

## 8. 绝对禁止规则（防止再次发生）

1. **禁止** 在 `outputFileTracingExcludes` 中使用 `.next/**/*` — 会把 server runtime 打进排除名单
2. **必须** 在 pnpm 单体仓库中设置 `outputFileTracingRoot` 为单体仓库根目录
3. **每次改动** `next.config.mjs` 后必须在 Vercel 验证至少一个 Node.js 动态路由
4. **生产验收** 必须包含 `curl https://[domain]/api/assets/resolve-batch` 返回 200（非 500）

---

## 9. Vercel 生产验收步骤

1. 确认 Vercel Production deployment commit 等于最新 git HEAD
2. 运行: `pnpm dlx tsx scripts/p0-production-smoke.ts --base-url https://creator-city-vert.vercel.app`
3. 验收通过条件: `/api/assets/resolve-batch` 返回 200，`/api/generate/image` 返回 200
4. 打开 `https://creator-city-vert.vercel.app/create`
5. 旧图片/视频节点应显示真实媒体
6. 生成新图片/视频应成功
7. 刷新页面后应仍显示
