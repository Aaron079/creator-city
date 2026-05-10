# P0 Root Cause: Canvas Asset Data Flow

> Written: 2026-05-10 | Status: Fixed

---

## 1. 问题现象

/create 画布里旧图片、旧视频节点显示：
- "立即恢复资产" / "不可恢复" / "需要恢复"
- storageKey 无法恢复
- recoveryStatus: unrecoverable_provider_expired
- 真实媒体不显示

---

## 2. 真实数据链路图

```
用户点击生成
→ VisualCanvasWorkspace.tsx: callGenerationApi()
→ POST /api/generate/image (或 /video)
→ generateSeedreamImage() / generateSeedanceVideo()   [lib/providers/china/volcengine.ts]
→ persistGeneratedMedia()                              [lib/assets/persist-generated-media.ts]
  → downloadExternalAsset(providerUrl)                 [storage-adapter.ts]
  → uploadAsset(buffer) → uploadChinaObject()          [storage-adapter.ts]
    → putAliyunOssObject()                             [storage/china/aliyun-oss.ts]
    → returns { storageKey, url: publicUrl }
  → db.asset.create({ storageKey, url: publicUrl, originalUrl: providerUrl })
  → returns { ok: true, assetId, stableUrl: publicUrl }
→ API returns { resultImageUrl: stableUrl, assetId, ... }
→ handleNodePatch(nodeId, { resultImageUrl: stableUrl, metadataJson: { assetId } })
→ commitNodes() → scheduleCanvasSave(0)
→ PUT /api/projects/:id/canvas → db.canvasNode.upsert(...)

──── 页面刷新 ────

→ GET /api/projects/:id/canvas → mapCanvasNode()
→ assetResolveKey effect → POST /api/assets/resolve-batch
  → resolveAssetRecord(asset)
    → checkObjectExists(asset)    ← 原始断点（stub 返回 exists:false）
    → resolveAssetUrl(asset)      ← 只有前者通过才调用

→ CanvasNodeCard 显示 img/video
```

---

## 3. 根因（真实断点）

**文件**: `apps/web/src/lib/storage/china/aliyun-oss.ts`

`getAliyunOssSignedDownloadUrl()` 是 STUB，不返回任何 URL，导致：

1. `checkSignedObjectExists()` 得不到 URL → 返回 `{ exists: false }`
2. `checkObjectExists()` 返回 `{ exists: false }`
3. `resolveAssetRecord()` 跳过 `resolveAssetUrl()` → 尝试 originalUrl（已过期 Volcengine URL）→ 403/404
4. `markAsset(UNRECOVERABLE, 'unrecoverable_provider_expired')` 写入数据库
5. 每次页面加载都触发，不断将状态良好的 Asset 标记为 UNRECOVERABLE

---

## 4. Canvas 保存/读取位置

- 主持久化: DB `CanvasWorkflow` / `CanvasNode` / `CanvasEdge`
- 本地 fallback: `localStorage` (`creator-city:canvas-snapshot:<projectId>` 等)
- 加载逻辑: 比较 server vs local `updatedAt`，取较新的

---

## 5. Asset 保存位置

- DB `Asset` 表: `id`, `url`（OSS 公开URL）, `originalUrl`（provider URL）, `storageKey`, `storageProvider`
- 文件存储: Aliyun OSS，通过 `ALIYUN_OSS_PUBLIC_BASE_URL/{storageKey}` 访问

---

## 6. 前端如何调用后端资产接口

```
页面加载 → assetResolveKey (useMemo) 变化
→ useEffect → POST /api/assets/resolve-batch { assetIds }
→ resolveAssetById() → resolveAssetRecord()
→ 返回 { status, resolvedUrl }
→ applyResolvedAssetToNode() → 更新 node.resultImageUrl
→ CanvasNodeCard 显示媒体
```

无 assetId 的旧节点 → POST /api/media/resync（尝试重新持久化旧 URL）

---

## 7. 修复方案（已实施，2026-05-10）

### Fix 1: aliyun-oss.ts
让 `getAliyunOssSignedDownloadUrl` 返回 `ALIYUN_OSS_PUBLIC_BASE_URL` 构建的公开 URL，而不是 stub。

### Fix 2: asset-resolver.ts
在 `checkObjectExists()` 失败后，先尝试 `resolveAssetUrl()` fallback，如果返回有效 HTTP URL 则标记为 READY，不进入 UNRECOVERABLE 流程。

---

## 8. 不可动范围

- CanvasNode.resultImageUrl / resultVideoUrl
- metadataJson.assetId
- Prisma schema / 数据库
- localStorage key 命名
- MEDIA_PERSISTENCE_ENABLED（保持开启）

---

## 9. 验证步骤

**本地**: `pnpm --filter web exec tsc --noEmit && pnpm --filter web build`

**线上**: 
1. Push → Vercel 部署
2. 打开 /create，旧节点图片/视频恢复显示
3. 生成新图片/视频，刷新仍显示
4. Vercel 日志无 exists:false 循环

---

## 10. 后续防止再发

1. 任何存储后端的 `getSignedDownloadUrl()` 不允许是纯 STUB（至少返回 publicUrl）
2. `resolveAssetRecord()` 不能把"签名URL生成失败"等价于"对象不存在"
3. 每次修复媒体显示问题前必须先检查 `checkObjectExists()` 返回值
