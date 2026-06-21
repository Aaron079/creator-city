# AI Director V1 — Architecture Design
## Creator City — Data Pipeline & Judgment Engine

> **Status**: DESIGN_ONLY — No code, no commit, no deploy. Awaiting Founder approval.
>
> **Prerequisite**: Read `AI_DIRECTOR_PROFESSIONAL_STANDARD.md` first.
>
> **Last updated**: 2026-06-21

---

## 1. V1 Design Constraints

The V1 AI Director operates within strict boundaries:

- **Read-only**: Never writes to DB, never calls generate routes, never triggers Provider
- **Deterministic**: All judgments derivable from existing data without LLM inference
- **In-process**: Runs client-side in the browser — no new API routes
- **No schema migration**: Uses only fields already in the DB
- **No new dependencies**: Pure TypeScript logic from existing data structures

---

## 2. Data Source Map — Available vs Missing

### AVAILABLE — Can be read today

| Data | Location | Schema Path | Notes |
|---|---|---|---|
| Character Bible | cloud | `canvasWorkflow.metadataJson.characterBible` | Array of character objects; loaded via /api/projects/[id]/canvas |
| Scene Bible | cloud | `canvasWorkflow.metadataJson.sceneBible` | Array of scene objects |
| Style Bible | cloud | `canvasWorkflow.metadataJson.styleBible` | Optional; may be null |
| Shot Sequence | cloud | `canvasWorkflow.metadataJson.shotSequence` | Added 2026-06-21; version+items+updatedAt |
| Node kind | cloud | `canvasNode.kind` | 'image' \| 'video' \| 'text' |
| Node status | cloud | `canvasNode.status` | 'idle' \| 'generating' \| 'completed' \| 'failed' \| 'cancelled' |
| Node errorCode | cloud | `canvasNode.errorCode` | Error classification string |
| Node prompt | cloud | `canvasNode.prompt` | Raw user prompt |
| Node tool summary | cloud | `canvasNode.metadataJson.toolSummaryText` | Summary from director tool |
| Generation draft | cloud | `canvasNode.metadataJson.generationDraft` | { prompt, providerId, aspectRatio, inputImages } |
| Source node title | cloud | `canvasNode.metadataJson.sourceNodeTitle` | For derived nodes |
| Derived tool channel | cloud | `canvasNode.metadataJson.derivedToolChannel` | { label, icon, color } |
| Asset ID | cloud | `canvasNode.metadataJson.assetId` | Set when generation completes |
| Generation job ID | cloud | `canvasNode.metadataJson.generationJobId` | For polling |
| Project title | cloud | `project.title` | |
| Project description | cloud | `project.description` | |
| Camera settings | localStorage | `nodeDirectorContextStorage` | Per-node camera/lighting context |
| Shot list | cloud | `canvasNode` where derived from ShotListBuilderPanel | Nodes created by shot list tool |
| Workflow viewport | cloud | `canvasWorkflow.viewportJson` | Zoom + pan state |

### MISSING — Required for full Director judgment

| Data | Notes | V1 workaround |
|---|---|---|
| `directorBrief` | projectType, targetDuration, genre, coreTheme, leadingEmotion, narrativePOV, visualTone, pacing | Store in `canvasWorkflow.metadataJson.directorBrief` — no schema migration needed; UI to collect it is the gap |
| Act/Sequence/Scene hierarchy | No structured scene → shot mapping exists; only flat workflow | Infer from sceneBible scenes vs. node prompts (fuzzy) |
| Shot-level metadata | No shotId, sceneId, sequenceId per node | Not available in V1 |
| Continuity metadata | Screen direction, eyeline, costume state between shots | Not available in V1 |
| Generated asset preview in Director context | Director panel would need to render completed assets | Available via assetId — requires CDN URL resolution |

### DATA AVAILABILITY SUMMARY

