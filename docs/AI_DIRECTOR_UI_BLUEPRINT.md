# AI Director Dashboard — UI Blueprint V1
## Creator City — Information Architecture & Wireframes

> **Status**: DESIGN_ONLY — No code, no commit, no deploy. Awaiting Founder approval.
>
> **Prerequisite**: Read `AI_DIRECTOR_PROFESSIONAL_STANDARD.md` and `AI_DIRECTOR_V1_ARCHITECTURE.md` first.
>
> **Last updated**: 2026-06-21

---

## 1. Placement in Shell Architecture

The AI Director is a **full-panel overlay** in the canvas shell, opened from the left tool rail via a new Director button (🎬 icon, positioned below existing director tools).

It does not live in the right inspector (too narrow) or the bottom dock (wrong task mode). It occupies the full vertical space between the top command bar and the bottom dock — the same slot used by Character Bible and Scene Bible panels.

```
┌──────────────────────────────────────────────────────────────┐
│  TOP COMMAND BAR                                             │
├──┬───────────────────────────────────────────────────────────┤
│  │                                                           │
│L │  ┌──────────────────────────────────────────────────┐    │
│E │  │  AI DIRECTOR PANEL  (460px fixed width, right)   │    │
│F │  │                                                   │    │
│T │  │  [Director Brief Summary]                         │    │
│  │  │  [Tab: Director ▲  |  Tab: First AD]             │    │
│R │  │  ─────────────────────────────────────────        │    │
│A │  │  [Recommendation Cards]                           │    │
│I │  │                                                   │    │
│L │  └──────────────────────────────────────────────────┘    │
│  │                                                           │
│  │  [Canvas Stage]                                           │
│  │                                                           │
├──┴───────────────────────────────────────────────────────────┤
│  BOTTOM DOCK                                                  │
└──────────────────────────────────────────────────────────────┘
```

The Director panel uses a dark glass card style consistent with existing tool panels (CharacterBiblePanel, ShotSequencerPanel). It slides in from the right side of the canvas stage.

---

## 2. Panel Anatomy — 8 Sections

### Section 1 — Director Brief Summary Bar

A compact always-visible strip at the top of the panel. Shows:
- Project title
- Genre + projectType (or "Brief incomplete")
- Target duration
- Quick-access "Edit Brief" button

```
┌─────────────────────────────────────────────────────┐
│ 🎬  梦境追踪者                          [Edit Brief] │
│ 心理惊悚 · 短片 · 3 分钟                             │
└─────────────────────────────────────────────────────┘
```

**Empty state:**
```
┌─────────────────────────────────────────────────────┐
│ 🎬  梦境追踪者                    [完善 Director Brief] │
│ Brief 不完整 — 缺少 genre, targetDuration             │
│ [完善后启用导演分析]                                  │
└─────────────────────────────────────────────────────┘
```

### Section 2 — Role Tabs

Two tabs that switch the recommendation list between Director judgment and First AD judgment.

```
[  🎬 导演视角  |  🎬 制片视角  ]
```

- **导演视角** (Director): Story, coverage, character, visual register
- **制片视角** (First AD): Production order, generation queue, sequence efficiency

Default tab: 导演视角

### Section 3 — Critical Decisions (BLOCKING items)

Shown first, above all other cards. Red left border. Only visible when BLOCKING items exist.

```
┌─── 🔴 必须处理 (2) ───────────────────────────────┐
│                                                    │
│ ● 角色圣经为空                            [打开] →  │
│   画布中有 5 个节点引用角色，生成前需先建立圣经        │
│                                                    │
│ ● 分镜顺序有 2 个节点已删除               [打开] →  │
│   顺序条目 #4, #7 指向不存在的节点                  │
└────────────────────────────────────────────────────┘
```

### Section 4 — Next Best Action

A single highlighted card: the single most impactful action the director should take right now. Derived from the highest-priority non-BLOCKING item that has a clear action target.

```
┌─── ⚡ 下一步最佳行动 ──────────────────────────────┐
│                                                    │
│ 场景 2（雨中告别）缺少特写覆盖                       │
│                                                    │
│ 您有 2 个远景镜头，但叙事 POV（第三人称限制）        │
│ 通常需要主角面部特写来传达情感转折。                   │
│                                                    │
│ [添加特写节点]                                      │
└────────────────────────────────────────────────────┘
```

### Section 5 — Production Readiness Matrix

A compact data table. Not a progress bar — a data statement.

```
┌─── 📊 制作就绪矩阵 ────────────────────────────────┐
│                                                    │
│  角色圣经     ██████████ 4 个角色     ✓             │
│  场景圣经     ██████░░░░ 3/5 场景     ⚠             │
│  分镜顺序     ████████░░ 7 个条目     ✓             │
│                                                    │
│  生成状态                                           │
│  已完成      ████████░░  8 / 10      80%           │
│  生成中      █░░░░░░░░░  1 / 10      10%           │
│  失败        █░░░░░░░░░  1 / 10    → [处理]         │
│                                                    │
│  可用资产      8 个镜头已就绪                        │
└────────────────────────────────────────────────────┘
```

