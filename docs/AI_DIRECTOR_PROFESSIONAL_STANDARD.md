# AI Director Professional Standard
## Creator City — Director Judgment Specification V1

> **Document Purpose**: Define the professional standard that the AI Director module must meet before shipping to users. This is the source of truth for what "good judgment" means in this system.
>
> **Status**: APPROVED / DESIGN_FROZEN — Founder approved 2026-06-21. These three design docs are frozen as reference standards. No code implementation until explicitly authorized.
>
> **Last updated**: 2026-06-21

---

## FROZEN CONSTRAINTS (Founder-Approved, Non-Negotiable)

> These constraints were added by Founder approval on 2026-06-21 and apply to all current and future AI Director implementation.

### Constraint F-1: Director Brief is User-Edited Only

**Director Brief 是用户主动编辑并保存的项目元数据，不属于 AI Director 的自动写入。**

The AI Director V1 judgment engine is strictly **read-only**. It reads the Director Brief; it does not write, patch, auto-fill, or suggest overwrites to the Director Brief.

- The user opens the Director Brief panel and types their own values.
- The AI Director reads those values as ground truth.
- No AI-generated draft pre-fill of Brief fields.
- No "auto-update brief based on your canvas" feature.
- No diff/merge of AI-suggested Brief vs. user Brief.

This constraint applies to V1 and must be explicitly re-evaluated before any V2 auto-write feature is designed.

### Constraint F-2: No Fake Scores or Percentages

**禁止艺术质量综合分、虚构百分比、电影节成熟度评分。**

The only status values permitted in Director output are:

| Status | Meaning |
|---|---|
| `Complete` | Criterion is met with evidence |
| `In Progress` | Work is started; specific gaps remain |
| `At Risk` | Criterion likely unmet based on current state |
| `Blocked` | Cannot be evaluated — prerequisite missing |
| `Needs Review` | Ambiguous state; human judgment required |
| `Missing Data` | Required input (Director Brief field or canvas data) is absent |

**Prohibited outputs:**

- Composite scores: `"Quality Score: 73/100"` — BLOCKED
- Fake percentages: `"Production Readiness: 82%"` — BLOCKED
- Film festival ratings: `"Festival Maturity: B+"` — BLOCKED
- Any numeric aggregation of subjective creative quality — BLOCKED

Each recommendation must be evidenced by specific node data, Brief content, or observable canvas state. Not by a formula.

---

## 1. Product Positioning

Creator City's AI Director is **not a chatbot** and **not a recommendation feed**.

It is a **production decision support system** that operates like a senior director who has read every department's work and can tell you — with precision — what the film needs next and why.

The core value proposition:

> "Before you generate another shot, here is what the script says you need, what you are currently missing, and the exact next action to close the gap."

### Director vs. First AD — Role Separation

The AI Director system must never collapse these two distinct roles:

| Dimension | Director | First AD |
|---|---|---|
| Concern | Creative coherence, visual storytelling, emotional arc | Production order, efficiency, workflow sequencing |
| Judgment type | "This scene needs a reaction shot — the character motivation is unclear without it" | "You have 4 shots pending generation — sequence them Image→Video to avoid idle GPU time" |
| Trigger | Story gap, continuity break, thematic inconsistency | Queue state, asset availability, dependency unlock |
| Language | Scene, beat, emotion, composition, POV | Shot, node, status, sequence, generation |
| Authority level | Blocks creative decisions | Optimizes execution order |

The UI must present both roles but clearly distinguish them. A Director Brief is not a production schedule. A production sequence is not a creative note.

---

## 2. Director Brief — Required Input Fields

The AI Director cannot function without a Director Brief. Without it, all judgment is speculative. The Brief is the contract between the director and the system.

### V1 Required Fields (must be present for Director panel to activate)

| Field | Type | Example | Why Required |
|---|---|---|---|
| `projectType` | enum | `short_film \| music_video \| commercial \| documentary \| series_pilot` | Determines pacing norms, shot count expectations, genre conventions |
| `targetDuration` | number (seconds) | `180` | Drives shot budget, coverage requirements |
| `genre` | string | `"psychological thriller"` | Sets visual register, color temperature expectations |
| `coreTheme` | string (1 sentence) | `"Grief transforms into obsession when left unwitnessed"` | Used to evaluate whether each scene serves the film |
| `leadingEmotion` | string | `"dread"` | Used to audit shot-level emotional register |
| `narrativePOV` | enum | `first_person \| third_person_limited \| omniscient \| unreliable` | Drives camera distance and coverage rules |
| `visualTone` | string | `"desaturated, natural light, handheld"` | Used to flag aesthetic inconsistencies |
| `pacing` | enum | `slow \| deliberate \| medium \| kinetic \| frenetic` | Drives cut frequency expectations |