| Judgment Dimension | Data Available | V1 Feasibility |
|---|---|---|
| 1. Script Coverage | characterBible + sceneBible + shotSequence | FEASIBLE |
| 2. Shot Completeness | canvasNode.kind + prompt (no coverage-type field) | PARTIAL — can count nodes per scene-keyword match |
| 3. Character Continuity | characterBible + node.prompt | PARTIAL — keyword match only |
| 4. Scene Continuity | sceneBible + node.prompt | PARTIAL — keyword match only |
| 5. Shot Sequence Integrity | shotSequence.items + canvas nodeIds | FEASIBLE — deterministic |
| 6. Generation Status | canvasNode.status + errorCode | FEASIBLE |
| 7. Visual Register Alignment | node.prompt vs. directorBrief.visualTone | V2 (requires AI inference) |
| 8. Pacing Audit | shotSequence.length + directorBrief.targetDuration + pacing | FEASIBLE with Brief |
| 9. Emotional Arc | directorBrief.leadingEmotion + sceneBible | V2 (requires AI inference) |
| 10. Narrative POV Compliance | directorBrief.narrativePOV + node.prompt | V2 (requires AI inference) |
| 11. Asset Availability | canvasNode.metadataJson.assetId + status | FEASIBLE |
| 12. Error Recovery Priority | errorCode + errorStage + stageTrace | FEASIBLE |

---

## 3. V1 Read-Only Data Pipeline

```
[Canvas Load] (/api/projects/[id]/canvas response)
     │
     ▼
canvasWorkflow.metadataJson
     ├── characterBible?      → character index
     ├── sceneBible?          → scene index
     ├── shotSequence?        → ordered shot list
     ├── directorBrief?       → configuration gate [V1: optional; V2: required]
     └── styleBible?          → visual register reference
     
canvasNodes[]
     ├── id, kind, status, errorCode, prompt
     └── metadataJson
           ├── toolSummaryText
           ├── generationDraft { prompt, providerId }
           ├── assetId
           └── derivedToolChannel

     │
     ▼
[DirectorJudgmentEngine.evaluate(data)]
     │
     ├── runDimensionChecks(1–6, 8, 11, 12)   ← V1 deterministic
     │        returns: DirectorRecommendation[]
     │
     └── [V2 hooks — NOT IN V1]
          ├── runSemanticAlignment(7, 9, 10)    ← LLM inference
          └── runContinuityAudit()              ← Vision model
     
     │
     ▼
[DirectorRecommendation[]]
     ├── sorted by priority ASC
     ├── grouped by type (BLOCKING first)
     └── rendered in DirectorDashboard component

[User sees recommendations — no writes, no generate calls]
```

---

## 4. Deterministic Check Library — V1 Implementation

These are the exact checks the V1 engine runs. Each is a pure function: `(data: DirectorData) => DirectorRecommendation | null`.

### Check 1.1 — Character Bible Empty

```typescript
function checkCharacterBibleEmpty(data: DirectorData): DirectorRecommendation | null {
  if (data.characterBible && data.characterBible.length > 0) return null
  const nodesWithCharRef = data.nodes.filter(n => n.prompt && n.prompt.length > 0)
  if (nodesWithCharRef.length === 0) return null
  return {
    id: 'char-bible-empty',
    type: 'BLOCKING',
    dimension: 1,
    priority: 1,
    headline: '角色圣经为空：无法验证角色一致性',
    rationale: `characterBible 为空，但画布中有 ${nodesWithCharRef.length} 个节点包含文本描述。生成角色前请先建立角色圣经。`,
    ...
  }
}
```

### Check 1.2 — Scene Bible Empty

```typescript
function checkSceneBibleEmpty(data: DirectorData): DirectorRecommendation | null {
  if (data.sceneBible && data.sceneBible.length > 0) return null
  if (data.nodes.filter(n => n.kind !== 'text').length === 0) return null
  return {
    id: 'scene-bible-empty',
    type: 'RISK',
    dimension: 1,
    priority: 3,
    headline: '场景圣经为空：无法验证镜头与场景的对应关系',
    ...
  }
}
```

### Check 5.1 — Shot Sequence Orphaned Nodes

