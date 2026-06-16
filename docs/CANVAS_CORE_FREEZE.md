# Canvas Core Freeze — Boundary Document

**Status:** ACTIVE FREEZE  
**Date:** 2026-06-16  
**Why:** Canvas stability must precede further tool development.  
**Owner:** Must be reviewed by founder before any modification to FROZEN functions.

---

## 1. Why This Freeze Exists

Four user-reported problems triggered this freeze:

| # | Problem | Root cause category |
|---|---|---|
| 1 | **资产生成慢** | Provider latency + lack of generation state machine |
| 2 | **画布缓冲时间长** | Project load blocks render; localStorage draft restore logic complex |
| 3 | **工具布局混乱、分布太散** | 16+ tool panels launched from scattered entry points across toolbar / dialog / node actions |
| 4 | **画布结构不稳定，新工具经常影响核心使用** | All tool state, tool panel open/close flags, and tool prompt injection live directly inside `VisualCanvasWorkspace.tsx` (9,569 lines, 124 useCallbacks, 31 useEffects, 80+ tool state references) |

The primary structural failure: **VisualCanvasWorkspace is a god component**. New tools add state, imports, and side-effects directly into it. There is no isolation between canvas core logic and tool logic.

---

## 2. Canvas Core File Inventory

### 2A. CORE files (must freeze)

| File | Lines | Responsibility | Risk Level |
|---|---|---|---|
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | 9,569 | God component: nodes, edges, save/load, generation dispatch, all tool state | **CRITICAL** |
| `apps/web/src/components/create/CanvasNodeCard.tsx` | 3,792 | Node display, media preview, error states, generation status | HIGH |
| `apps/web/src/components/create/CanvasPromptBox.tsx` | 777 | Generation dialog, prompt input, billing mode, provider selector | HIGH |
| `apps/web/src/lib/canvas/media-urls.ts` | ~80 | URL resolution for image/video preview candidates | MEDIUM |
| `apps/web/src/app/api/generate/image/route.ts` | ~600 | Image generation route → cn-executor dispatch | HIGH |
| `apps/web/src/app/api/generate/video/route.ts` | 1,124 | Video generation route → cn-executor dispatch | HIGH |
| `apps/web/src/app/api/generate/text/route.ts` | ~300 | Text generation route → provider | MEDIUM |
| `apps/web/src/app/api/media/proxy/route.ts` | 341 | Media proxy: auth → 307 redirect (mp4) or stream | HIGH |
| `apps/web/src/lib/provider-accounts/service.ts` | ~300 | Provider account CRUD, key encryption, endpointId validation | HIGH |

### 2B. TOOL files (isolated — good)

| File | Tool | Status |
|---|---|---|
| `CinematicCameraControlPanel.tsx` | Camera wheels | Panel isolated; state leaks into core |
| `SceneLightingControlPanel.tsx` | Lighting wheels | Panel isolated; state leaks into core |
| `CharacterBiblePanel.tsx` | Character bible | Panel isolated; state leaks into core |
| `SceneBiblePanel.tsx` | Scene bible | Panel isolated; state leaks into core |
| `ShotListBuilderPanel.tsx` | Shot list | Panel isolated; ShotList triggers core via pendingAutoGenerateIds |
| `CameraLexiconPanel.tsx` | Camera lexicon | Fully isolated — inserts text fragment only |
| `PromptBoosterPanel.tsx` | Prompt booster | Mostly isolated |
| `ContinuityCheckerPanel.tsx` | Continuity check | Isolated — read-only |
| `CharacterLockPanel.tsx` | Character lock | Mostly isolated |
| `LookPackagePanel.tsx` / `ColorGradePalettePanel.tsx` | Color | Isolated — visual only |

### 2C. MIXED files (need future splitting)

| File | Problem |
|---|---|
| `CanvasToolDock.tsx` | Tool launcher — fine, but grows with every new tool |
| `lib/canvas/biblePromptContext.ts` | Pure util — good. But referenced deep in core generation paths |
| `lib/canvas/cameraPromptContext.ts` | Pure util — good. But referenced deep in core generation paths |
| `lib/canvas/sceneLightingPromptContext.ts` | Pure util — good. But referenced deep in core generation paths |

---

## 3. Frozen Core Functions

These functions must not be modified by any new tool without a P0-level QA review.

