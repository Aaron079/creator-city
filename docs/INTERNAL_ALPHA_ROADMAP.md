# Creator City — Internal Alpha Roadmap

**Status:** READY_FOR_FIRST_USERS_WITH_CAVEATS  
**Date:** 2026-06-16  
**Decision:** P2-CANVAS-1..4 implemented. Exit criteria code-verified. P2-FIRST-USERS-QA CLOSED with minor browser caveats.

**Before first external user invite — founder must complete:**
1. Login to production; confirm /api/credits/balance returns 200 (not 401)
2. Navigate to /admin; confirm pages load
3. Submit 1 test inquiry as a member; confirm no unintended side-effects
4. Mark P2-FIRST-USERS-SPOTCHECK DONE in docs/NEXT_TASKS.md

**State:** READY_FOR_INTERNAL_ALPHA → READY_FOR_FIRST_USERS (code-QA PASS) → READY_FOR_FIRST_USERS_WITH_CAVEATS (pending founder spot-check before external invite)

---

## Decision Record

| Item | Status |
|---|---|
| 商业/运营骨架（会员、BYOK、Marketplace Inquiry、Admin） | ✅ COMPLETE |
| 外部首批用户试用 | ⏸ POSTPONED |
| 原因 | 核心画布能力不够完善，护城河工具未形成 |
| 下一优先级 | P2-CANVAS 核心画布护城河工具 |

---

## Track A — Core Canvas Capability (Current State)

### Node Types (defined in codebase)
`text | image | video | audio | asset | template | delivery | world | upload`

### Actually usable for generation
| Node | Provider | Status |
|---|---|---|
| text | DeepSeek / Kimi / OpenAI (BYOK) | ✅ Live |
| image | Seedream Image 火山方舟 (BYOK) | ✅ Live |
| video | Seedance Video 火山方舟 | 🟡 Platform path; BYOK 接入中 |
| audio | — | ❌ No live provider |

### Canvas Core Features
| Feature | Status |
|---|---|
| 节点拖拽 / 连线 / CRUD | ✅ Working |
| 参考图：image → video upstream | ✅ Working (resolveImageInputForVideoNode) |
| 本地草稿（localStorage） | ✅ Working |
| 手动云端保存 | ✅ Working |
| 资产库自动记录 | ✅ Working |
| 多节点并行生成 | ✅ Working |
| 生成结果回写节点 | ✅ Working |
| Timeline / Sequence 概念 | 🟡 ShotListBuilderPanel exists; no sequence player |
| 项目级 Workflow | 🟡 Storyboard state exists; director panel wired |

---

## Track B — Director Tools (Current State)

### Tools in CanvasToolDock (accessible from main canvas)
| Tool | Group | Status | Notes |
|---|---|---|---|
| 镜头词典 (CameraLexiconPanel) | Director | ✅ UI accessible | Reference only, no generation |
| 分镜清单 (ShotListBuilderPanel) | Director | ✅ UI accessible | Creates blank nodes; no auto-generate |
| 连贯性检查 (ContinuityCheckerPanel) | Director | ✅ UI accessible | Analysis only |
| 导演面板 (StoryboardDirectorPanel) | Director | ✅ UI accessible | Shot org; no generation |
| 资产变体 (AssetVariantPlannerPanel) | Asset | ✅ UI accessible | Planning only |
| A/B 对比 (ABComparePanel) | Asset | ✅ UI accessible | View only |
| 关键帧提取 (KeyframeExtractorPanel) | Asset | ✅ UI accessible | Prompt extraction |
| 提示词增强 (PromptBoosterPanel) | Prompt | ✅ UI accessible | Client-side text tool |
| 批量改写 (BatchPromptRewriterPanel) | Prompt | ✅ UI accessible | Text editing |
| 视觉包装 (LookPackagePanel) | Prompt | ✅ UI accessible | Prompt style presets |
| 色彩调色 (ColorGradePalettePanel) | Prompt | ✅ UI accessible | Prompt color tokens |
| 角色锁定 (CharacterLockPanel) | Character | ✅ UI accessible | Edge-level flag; no generation effect |

### Critical Gap: Bible → Generation Injection SEVERED

| Bible | Component exists | In main canvas UI | Injected into generation |
|---|---|---|---|
| CharacterBible | ✅ CharacterBiblePanel | ❌ Not rendered | ❌ Disabled (P0 simplification) |
| SceneBible | ✅ SceneBiblePanel | ❌ Not rendered | ❌ Disabled (P0 simplification) |
| StyleBible | ✅ State managed | 🟡 settings only | ❌ Disabled (P0 simplification) |

**This is the #1 moat gap.** The entire "AI Director" value proposition depends on bibles influencing generation. Currently: user writes character description → it does nothing.