### V1 Optional Enrichment (improves judgment quality but not required)

| Field | Type | Example |
|---|---|---|
| `scriptSynopsis` | string | 3–5 sentence plot summary |
| `targetAudience` | string | `"festival circuit, art house"` |
| `referenceTitles` | string[] | Real film titles user cites as tone references |
| `budgetTier` | enum | `micro \| low \| mid` |
| `deliverableFormat` | string | `"4K DCP, 1.85:1 aspect"` |

### V1 Data Status: NOT IN DB

The Director Brief fields listed above do not exist in the current database schema. The `canvasWorkflow.metadataJson` JSONB field can store them, but there is no UI to collect them yet.

**V1 approach**: Store in `canvasWorkflow.metadataJson.directorBrief` via the existing metadataJson extension pattern. No schema migration required.

---

## 3. Professional Judgment Matrix — 12 Dimensions

The AI Director evaluates the project across 12 dimensions. Each dimension has a defined data source, a deterministic check, and a judgment output.

| # | Dimension | Data Source (V1) | What is Checked | Output Type |
|---|---|---|---|---|
| 1 | **Script Coverage** | characterBible + sceneBible + shotSequence | Are all identified scenes represented by at least one completed shot? | Gap list |
| 2 | **Shot Completeness** | canvasNodes (kind + status) | Do scenes have sufficient coverage (wide, medium, close)? | Missing coverage |
| 3 | **Character Continuity** | characterBible + generationDraft.prompt | Are character descriptions consistent across nodes that feature the same character? | Inconsistency flag |
| 4 | **Scene Continuity** | sceneBible + generationDraft.prompt | Do scene descriptions match the nodes that represent them? | Mismatch flag |
| 5 | **Shot Sequence Integrity** | shotSequence.items | Are there ordering gaps? Duplicate shots? Shots without source nodes? | Sequence audit |
| 6 | **Generation Status** | canvasNode.status + errorCode | What is the ratio of completed / pending / failed shots? | Production readiness % |
| 7 | **Visual Register Alignment** | generationDraft.prompt + directorBrief.visualTone | Do prompt descriptions match the stated visual tone? | Per-node flags |
| 8 | **Pacing Audit** | shotSequence + directorBrief.pacing + directorBrief.targetDuration | Given the shot count and target duration, what is the implied shot length? Does it match pacing intention? | Duration analysis |
| 9 | **Emotional Arc** | directorBrief.leadingEmotion + sceneBible scenes | Does the sequence of scenes build or sustain the leading emotion? | Arc gap |
| 10 | **Narrative POV Compliance** | directorBrief.narrativePOV + prompt content | Are camera distance/movement descriptions consistent with stated POV? | Per-node audit |
| 11 | **Asset Availability** | canvasNode.status=completed + assetId | What percentage of the sequence has deliverable assets? | Asset readiness |
| 12 | **Error Recovery Priority** | errorCode + errorStage | Which failed shots are blocking downstream work? | Priority-ordered error list |

### V1 Implementation Constraint

Dimensions 7, 9, 10 require LLM analysis (semantic similarity between prompts and brief fields). These are **V2 AI analysis hooks** — not in V1 scope.

V1 implements dimensions 1–6, 8, 11, 12 deterministically from existing data fields. No AI inference in V1.

---

## 4. Judgment Types — Classification System

Every AI Director output must be classified as exactly one of the following types. The type determines visual treatment, urgency, and whether it blocks the user.

| Type | Badge Color | Blocks Generation? | Example |
|---|---|---|---|
| `BLOCKING` | Red | Yes — disables generate on affected nodes | "Character Bible is empty. All nodes referencing 主角 will produce inconsistent results until a character description is saved." |
| `RISK` | Amber | No — warns but does not block | "Shot sequence has 7 items but only 4 source nodes have completed assets. 3 sequence entries are pending generation." |
| `RECOMMENDATION` | Blue | No | "Scene 3 (咖啡馆争吵) has no close-up coverage. Consider adding a reaction shot of 主角 after the confrontation line." |
| `ALTERNATIVE` | Purple | No | "You have two wide shots of 工厂 (nodes #4 and #7) with nearly identical prompts. Consider replacing one with a medium or close-up to add visual variety." |
| `INFORMATION_MISSING` | Gray | No | "Director Brief is incomplete. Target duration and genre are required to enable pacing analysis. Complete the Brief to unlock full Director judgment." |

