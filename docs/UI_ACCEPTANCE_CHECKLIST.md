# Creator City — UI/UX Evidence-Based Acceptance Checklist

> Rule: Implementation is not acceptance.
> 代码实现完成 ≠ 功能完成。
> 必须提供用户可复验的证据，证明功能在真实浏览器里按预期工作。

---

## 三层验收框架

### 第 1 层：代码级验收（AI 自查）

| 检查项 | 验收标准 |
|--------|----------|
| 修改文件范围 | 只改允许文件，未动 API route / cn-executor / OSS / Supabase schema |
| 生成 payload | 未修改 image/video 生成 payload |
| type-check | `pnpm --filter web type-check` 通过（0 错误）|
| build | `pnpm --filter web build` 通过（0 ESLint error）|
| 无 `setNodes([])` | 错误路径中不能有 `setNodes([])` 或 `setEdges([])` |

### 第 2 层：浏览器行为验收（用户自测步骤）

每次 UI 改动，AI 必须提供以下格式的逐步验收步骤：

```
Step N: [用户操作]
Expected: [肉眼可见的预期结果]
If failed: [失败时的表现 / 可能原因]
```

### 第 3 层：反证验收（用户自测）

打开 DevTools → Network，验证：
- 无 POST /api/generate/image
- 无 POST /api/generate/video
- 无 PUT/PATCH canvas（除主动保存外）
- 刷新后节点仍在，imageUrl/videoUrl/stableUrl 未被清零

---

## MediaLightbox 专项验收步骤

> 适用于 commit 6cfbe51 之后的版本（含本次修复）

### 前置条件
- 在 /create 页面
- 至少有一个图片节点（status: done，有图片显示）
- 至少有一个视频节点（status: done，有视频显示）

### 图片节点验收

**Step 1:** 双击图片节点内的图片预览区域（图片本体）
```
Expected:
- 整个屏幕被半透明黑色遮罩覆盖（背景变暗）
- 图片居中放大，明显大于节点内的预览尺寸
- 图片宽度接近 88vw 或高度接近 88vh（取决于比例）
- 图片不拉伸、不裁切，保持原始比例
- 右上角有 ✕ 按钮
- 底部有淡色"单击图片或遮罩 / ESC 关闭"提示
- DevTools Console 无报错
```

**Step 2:** 单击图片本体
```
Expected: 遮罩消失，回到画布，图片节点仍在，"已保存"标签仍在
```

**Step 3:** 再次双击图片，然后单击黑色遮罩（图片以外区域）
```
Expected: 遮罩消失，回到画布
```

**Step 4:** 再次双击图片，然后按 ESC 键
```
Expected: 遮罩消失，回到画布
```

**Step 5:** 再次双击图片，然后单击右上角 ✕ 按钮
```
Expected: 遮罩消失，回到画布
```

**Step 6:** 打开 DevTools → Network，清空记录，执行一次双击放大再关闭
```
Expected: 无 POST /api/generate/image，无 POST /api/generate/video
```

### 视频节点验收

**Step 7:** 双击视频节点内的视频预览区域
```
Expected:
- 整个屏幕被半透明黑色遮罩覆盖
- 视频居中放大，明显大于节点内的预览尺寸
- 视频宽度接近 88vw 或高度接近 88vh
- 视频带浏览器原生 controls（播放/暂停/进度条/音量）
- 右上角有 ✕ 按钮
- 底部有淡色"单击遮罩 / ✕ / ESC 关闭"提示
```

**Step 8:** 单击视频的 controls（播放/暂停）
```
Expected: 视频播放/暂停，弹框不关闭
```

**Step 9:** 单击视频以外的黑色遮罩
```
Expected: 弹框关闭，回到画布
```

**Step 10:** 按 ESC
```
Expected: 弹框关闭，回到画布
```

**Step 11:** 单击右上角 ✕ 按钮
```
Expected: 弹框关闭，回到画布
```

### 副作用验收

**Step 12:** 关闭 lightbox 后，检查原节点
```
Expected:
- 原图片/视频节点仍在
- 图片/视频仍正常显示
- "已保存"标签仍在（如果之前有）
- 节点 prompt 未被清空
- 拖拽节点正常
- 节点连线正常
```

**Step 13:** 刷新页面
```
Expected:
- 节点仍在
- 图片/视频仍正常显示（从 stableUrl 加载）
- 无 lightbox 残留
```

---

## 所有 UI 任务验收要求

### 弹框类（Modal / Lightbox / Dialog）
- [ ] 使用 `createPortal(…, document.body)` 或独立 DOM 挂载
- [ ] z-index ≥ 99999（高于画布、工具栏、AI 按钮）
- [ ] `fixed inset-0` 或等价方案（不受 canvas transform 影响）
- [ ] ESC 关闭（useEffect 注册，unmount 清理）
- [ ] 点击遮罩关闭
- [ ] 关闭后不影响原内容

### 拖拽类
- [ ] `event.stopPropagation()` 防止画布拖拽
- [ ] `data-no-node-drag="true"` 标记非拖拽区域
- [ ] 拖拽结束不触发 click

### 图片/视频预览类
- [ ] 使用 `object-contain`（不拉伸、不裁切）
- [ ] 设置明确的 `width` + `height` + `maxWidth` + `maxHeight`
- [ ] 不调用 generation API
- [ ] 关闭后不清空 imageUrl/videoUrl/stableUrl

### 状态 chip 类
- [ ] idle → 待生成
- [ ] queued/pending → 排队中
- [ ] running/generating/processing → [种类]生成中
- [ ] done → 已生成
- [ ] error/failed → 失败
- [ ] cancelled → 已停止

### Canvas save 失败类
- [ ] 失败时显示友好提示
- [ ] 不调用 `setNodes([])`
- [ ] 不清空 imageUrl/videoUrl/stableUrl
- [ ] localStorage draft 仍在

---

## AI 不能做的声明

❌ 不能写："已完成并验收通过"（如果没有浏览器截图/录屏证据）
❌ 不能写："代码正确所以功能正确"
❌ 不能写："type-check 通过所以视觉效果正确"

✅ 必须写："我无法真实浏览器验收，只能提供代码级保证，请用户按以下步骤验收"
✅ 必须提供逐步验收步骤（Step N / Expected）
✅ 必须提供反证检查（Network 无 POST）