Rules for this section:
- Percentages only from exact integer counts
- "✓" only when 100% complete
- "⚠" when present but incomplete
- "✗" when absent

### Section 6 — Recommendation List

Scrollable list of remaining recommendations, sorted by priority. Grouped:

1. RISK (amber left border)
2. RECOMMENDATION (blue left border)
3. ALTERNATIVE (purple left border)
4. INFORMATION_MISSING (gray left border)

Each card:

```
┌─── ⚠ 风险 ────────────────────────────────────────┐
│                                                    │
│ 镜头预算与节奏设定不匹配                             │
│ ─────────────────────────                         │
│ 12 个镜头在 90 秒目标时长中隐含 7.5s/镜，           │
│ 但 pacing=kinetic 的基准为 2–4s/镜。               │
│                                                    │
│ [查看分镜顺序]         [暂时忽略]                   │
└────────────────────────────────────────────────────┘
```

Card height: auto (never truncate rationale). No carousel. Full text visible.

### Section 7 — Evidence Drawer (per-card expand)

Each recommendation card has an expandable "查看数据" disclosure. Clicking reveals the raw evidence:

```
▼ 查看数据

  来源字段:  directorBrief.pacing
  当前值:    "kinetic"
  
  来源字段:  shotSequence.items.length
  当前值:    12
  
  来源字段:  directorBrief.targetDuration
  当前值:    90 (秒)
  
  计算结果:  90 ÷ 12 = 7.5s/镜
  基准范围:  kinetic = 2–4s/镜 ← 超出范围
```

Evidence format: field path → current value → computation → conclusion. No inference, no probability.

### Section 8 — First AD Tab: Production Sequence

(Visible only in 制片视角 tab)

Shows production order optimization: which nodes to generate first based on dependency chains.

```
┌─── 🎬 制片推荐顺序 ────────────────────────────────┐
│                                                    │
│ 第 1 批 — 立即可生成 (无依赖)                        │
│  ① node-01  工厂门口远景     [图片]  idle           │
│  ② node-03  咖啡馆全景       [图片]  idle           │
│                                                    │
│ 第 2 批 — 等待第 1 批完成                           │
│  ③ node-05  工厂→咖啡馆过渡   [视频]  idle           │
│     └ 需要: node-01 完成后作为首帧                  │
│                                                    │
│ 阻塞项                                              │
│  ✗ node-07  [分镜顺序已移除该节点]                  │
└────────────────────────────────────────────────────┘
```

The First AD view shows dependency order, not creative priority. It reads the edge graph to determine which nodes can generate in parallel vs. which must wait.

---

## 3. Recommendation Card — Component Spec

### Visual States

| State | Left Border | Background | Badge |
|---|---|---|---|
| BLOCKING | `border-red-500` | `bg-red-950/30` | `🔴 必须处理` |
| RISK | `border-amber-500` | `bg-amber-950/20` | `⚠ 风险` |
| RECOMMENDATION | `border-blue-500` | `bg-blue-950/20` | `💡 建议` |
| ALTERNATIVE | `border-purple-500` | `bg-purple-950/20` | `🔀 替代方案` |
| INFORMATION_MISSING | `border-neutral-500` | `bg-neutral-900/40` | `ℹ 信息缺失` |
| dismissed | `opacity-40` | unchanged | `已忽略` |

### Card Anatomy

```
┌──[LEFT BORDER]─────────────────────────────────────┐
│                                                    │
│  [TYPE BADGE]                                      │
│  [HEADLINE — max 80 chars]                         │
│  ──────────────────────                            │
│  [RATIONALE — 1–3 sentences]                       │
│                                                    │
│  [ACTION BUTTON]          [▾ 查看数据] [暂时忽略]   │
│                                                    │
│  ▾ 查看数据 (collapsed by default)                  │
│    [EVIDENCE DRAWER]                               │
└────────────────────────────────────────────────────┘
```

### Typography

- Headline: `text-sm font-semibold text-white`
- Rationale: `text-xs text-neutral-300 leading-relaxed`
- Evidence: `text-xs font-mono text-neutral-400`
- Action button: `text-xs px-3 py-1.5 rounded-md` (type-colored)

---

## 4. Director Brief Panel — Input Form

The DirectorBriefPanel is a new tool panel accessible from:
1. The "Edit Brief" button in the Director panel header
2. The INFORMATION_MISSING card action button

It uses the same DirectorToolPanelFrame as other tools.

### Form Layout