Rules:
- A `BLOCKING` item must cite the exact field or node that is missing/inconsistent.
- A `RISK` item must cite the exact count and node IDs affected.
- A `RECOMMENDATION` must name the specific scene, shot position, and what type of shot is recommended.
- An `ALTERNATIVE` must reference the specific nodes it is comparing.
- An `INFORMATION_MISSING` must list the exact fields that are absent.

---

## 5. Recommendation Schema

Every recommendation output by the AI Director must conform to this schema.

```typescript
interface DirectorRecommendation {
  // Identity
  id: string                    // Stable deterministic hash of (type + dimension + subject)
  type: JudgmentType            // BLOCKING | RISK | RECOMMENDATION | ALTERNATIVE | INFORMATION_MISSING
  dimension: number             // 1–12 from the judgment matrix
  priority: number              // 1 = highest urgency; used for display sort order

  // Subject — what this recommendation is about
  subject: {
    kind: 'node' | 'scene' | 'sequence' | 'character' | 'brief' | 'project'
    nodeIds?: string[]          // Specific canvas node IDs if applicable
    sceneId?: string            // From sceneBible
    characterId?: string        // From characterBible
    sequencePosition?: number   // From shotSequence.items[n].order
  }

  // Headline — what the director sees first
  headline: string              // Max 80 chars. Active voice. Specific.

  // Explanation — why this matters
  rationale: string             // 1–3 sentences. Cite the data. No speculation.

  // Action — what to do
  action: {
    label: string               // Button or link label, e.g. "打开场景圣经", "添加镜头"
    target: DirectorActionTarget
  }

  // Evidence — the data that drove this judgment
  evidence: {
    field: string               // e.g. "sceneBible.scene[2].description"
    currentValue: unknown       // Actual current value from data
    expectedValue?: unknown     // What is expected (for mismatch cases)
    affectedNodeCount?: number
  }

  // Confidence
  confidence: 'deterministic' | 'heuristic' | 'ai_inferred'
  // V1 only emits 'deterministic'. Never emit fake percentages.

  // Suppression
  dismissedAt?: string          // ISO timestamp if user has dismissed this item
  suppressedUntil?: string      // ISO timestamp if user has snoozed
}
```

---

## 6. Prohibition List — What the AI Director Must Never Do

These are hard prohibitions. Any implementation that violates them must be blocked in code review.

### P1 — Never fabricate specificity

```
BAD: "Consider adding more emotional depth to your shots."
GOOD: "Scene 2 (雨中告别) has no node with a prompt referencing 悲伤 or the character 小明. Add a close-up of 小明's face during the farewell."
```

The AI Director must never give advice that applies to any film equally. Every recommendation must be derivable from the actual project data.

### P2 — Never cite fake percentages

```
BAD: "Your project is 73% complete."
GOOD: "4 of 7 sequence shots have completed assets. 3 shots are pending generation."
```

Percentages are only allowed when derived from exact counts (completed nodes / total nodes). Never round or estimate.

### P3 — Never cite fictional films as references

```
BAD: "Like Kubrick's use of symmetry in The Shining, your factory scene would benefit from..."
GOOD: "The two wide shots of 工厂 (nodes #4, #7) have nearly identical framing descriptions. Adding a medium shot would create visual variety within the scene."
```

The AI Director does not have access to film databases. It can only reason from the data inside the project. Fabricated film references erode trust.

### P4 — Never generate content unprompted

The AI Director is read-only in V1. It cannot:
- Trigger generation
- Modify nodes
- Save to the database
- Call any API

Every action must be user-initiated. The Director provides the judgment; the user takes the action.

### P5 — Never show Director panel without a Brief

If the Director Brief is missing or incomplete, the panel must show the `INFORMATION_MISSING` state — listing exactly which fields are absent — and disable all other judgment output.