| Function | File | Lines | Responsibility | Freeze Level |
|---|---|---|---|---|
| `commitNodes` | VisualCanvasWorkspace | 2701 | Only safe way to mutate node array | **FROZEN** |
| `commitEdges` | VisualCanvasWorkspace | 2707 | Only safe way to mutate edge array | **FROZEN** |
| `flushLocalSnapshot` | VisualCanvasWorkspace | 3009 | Writes draft to localStorage | **FROZEN** |
| `saveCanvas` | VisualCanvasWorkspace | 3017 | Cloud save to project API | **FROZEN** |
| `scheduleCanvasSave` | VisualCanvasWorkspace | 3204 | Debounced save trigger | **FROZEN** |
| `beginNodeGeneration` | VisualCanvasWorkspace | 2721 | Duplicate-guard for generation | **FROZEN** |
| `finishNodeGeneration` | VisualCanvasWorkspace | 2729 | Cleans up generation lock | **FROZEN** |
| `callGenerationApi` | VisualCanvasWorkspace | 1744 | HTTP dispatch for all generation | **FROZEN** |
| `handleNodePatch` | VisualCanvasWorkspace | 4383 | Atomic node field update | **FROZEN** |
| `handleNodeDialogGenerate` | VisualCanvasWorkspace | 6040 | Primary generation entry point | **FROZEN** |
| `handleRegenerateNodeFromPrompt` | VisualCanvasWorkspace | 4405 | Secondary generation entry point | **FROZEN** |
| `loadCanvasFromServer` (inline useEffect) | VisualCanvasWorkspace | ~2941 | Project load + draft restore | **FROZEN** |
| `getProxiedMediaUrl` | lib/canvas/media-urls.ts | — | URL candidate resolution | **FROZEN** |
| `GET /api/media/proxy` | route.ts | 145 | Media auth + stream/redirect | **FROZEN** |
| Provider account fetch | VisualCanvasWorkspace | ~2558 | BYOK account loading | **GUARDED** |
| `pollImageGenerationTask` | VisualCanvasWorkspace | 2020 | Image polling loop | **GUARDED** |
| `pollVideoGenerationTask` | VisualCanvasWorkspace | 2055 | Video polling loop | **GUARDED** |
| `createGeneratedAsset` | VisualCanvasWorkspace | 3221 | Asset persistence after generation | **GUARDED** |
| Node graph state (nodes, edges) | VisualCanvasWorkspace | 2384-2385 | React state for canvas graph | **FROZEN** |
| Canvas pan/zoom state | VisualCanvasWorkspace | 2481-2482 | Viewport state | **FROZEN** |
| Save status state (`saveStatus`) | VisualCanvasWorkspace | 2380 | UI save indicator | **FROZEN** |

**Freeze levels:**
- `FROZEN` — no modification without founder + P0 QA sign-off
- `GUARDED` — modification allowed with GUARDED QA (type-check + lint + build + browser test before push)
- `PLUGIN_SAFE` — tool may call but not reimplement

---

## 4. Tool Invasion Audit

These tools currently have state or logic **directly inside VisualCanvasWorkspace**, which violates the plugin boundary.

| Tool | Current Integration | Invades Core? | Priority to Extract |
|---|---|---|---|
| **CharacterBible** | `characterBible` state + localStorage load/save in main useEffect + `buildBiblePromptContext` call in `handleNodeDialogGenerate` + `handleRegenerateNodeFromPrompt` | YES — state in core, prompt injection in 2 frozen paths | P1 |
| **SceneBible** | Same as CharacterBible | YES | P1 |
| **StyleBible** | Same pattern | YES | P1 |
| **CameraControl** | `cameraSettings` state + localStorage load/save in useEffect + `buildCameraPromptContext` in 2 frozen paths | YES — state in core | P1 |
| **SceneLighting** | `sceneLightingSettings` state + localStorage load/save + `buildSceneLightingPromptContext` in 2 frozen paths | YES — state in core | P1 |
| **ShotList Auto-generate** | `pendingAutoGenerateIds` state → triggers `handleRegenerateNodeFromPrompt` | YES — hooks into core generation loop | P0 |
| **StoryboardDirector** | `directorState`, `directorActiveShotId` in core state | YES — adds complex state | P2 |
| **PromptBooster** | Panel open/close state in core; inserts text to prompt | PARTIAL — open flag in core, insertion via callback | P2 |
| **CameraLexicon** | Panel open flag in core; inserts text fragment via `handleLexiconInsert` | MINIMAL — callback pattern is correct | Low |
| **CharacterLock** | Panel open flag + `handleCharacterLockInsert` callback | MINIMAL — correct pattern | Low |
| **EnabledSkills** | `enabledSkillIds` state in core; passed to `resolveCreatorSkills` | YES | P2 |

