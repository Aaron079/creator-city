# Asset Remix — Tool Replacement Matrix
## Creator City — Keep / Upgrade / Replace / Retire Audit

> **Status**: AUDIT COMPLETE 2026-06-21
>
> **Based on**: Full source audit of AssetAgentToolbar.tsx, all panel components, and lib/canvas/*.ts

---

## Audit Results: All Current Tools

| Tool | Location | Current Real Capability | API Calls? | Source Overwritten? | Recommendation | Evidence |
|---|---|---|---|---|---|---|
| 下载 (Download) | AssetAgentToolbar | Creates `<a>` tag, opens URL | None | No | **KEEP** | `handleDownload()` uses browser download |
| 全屏预览 (Fullscreen) | AssetAgentToolbar | Browser fullscreen / lightbox | None | No | **KEEP** | `onFullscreen()` → `openNodePreview()` |
| 打开资产库 (Asset Library) | AssetAgentToolbar → assets menu | Link to `/assets?highlight=assetId` | None | No | **KEEP** | Direct link in ntb-menu |
| 资产变体规划 (Variant Planner) | AssetVariantPlannerPanel | Generates prompt drafts from asset intelligence; calls `onCreateNode` with new prompt (user still generates separately) | None (local prompt logic) | No | **KEEP** | `generateVariantPlans()` in `lib/canvas/asset-variant-planner.ts` — pure function |
| 版本对比 A/B (A/B Compare) | ABComparePanel | Side-by-side node prompt diff; `analyzePromptDiff()` in-browser | None | No | **KEEP** | `compare-utils.ts` — pure functions |
| 关键帧提取 (Keyframe Extractor) | KeyframeExtractorPanel | HTML5 `canvas.drawImage()` captures video frame at timestamp; creates new Image node with frame as data URL | Browser Canvas API only | No | **KEEP** | `getContext('2d').drawImage()` — real browser capability |
| 提示词增强 (Prompt Booster) | PromptBoosterPanel | Director tool; inserts enhanced prompt text | None | No | **KEEP** (Director layer) | Local suggestions; no API |
| 摄影机控制 (Camera Control) | CinematicCameraControlPanel | 4 wheel slots; writes to localStorage; appends camera context to generation prompt | None | No | **KEEP** (Director layer) | `cameraPromptContext.ts` |
| 镜头词典 (Camera Lexicon) | CameraLexiconPanel | 34 cinematic terms; inserts term description into prompt | None | No | **KEEP** (Director layer) | `camera-lexicon.ts` |
| 场景光线 (Scene Lighting) | SceneLightingControlPanel | 4 wheels; appends lighting context to prompt | None | No | **KEEP** (Director layer) | `sceneLightingPromptContext.ts` |
| 调色盘 (Color Grade) | ColorGradePalettePanel | Selects color grade preset; builds CSS filter + modified prompt; creates derived node **sharing source URL** (CSS-only visual grade) | None | No (copies URL, CSS filter in metadataJson) | **UPGRADE** (future: real color grading executor) | `onCreateGradeNode` copies `resultImageUrl`, adds `colorGradeCssFilter` — current grade is CSS only |
| 视觉风格包 (Look Package) | LookPackagePanel | Style preset selection; creates derived node with new style-modified prompt; user generates separately | None | No | **KEEP** (planning tool) | Creates node; no generate call |
| 角色锁定 (Character Lock) | CharacterLockPanel | Generates consistent character description text to append to prompt | None (local text, `generateCharacterDescription()`) | No | **KEEP** | `character-lock.ts` — pure function, no API |
| 连续性检查 (Continuity Checker) | ContinuityCheckerPanel | Pure rule engine (`analyzeContinuity()`); scores prompt-level continuity issues | None | No | **KEEP** | `continuity-check.ts` — "Pure rule-engine. No API calls." |
| 重构图 (Reframe modes) | AssetAgentToolbar inline | CSS `transform: scale()` on image element — purely visual zoom, no pixel change | None | No | **KEEP temporarily** (rename to clarify; replace when real inpaint ships) | `getReframeStyle()` returns CSS transform only |
| 增强 SOON (disabled) | AssetAgentToolbar | **No execution whatsoever** — disabled button with "soon" badge | None | N/A | **RETIRED** (removed in this commit) | Was: `<button disabled>增强<span>soon</span>` |
| 截图 SOON (disabled, video) | AssetAgentToolbar | **No execution** — disabled button | None | N/A | **Defer** — remove when real screenshot ships | Was: `<button disabled>截图<span>soon</span>` |
| 主体抠图 (Remove Background) | **NEW** RemoveBackgroundPanel | POST `/api/asset-transform` → external GPU executor (SAM2/rembg) | Yes — external GPU | No (new node) | **NEW — pending executor deployment** | `assetTransformTypes.ts` + `/api/asset-transform/route.ts` |
| 高清重建 (HD Reconstruction) | **NEW** HdReconstructionPanel | POST `/api/asset-transform` → external GPU executor (Real-ESRGAN or commercial) | Yes — external GPU | No (new node) | **NEW — pending executor deployment** | Same route; `transformKind: 'upscale'` |

---

## Classification Summary

### KEEP (no change)

All Director Tools: Camera Control, Lighting, Camera Lexicon, Prompt Booster, Character Lock  
All planning/informational tools: Variant Planner, A/B Compare, Look Package, Continuity Checker  
Functional browser tools: Download, Fullscreen, Asset Library, Keyframe Extractor  

### UPGRADE (planned, not immediate)

- **调色盘 (Color Grade)**: Currently CSS-only visual grade. When a real color grading executor is available, the panel backend can be upgraded. UI product entry remains. No user-facing changes until V2.
- **重构图 (Reframe modes)**: Currently CSS transform preview only. When real inpaint/outpaint ships, the CSS reframe section can be replaced with the real outpaint tool.

### REPLACE (done in this commit)

- **增强 SOON** → **高清重建** (HD Reconstruction): The fake disabled button is removed. The real 高清重建 entry is added under 资产再创作. The panel honestly shows executor unavailability if not configured.

### RETIRE

- **增强 SOON** button: REMOVED in commit `P0-ASSET-REMIX-KIT-PHASE-1`. Was a misleading fake UI element with no execution capability.

### DEFERRED DELETION

- **截图 SOON** (video): Kept for now. Remove when real video screenshot capability ships.
- **Reframe CSS modes**: Kept for now. These are honest (no fake execution), just CSS preview.

---

## Deprecation Timeline

| Item | Current | Removal Condition |
|---|---|---|
| 增强 SOON | **REMOVED** | Done |
| 截图 SOON | Kept | When real screenshot executor ships and passes QA |
| CSS Reframe preview | Kept (renamed plan) | When real outpaint/inpaint ships and passes QA |
| 调色盘 CSS mode | Kept | When real color grading executor ships |

---

## Toolbar Entry Hierarchy (Post-Phase-1)

```
工具
├─ 🎥 导演
│   ├─ 摄影机控制
│   └─ 镜头词典
├─ 💡 光线
│   └─ 场景光线
├─ ✨ 提示词
│   └─ 提示词增强
├─ 🖼 画面    (requires hasMediaResult)
│   ├─ 重构图 (5 modes — CSS preview)
│   └─ 全屏预览
├─ ✂ 后期    (requires hasMediaResult)
│   ├─ 调色盘
│   └─ 视觉风格包
└─ ⚡ 资产再创作    (image node + hasMediaResult only)
    ├─ ✂ 主体抠图    [NEW — honest executor state]
    └─ ⬆ 高清重建    [NEW — replaces fake 增强 SOON]
```