```
GOOD: "Director Brief is incomplete. Add: genre, targetDuration, leadingEmotion to enable coverage analysis."
BAD: [Show coverage analysis with generic warnings]
```

### P6 — Never collapse Director and First AD judgment into one list

Separate concerns:
- Director judgment (creative, story, visual): shown in Director tab
- First AD judgment (production order, sequencing, status): shown in First AD tab

Mixing them produces confusion and dilutes both roles.

---

## 7. Complete Recommendation Examples

### Example 1 — BLOCKING: Empty Character Bible

```json
{
  "id": "block-char-bible-empty-20260621",
  "type": "BLOCKING",
  "dimension": 1,
  "priority": 1,
  "subject": { "kind": "character" },
  "headline": "角色圣经为空：所有包含「主角」的节点将生成不一致的角色外观",
  "rationale": "characterBible 当前为空。画布中有 5 个节点的 prompt 包含「主角」，但没有统一的外观描述。不同节点生成的主角将无法保持一致性，导致无法剪辑成连贯影片。",
  "action": {
    "label": "打开角色圣经",
    "target": { "panel": "character-bible" }
  },
  "evidence": {
    "field": "characterBible",
    "currentValue": null,
    "affectedNodeCount": 5
  },
  "confidence": "deterministic"
}
```

### Example 2 — RISK: Sequence Has Orphaned Entries

```json
{
  "id": "risk-seq-orphan-node7-20260621",
  "type": "RISK",
  "dimension": 5,
  "priority": 2,
  "subject": {
    "kind": "sequence",
    "nodeIds": ["node-07", "node-11"],
    "sequencePosition": 4
  },
  "headline": "分镜顺序中有 2 个条目指向不存在的节点",
  "rationale": "shotSequence.items[3] 和 items[6] 的 nodeId 分别为 node-07 和 node-11，但画布中不存在这两个节点。它们可能已被删除。顺序中的空位会导致导出时帧缺失。",
  "action": {
    "label": "打开分镜顺序",
    "target": { "panel": "shot-sequencer" }
  },
  "evidence": {
    "field": "shotSequence.items",
    "currentValue": [
      { "order": 4, "nodeId": "node-07" },
      { "order": 7, "nodeId": "node-11" }
    ],
    "expectedValue": "All nodeIds must exist in current canvas nodes"
  },
  "confidence": "deterministic"
}
```

### Example 3 — RECOMMENDATION: Missing Coverage Type

```json
{
  "id": "rec-coverage-scene2-closeup-20260621",
  "type": "RECOMMENDATION",
  "dimension": 2,
  "priority": 5,
  "subject": {
    "kind": "scene",
    "sceneId": "scene-02",
    "nodeIds": ["node-03", "node-04"]
  },
  "headline": "场景 2（雨中告别）只有远景，缺少特写覆盖",
  "rationale": "sceneBible.scene[1]「雨中告别」包含 2 个节点（node-03 远景, node-04 全景）。根据叙事 POV（第三人称限制视角）和核心情绪（悲伤），此场景需要至少一个主角面部特写以传达情感转折。",
  "action": {
    "label": "添加特写节点",
    "target": { "action": "create-node", "suggestedKind": "image", "suggestedPromptHint": "close-up, 主角, 雨中, 悲伤" }
  },
  "evidence": {
    "field": "sceneBible.scene[1].shots",
    "currentValue": ["wide", "full"],
    "expectedValue": ["wide", "full", "close-up"]
  },
  "confidence": "deterministic"
}
```

### Example 4 — ALTERNATIVE: Duplicate Shot Angles

```json
{
  "id": "alt-dupe-factory-wide-nodes4-7",
  "type": "ALTERNATIVE",
  "dimension": 7,
  "priority": 7,
  "subject": {
    "kind": "node",
    "nodeIds": ["node-04", "node-07"]
  },
  "headline": "节点 #4 和 #7 的「工厂」场景描述高度相似，两者均为宽景",
  "rationale": "node-04 prompt: 「工厂大门，宽景，黄昏」；node-07 prompt: 「工厂外景，宽景，黄昏光线」。两个镜头的构图和光线描述接近重复。在 180 秒短片中，两个相似的宽景会造成节奏停顿。",
  "action": {
    "label": "查看节点 #7",
    "target": { "action": "select-node", "nodeId": "node-07" }
  },
  "evidence": {
    "field": "canvasNode.metadataJson.generationDraft.prompt",
    "currentValue": {
      "node-04": "工厂大门，宽景，黄昏",
      "node-07": "工厂外景，宽景，黄昏光线"
    }
  },
  "confidence": "deterministic"
}
```