**Total tool state vars in VisualCanvasWorkspace:**
- 16 panel `isXxxOpen` flags
- 5 tool data states (characterBible, sceneBible, styleBible, cameraSettings, sceneLightingSettings)
- 2 auto-generate states (pendingAutoGenerateIds, directorState)
- 1 skills state (enabledSkillIds)

**81 references to tool state within the core monolith.**

---

## 5. Current Canvas State Budget

**VisualCanvasWorkspace.tsx at time of freeze:**
- Total lines: **9,569**
- useState calls: **~80**
- useCallback calls: **124**
- useEffect calls: **31**
- Direct import count: **72**
- Tool panel imports: **20+**

Any new tool that adds to this budget without extraction is **prohibited** under this freeze.

---

## 6. Canvas Core Freeze Boundary

### 6A. What is FROZEN (must not be changed by tools)

```
FROZEN ZONE — Canvas Core Boundary
────────────────────────────────────────────────────────
• Node graph state: nodes[], edges[]
• Canvas viewport: canvasZoom, canvasPan
• Save lifecycle: flushLocalSnapshot, saveCanvas, scheduleCanvasSave
• Load lifecycle: loadCanvasFromServer (project load + draft restore)
• Generation lifecycle: beginNodeGeneration, finishNodeGeneration,
  callGenerationApi, handleNodePatch
• Generation entry points: handleNodeDialogGenerate,
  handleRegenerateNodeFromPrompt
• Media preview: getProxiedMediaUrl, CanvasNodeCard media state
• Auth/session: getCurrentUser, provider account fetch
• API routes: /api/generate/image, /api/generate/video,
  /api/generate/text, /api/media/proxy
────────────────────────────────────────────────────────
```

### 6B. What is ALLOWED

- New tool panels as separate `.tsx` components (no state in core)
- New util functions in `lib/canvas/` that return strings or arrays
- Registering a new tool in `CanvasToolDock.tsx` (open/close only)
- Adding a prompt context contribution via `buildXPromptContext()` pattern
- Adding a chip in the generation dialog using `contributeGenerationChips` interface
- Reading node data as props (never writing node state directly)

### 6C. What is FORBIDDEN for new tools

- Adding `useState` to `VisualCanvasWorkspace.tsx`
- Adding `useEffect` to `VisualCanvasWorkspace.tsx`
- Adding new imports to `VisualCanvasWorkspace.tsx`
- Calling `commitNodes`, `commitEdges`, `flushLocalSnapshot`, `saveCanvas` from tool code
- Calling `callGenerationApi` directly from tool code
- Modifying `handleNodeDialogGenerate` or `handleRegenerateNodeFromPrompt`
- Modifying `handleNodePatch` behavior
- Adding new fields to the canvas save payload without P0 review
- Touching `apps/web/src/app/api/generate/*/route.ts` without P0 QA
- Touching `apps/web/src/app/api/media/proxy/route.ts`

---

## 7. Tool Plugin Boundary Proposal

### 7A. Proposed CanvasToolPlugin interface

Future tools must conform to this interface rather than injecting state into the core:

```typescript
// lib/canvas/tool-plugin-registry.ts (to be created)

type CanvasToolPlugin = {
  id: string
  label: string
  labelZh: string
  icon: string
  category: 'director' | 'character' | 'scene' | 'camera' | 'lighting' | 'asset' | 'qa'
  location: 'left-rail' | 'node-action' | 'generation-chip' | 'modal'

  // Tool opens its own panel; core just calls this
  openPanel?: () => void

  // Tool contributes a string section appended to the prompt BEFORE dispatch
  contributePromptContext?: (ctx: ToolPluginContext) => string

  // Tool contributes node-level action buttons (shown in node card)
  contributeNodeActions?: (node: CanvasNodeLike) => ToolNodeAction[]

  // Tool contributes chips shown in the generation dialog
  contributeGenerationChips?: (node: CanvasNodeLike) => ToolGenerationChip[]
}

type ToolPluginContext = {
  projectId: string
  nodeKind: 'image' | 'video' | 'text'
  rawPrompt: string
}
```