```typescript
function checkSequenceOrphanedNodes(data: DirectorData): DirectorRecommendation | null {
  if (!data.shotSequence || data.shotSequence.items.length === 0) return null
  const nodeIdSet = new Set(data.nodes.map(n => n.id))
  const orphaned = data.shotSequence.items.filter(item => !nodeIdSet.has(item.nodeId))
  if (orphaned.length === 0) return null
  return {
    id: `seq-orphan-${orphaned.map(o => o.nodeId).join('-')}`,
    type: 'RISK',
    dimension: 5,
    priority: 2,
    headline: `分镜顺序中有 ${orphaned.length} 个条目指向不存在的节点`,
    ...
  }
}
```

### Check 5.2 — Shot Sequence Empty When Nodes Exist

```typescript
function checkSequenceEmptyWithNodes(data: DirectorData): DirectorRecommendation | null {
  const generatableNodes = data.nodes.filter(n => n.kind === 'image' || n.kind === 'video')
  if (!data.shotSequence || data.shotSequence.items.length > 0) return null
  if (generatableNodes.length < 2) return null
  return {
    id: 'seq-empty-with-nodes',
    type: 'RECOMMENDATION',
    dimension: 5,
    priority: 6,
    headline: `画布中有 ${generatableNodes.length} 个镜头节点，但分镜顺序尚未建立`,
    ...
  }
}
```

### Check 6.1 — Failed Nodes Count

```typescript
function checkFailedNodes(data: DirectorData): DirectorRecommendation | null {
  const failed = data.nodes.filter(n => n.status === 'failed')
  if (failed.length === 0) return null
  return {
    id: `failed-nodes-${failed.length}`,
    type: 'RISK',
    dimension: 6,
    priority: 2,
    headline: `${failed.length} 个节点生成失败，需要处理`,
    ...
  }
}
```

### Check 8.1 — Pacing Budget (requires directorBrief)

```typescript
function checkPacingBudget(data: DirectorData): DirectorRecommendation | null {
  const brief = data.directorBrief
  if (!brief?.targetDuration || !brief?.pacing) return null
  if (!data.shotSequence || data.shotSequence.items.length === 0) return null
  const impliedShotLength = brief.targetDuration / data.shotSequence.items.length
  const pacingBenchmarks: Record<string, [number, number]> = {
    slow: [8, 20],
    deliberate: [5, 10],
    medium: [3, 7],
    kinetic: [2, 4],
    frenetic: [0.5, 2],
  }
  const [min, max] = pacingBenchmarks[brief.pacing] ?? [3, 7]
  if (impliedShotLength >= min && impliedShotLength <= max) return null
  // Out of range — emit recommendation
  ...
}
```

### Check 11.1 — Asset Availability Ratio

```typescript
function checkAssetAvailability(data: DirectorData): DirectorRecommendation | null {
  const generatableNodes = data.nodes.filter(n => n.kind === 'image' || n.kind === 'video')
  if (generatableNodes.length === 0) return null
  const completedWithAsset = generatableNodes.filter(
    n => n.status === 'completed' && n.metadataJson?.assetId
  )
  const ratio = completedWithAsset.length / generatableNodes.length
  // Only surface this if < 50% complete and > 5 nodes exist
  if (ratio >= 0.5 || generatableNodes.length < 5) return null
  return {
    id: `asset-availability-${completedWithAsset.length}-of-${generatableNodes.length}`,
    type: 'INFORMATION_MISSING',
    dimension: 11,
    priority: 8,
    headline: `${completedWithAsset.length} / ${generatableNodes.length} 个节点已完成生成并拥有可用资产`,
    ...
  }
}
```

---

## 5. DirectorJudgmentEngine — Module Interface

```typescript
// apps/web/src/lib/director/judgment-engine.ts

export interface DirectorData {
  projectId: string
  projectTitle: string
  nodes: CanvasNode[]
  characterBible: CharacterBibleData | null
  sceneBible: SceneBibleData | null
  shotSequence: ShotSequenceState | null
  directorBrief: DirectorBrief | null
  styleBible: string | null
}

export function evaluateDirectorJudgment(data: DirectorData): DirectorRecommendation[] {
  const checks: Array<(data: DirectorData) => DirectorRecommendation | null> = [
    checkCharacterBibleEmpty,
    checkSceneBibleEmpty,
    checkSequenceOrphanedNodes,
    checkSequenceEmptyWithNodes,
    checkFailedNodes,
    checkPacingBudget,
    checkAssetAvailability,
    checkBriefMissingFields,
    checkGenerationStatusRatio,
    checkSceneCoverage,
  ]
  return checks
    .map(fn => fn(data))
    .filter((r): r is DirectorRecommendation => r !== null)
    .sort((a, b) => a.priority - b.priority)
}
```