### Example 5 — INFORMATION_MISSING: Brief Incomplete

```json
{
  "id": "info-brief-missing-genre-duration",
  "type": "INFORMATION_MISSING",
  "dimension": 8,
  "priority": 10,
  "subject": { "kind": "brief" },
  "headline": "Director Brief 不完整：缺少 genre 和 targetDuration，节奏分析已禁用",
  "rationale": "节奏分析需要知道目标时长（秒）和类型惯例。当前 Director Brief 缺少这两个字段。在补全前，节奏分析、镜头预算计算和剪辑频率建议均无法提供。",
  "action": {
    "label": "完善 Director Brief",
    "target": { "panel": "director-brief" }
  },
  "evidence": {
    "field": "canvasWorkflow.metadataJson.directorBrief",
    "currentValue": { "coreTheme": "孤独", "leadingEmotion": "压抑" },
    "expectedValue": { "genre": "required", "targetDuration": "required" }
  },
  "confidence": "deterministic"
}
```

### Example 6 — BLOCKING: Pacing Budget Exceeded

```json
{
  "id": "block-pacing-budget-exceeded",
  "type": "BLOCKING",
  "dimension": 8,
  "priority": 3,
  "subject": { "kind": "sequence" },
  "headline": "当前 12 个镜头在 90 秒目标时长中的隐含单镜平均时长为 7.5 秒，与「快节奏」设定不符",
  "rationale": "Director Brief 设定 pacing=kinetic，targetDuration=90s。shotSequence 目前有 12 个条目。若均匀分配，每镜 7.5 秒。快节奏类型的行业基准为 2–4 秒/镜。当前镜头数量无法支撑快节奏剪辑风格，需减少覆盖镜头数量或延长目标时长。",
  "action": {
    "label": "查看分镜顺序",
    "target": { "panel": "shot-sequencer" }
  },
  "evidence": {
    "field": "shotSequence.items.length + directorBrief.targetDuration + directorBrief.pacing",
    "currentValue": {
      "shotCount": 12,
      "targetDuration": 90,
      "impliedShotLength": 7.5,
      "pacing": "kinetic",
      "pacingBenchmark": "2–4s/shot"
    }
  },
  "confidence": "deterministic"
}
```

---

## 8. Bad Examples — What the AI Director Must Never Produce

### Bad Example 1 — Vague advice with no data citation

```
BAD OUTPUT:
"您的项目看起来很有潜力！建议您添加更多情感层次的镜头，并考虑场景之间的转换。视觉风格可以更统一。"
```

**Why this fails**:
- "看起来很有潜力" — no data basis
- "更多情感层次的镜头" — which scenes? which nodes? what emotion?
- "视觉风格可以更统一" — compared to what standard? which nodes are inconsistent?

### Bad Example 2 — Fake percentage completeness

```
BAD OUTPUT:
"您的项目完成度为 67%。继续加油！"
```

**Why this fails**:
- 67% is not derivable from any single clean data field
- "继续加油" is not a director judgment
- Does not tell the user what 33% represents or what to do

### Bad Example 3 — Fictional film reference

```
BAD OUTPUT:
"参考《八又二分之一》中费里尼对梦境场景的处理方式，您的开场场景可以尝试更超现实的影像语言，模糊现实与幻想的边界。"
```

**Why this fails**:
- The AI Director has not seen the user's project
- Citing a specific film technique implies the system has verified this applies to the current project
- The recommendation has no anchor in any actual field in the project data
- Users can reject this with "我的项目和费里尼无关" — and they would be right

---

## 9. Confidence Levels

V1 only emits `deterministic` confidence. This means:

- The judgment can be reproduced exactly given the same input data
- No LLM inference is involved
- The evidence field always cites the exact data path and value

V2 hooks (marked in the architecture doc) will introduce `heuristic` and `ai_inferred` levels. These require additional UI treatment (confidence disclosure, evidence drawer) before shipping.

---

## Document Status

- **Version**: 1.0.0-draft
- **Author**: Claude Sonnet 4.6 (DESIGN_ONLY — no code)
- **Approval required from**: Founder
- **Blocks**: AI_DIRECTOR_DASHBOARD_V1 implementation