### 7B. How tools connect to core (target state)

```
VisualCanvasWorkspace (slim core)
  ├── reads: pluginRegistry.map(p => p.contributePromptContext(ctx))
  ├── renders: pluginRegistry.filter(p => p.location === 'left-rail')
  ├── shows in dialog: pluginRegistry.map(p => p.contributeGenerationChips(node))
  └── never: imports specific tool components directly
```

### 7C. Migration path for existing tools

| Tool | Migration step | Priority |
|---|---|---|
| Bible (Character/Scene/Style) | Extract state + localStorage to `useBibleStore` hook; core reads `bibleStore.buildContext()` | P1 |
| CameraControl | Extract to `useCameraStore`; core reads `cameraStore.buildContext()` | P1 |
| SceneLighting | Extract to `useLightingStore`; same pattern | P1 |
| ShotList auto-generate | Replace `pendingAutoGenerateIds` with plugin event emitter | P0 |
| StoryboardDirector | Lowest priority — complex; extract after P1 tools | P2 |

---

## 8. Immediate Refactor Roadmap

### P0-1 (THIS DOC) — Canvas Core Freeze Docs
- Status: DONE
- Define boundary, write this document
- Update NEXT_TASKS

### P0-2 — Generation Reliability Layer
- Unified text/image/video generation state machine
- Video generation gated (done: P0-CANVAS-GENERATION-RELIABILITY-SHIELD)
- Explicit error codes: preview failure ≠ generation failure
- Generation stage visualized in node (queued → running → done/error)
- No duplicate generation dispatch possible
- Polling bounded (image: 12 polls × 5s = 60s max; video: 24 polls)
- Scope: VisualCanvasWorkspace generation functions only; no tool changes

### P0-3 — Media Preview Isolation
- Video click-to-load (done: a009517)
- Image preview: lazy load when node enters viewport
- preview error state scoped to CanvasNodeCard only — never changes node.status
- Media proxy: no change (307 redirect already stable)
- Raw link fallback for all failed previews
- Max 1 retry per node per session

### P0-4 — Tool Layout Restructure Plan (design-only first)
- Define 4-zone layout: Top Command Bar / Left Tool Rail / Right Inspector / Bottom Generation Dock / Modal Layer
- No implementation until P0-2 and P0-3 are QA-PASS

### P1-1 — Tool Plugin Registry
- Create `lib/canvas/tool-plugin-registry.ts`
- Migrate Bible/Camera/Lighting to hook-based state
- Remove tool state from VisualCanvasWorkspace
- Goal: reduce VisualCanvasWorkspace from 9,569 → target < 6,000 lines

---

## 9. Forbidden Actions (Hard Rules)

1. **No new `useState` in `VisualCanvasWorkspace.tsx`** — every new state increases blast radius
2. **No new `useEffect` in `VisualCanvasWorkspace.tsx`** — ordering bugs are hard to debug
3. **No new tool panel imports in `VisualCanvasWorkspace.tsx`** — use plugin registry when available
4. **No new prompt injection in `handleNodeDialogGenerate`** — use `contributePromptContext` interface
5. **No changes to save/load/draft path** — canvas data loss is P0 incident
6. **No changes to generation dispatch** without GUARDED QA
7. **No changes to `CanvasNodeCard.tsx` media state machine** — preview error must stay isolated from node.status
8. **No video generation** until ENABLE_PLATFORM_VIDEO_GENERATION=true or BYOK enabled (enforced by server guard)

---

## 10. Reference Counts at Freeze Date (2026-06-16)

```
VisualCanvasWorkspace.tsx
  Lines:        9,569
  useState:       ~80
  useCallback:    124
  useEffect:       31
  Imports:         72
  Tool state refs: 81

CanvasNodeCard.tsx
  Lines:        3,792

CanvasPromptBox.tsx
  Lines:          777

Total canvas component code: ~14,138 lines
Target after P1-1 plugin registry: < 11,000 lines
```