This is a pure function. No side effects, no fetches, no state mutations.

---

## 6. Tool Routing — Action Targets

When a recommendation has an action, it must route to an existing UI target. V1 uses these action targets:

```typescript
type DirectorActionTarget =
  | { panel: 'character-bible' }
  | { panel: 'scene-bible' }
  | { panel: 'shot-sequencer' }
  | { panel: 'director-brief' }        // New panel needed in V1
  | { panel: 'shot-list' }
  | { action: 'select-node'; nodeId: string }
  | { action: 'create-node'; suggestedKind: 'image' | 'video'; suggestedPromptHint: string }
  | { action: 'open-generation-dialog'; nodeId: string }
  | { action: 'open-right-inspector'; nodeId: string }
  | { action: 'none' }                 // Informational only
```

Panel routing must call the existing `openCanvasPanel()` mechanism in VisualCanvasWorkspace.tsx — no new event buses, no new state.

Node selection must call `setActiveNodeId(nodeId)` + `setIsRightInspectorOpen(true)` — existing callbacks.

---

## 7. Director Brief UI — Data Collection Entry Point

The Director Brief is the input gate. Without it, 7 of 12 judgment dimensions are unavailable.

V1 brief storage: `canvasWorkflow.metadataJson.directorBrief`

V1 write path:
1. User fills brief form in DirectorBriefPanel (new panel in tool dock)
2. Panel calls `onSaveBrief(brief)` callback
3. VCW sends PUT `/api/projects/[id]/canvas` with `workflowMetadata: { directorBrief: brief }`
4. Route merges into metadataJson (same pattern as shotSequence)
5. VCW state updates; Director panel re-evaluates

This uses the existing `workflowMetadata` extension already built for shotSequence persistence. No additional API work needed.

---

## 8. V2 AI Analysis Hooks — Design Notes (Not in V1)

These hooks are reserved for V2 and must not be implemented in V1.

### Hook V2.1 — Visual Register Alignment (Dimension 7)

```typescript
// POST /api/director/analyze/visual-register
// Input: node.prompt[] + directorBrief.visualTone
// Output: per-node alignment score + explanation
// Model: claude-haiku-4-5 (fast, cheap)
// Constraint: read-only, no generate calls
```

### Hook V2.2 — Emotional Arc Analysis (Dimension 9)

```typescript
// POST /api/director/analyze/emotional-arc
// Input: sceneBible.scenes[] ordered by shotSequence
// Output: per-scene emotional register + arc gap detection
// Model: claude-sonnet-4-6
```

### Hook V2.3 — POV Compliance (Dimension 10)

```typescript
// POST /api/director/analyze/pov-compliance
// Input: node.prompt[] + directorBrief.narrativePOV
// Output: per-node POV signal + violation list
// Model: claude-haiku-4-5
```

V2 hooks add `confidence: 'ai_inferred'` recommendations. These display with a different visual treatment (evidence drawer, confidence disclosure) and are filterable by the user.

---

## 9. Safety Boundaries

### What V1 Director CAN do

- Read any field from the canvas data already loaded in memory
- Call `evaluateDirectorJudgment()` — a pure function
- Call `openCanvasPanel()` to route to existing panels
- Call `setActiveNodeId()` to select nodes

### What V1 Director CANNOT do

- POST to any generate route
- POST to any Provider API
- Modify any canvasNode
- Modify any canvasWorkflow field (except Director Brief via existing PUT extension)
- Read from Supabase directly
- Use streaming
- Load external resources (CDN, external APIs)

---

## Document Status

- **Version**: 1.0.0-draft
- **Author**: Claude Sonnet 4.6 (DESIGN_ONLY — no code)
- **Approval required from**: Founder
- **Blocks**: AI_DIRECTOR_DASHBOARD_V1 implementation