### Film Language Support
| Element | Status |
|---|---|
| 镜头尺寸 (wide/medium/close/extreme-close) | ✅ ShotListBuilder has preset options |
| 摄影机运动 (push/pull/pan/track/crane) | 🟡 CameraLexicon has vocab; not in generation |
| 景深/光圈/焦段 | 🟡 CinematicControlsPanel (component exists) |
| 灯光 | 🟡 LookPackage includes lighting presets |
| 色彩/调色 | ✅ ColorGradePalettePanel |
| 转场/剪辑节奏 | ❌ No timeline/sequence player |
| 分镜 shot list | ✅ ShotListBuilder |

---

## Track C — Creator Asset System (Current State)

| Feature | Status |
|---|---|
| 角色库 (CharacterBible) | ✅ Component + localStorage; not in canvas UI |
| 场景库 (SceneBible) | ✅ Component + localStorage; not in canvas UI |
| 风格库 (StyleBible) | ✅ localStorage; not injected |
| 镜头库 | 🟡 CameraLexicon vocab reference |
| Prompt 模板 | ✅ CanvasTemplatePanel + PublicTemplate |
| 参考图管理 | ✅ CharacterReferenceGridPanel |
| 生成历史 | ✅ CanvasHistoryPanel |
| 资产库 / 项目资产 | ✅ /assets + ProjectAssetsPanel |
| Marketplace 展示 | ✅ live |
| 项目资产 ↔ Marketplace | 🟡 Partial (asset → listing, no auto-sync) |

---

## Track D — Moat Tool Candidates (Ranked)

| # | Tool | Value | Difficulty | Moat Strength | P2 Priority |
|---|---|---|---|---|---|
| 1 | **Bible→Prompt Injection Reconnect** | 极高 | 低（client-side） | ★★★★★ | **P0 — 立即做** |
| 2 | **CharacterBible in main canvas UI** | 极高 | 低（component exists） | ★★★★★ | **P0 — 立即做** |
| 3 | **ShotList→Auto-Generate Sequence** | 极高 | 中 | ★★★★★ | **P1** |
| 4 | **SceneBible in main canvas UI** | 高 | 低（component exists） | ★★★★ | P1 |
| 5 | Image→Video UX Polish | 高 | 低 | ★★★ | P1 |
| 6 | Character Reference Image lock | 高 | 中 | ★★★★ | P1 |
| 7 | Project Template System | 中 | 中 | ★★★ | P2 |
| 8 | Trailer Builder / Sequence Player | 极高 | 高 | ★★★★★ | P3 |
| 9 | Production Bible Export (PDF/share) | 高 | 中 | ★★★★ | P3 |
| 10 | Marketplace-ready Asset Packaging | 中 | 中 | ★★★ | P3 |
| 11 | Music/SFX Cue Sheet | 低 | 高 | ★★ | Later |
| 12 | Creator Portfolio / Passport | 低 | 高 | ★★ | Later |

---

## Track E — Internal Alpha Definition

### Who can use INTERNAL_ALPHA
- Project team / founder only
- No external users

### What is allowed in INTERNAL_ALPHA
- Full canvas including director tools
- CharacterBible / SceneBible / StyleBible (once reconnected)
- ShotList → generate sequence
- All BYOK providers
- Admin panel operations

### What is NOT allowed in INTERNAL_ALPHA
- External user invites
- Membership sales to external users
- Marketplace as real transaction venue

### Exit criteria to READY_FOR_FIRST_USERS (INTERNAL_ALPHA → FIRST_USERS)
All of the following must pass:

1. **[P2-CANVAS-1]** CharacterBible description appears in actual sent generation prompt (verifiable in network tab)
2. **[P2-CANVAS-2]** CharacterBiblePanel + SceneBiblePanel accessible from main canvas (not hidden)
3. **[P2-CANVAS-3]** ShotList → "生成全部镜头" creates and auto-queues generation for all shots
4. **[P2-CANVAS-4]** Image node "生成衍生视频" shortcut works (upstream image → video node)
5. **[P2-CANVAS-5]** End-to-end test: script → 3-character bible entries → 5-shot shotlist → 5 images generated with character descriptions in prompts → ≥1 image-to-video → project saves and reloads correctly
6. Generation stability: ≥3 consecutive shots generate without node errors
7. No regression on membership/BYOK/Marketplace gates

---

## Recommended P2 Roadmap

```
P2-CANVAS-1 ──► P2-CANVAS-2 ──► P2-CANVAS-3 ──► P2-CANVAS-4 ──► P2-CANVAS-5
Bible→Prompt    Bible UI in      ShotList auto-   Img2Vid UX      Internal Alpha QA
reconnect       canvas           generate         polish          → FIRST_USERS exit
(P0, 1 day)     (P0, 0.5 day)   (P1, 2 days)    (P1, 1 day)     (P0, QA only)
```

**Total estimated:** 4.5 dev-days to reach FIRST_USERS exit criteria

**P3 (after FIRST_USERS):**
- Trailer Builder / Sequence Player
- Production Bible Export
- Marketplace-ready Asset Packaging
- Character Passport

**Later:**
- Auto-billing / renewal
- Web3 / on-chain