```
┌─ Director Brief ──────────────────────────────────┐
│                                                    │
│  项目类型          [短片 ▾]                         │
│  目标时长          [___] 秒                         │
│  类型/题材         [___________________]            │
│  核心主题          [_________________________________]
│  主导情绪          [___________________]            │
│  叙事视角          [第三人称限制 ▾]                 │
│  视觉基调          [___________________________]    │
│  节奏              [快节奏 ▾]                       │
│                                                    │
│  ─ 选填 ──────────────────────────────────────    │
│  剧情梗概          [多行文本框]                      │
│                                                    │
│  ─────────────────────────────────────────────    │
│  [取消]                           [保存 Brief]      │
└────────────────────────────────────────────────────┘
```

All fields validate client-side only. No external lookup. Save = PUT to existing metadataJson extension endpoint.

---

## 5. Visual Language Guide

### Philosophy

The Director panel is a **professional workstation**, not a creative playground. It must read as: authoritative, minimal, data-driven.

Anti-patterns to avoid:
- No progress rings or animated completion meters
- No emoji in recommendation text (only in UI chrome)
- No motivational language ("你快完成了！")
- No color gradients or animated backgrounds
- No rounded-xl cards (use `rounded-md`)

### Color Usage

| Color | Meaning | Use only for |
|---|---|---|
| Red (`red-500`) | Blocking / broken | BLOCKING recommendations |
| Amber (`amber-500`) | Warning / risk | RISK recommendations |
| Blue (`blue-500`) | Opportunity | RECOMMENDATION |
| Purple (`purple-500`) | Alternative path | ALTERNATIVE |
| Neutral gray | Information state | INFORMATION_MISSING, evidence drawer |

Green is only used for "完成" states in the Readiness Matrix — not for recommendations.

### Dark Mode Only

The Director panel is always dark. It renders inside the dark canvas workspace. No light mode variant in V1.

Background: `bg-neutral-900/95 backdrop-blur-sm`
Border: `border-neutral-700/50`
Scrollbar: styled narrow, neutral-800 track

### Progressive Disclosure

The panel shows in this order:
1. Brief Summary (always visible)
2. BLOCKING items (if any)
3. Next Best Action (if available)
4. Production Readiness Matrix (collapsed by default, expands with ▾)
5. Recommendation list (scrollable)
6. Evidence drawer (collapsed per-card, expand on click)

A user who has no time should be able to read just the top 3 sections and know exactly what to do next. A user who wants full context can expand everything.

---

## 6. Empty States

### Empty State 1 — No Canvas Nodes

```
[Director icon, muted]
画布中还没有节点。
添加图片或视频节点后，导演分析将自动启用。
```

### Empty State 2 — Brief Missing

```
[Brief icon]
需要 Director Brief 才能启用导演分析。

Brief 帮助系统了解您的影片类型、时长和创作意图。

[完善 Director Brief]
```

### Empty State 3 — All Clear

```
[Checkmark, dim]
所有维度检查通过。

导演系统未发现任何需要处理的问题。
继续生成或完善您的镜头描述。
```

---

## 7. Director Panel vs. Other Panels — Interaction Rules

| Rule | Rationale |
|---|---|
| Director panel can coexist with Right Inspector | Inspector shows node detail; Director shows project-level judgment — different scopes |
| Director panel closes when generation dialog opens | Dialog requires full attention; Director is a reference, not a workflow gate |
| Director panel closes when Character/Scene Bible opens | User is acting on the recommendation — close Director to give workspace to the tool |
| Director panel does NOT close on node selection | Clicking a node while Director is open should highlight that node in the canvas but keep the Director panel open |
| Director "select node" actions highlight the node without closing Director | User may want to compare multiple node recommendations |

---

## 8. Implementation Sequence (Post-Approval)

When the Founder approves, implementation must proceed in this order:

1. **Phase 1**: `DirectorJudgmentEngine` pure function library (no UI)
   - `apps/web/src/lib/director/judgment-engine.ts`
   - All V1 deterministic checks
   - Full test coverage for each check function

2. **Phase 2**: `DirectorBriefPanel` — data collection UI
   - New panel using existing `DirectorToolPanelFrame`
   - Reads/writes `canvasWorkflow.metadataJson.directorBrief`
   - Uses existing `workflowMetadata` PUT extension

3. **Phase 3**: `DirectorDashboard` — main recommendation UI
   - Brief Summary bar
   - Tab structure (Director / First AD)
   - BLOCKING items section
   - Next Best Action card
   - Recommendation list with evidence drawers
   - Readiness Matrix

4. **Phase 4**: Integration into VCW + tool dock
   - New 🎬 button in left rail (existing CanvasToolDock extension point)
   - VCW passes `directorData` prop to DirectorDashboard
   - Action routing via existing panel/node callbacks

5. **Phase 5**: First AD tab
   - Dependency graph traversal from canvas edges
   - Production sequence recommendation

Each phase must pass type-check + lint before the next phase starts. No AI inference (V2 hooks) in any phase.

---

## Document Status

- **Version**: 1.0.0-draft
- **Author**: Claude Sonnet 4.6 (DESIGN_ONLY — no code)
- **Approval required from**: Founder
- **Blocks**: AI_DIRECTOR_DASHBOARD_V1 implementation
