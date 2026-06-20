# Creator City — Current Status

Last updated: 2026-06-21 (P1-CANVAS-TOOL-PANEL-MIGRATION-PHASE-3 VALIDATED / CLOSED — browser QA PASS 2026-06-21; 22 PASS / 0 WARN / 0 FAIL / 0 SKIP / 0 BLOCK; §1 Deployment: 创建分镜节点 primary + 生成所选镜头 secondary confirmed, old label gone; §2 Footer: [复制分镜清单 | 取消 | 创建分镜节点 (5) | 生成所选镜头 (5)] correct; §3 Create: 5 nodes created, 0 /generate/* calls; §4 Confirmation: banner appeared with cost warning, cancel fired 0 Provider calls; §5 Layout: 1 dialog · 1 backdrop · footer at 863px · Escape closes; §6 Network boundary: 0 /generate/* calls entire session; commit 824988f; QA script: qa_shotlist_closeout.py)

Last updated: 2026-06-21 (P1-CANVAS-TOOL-PANEL-MIGRATION-PHASE-2 VALIDATED / CLOSED — browser QA PASS 2026-06-21; 53 PASS / 1 WARN / 0 FAIL / 0 BLOCK; 1 WARN: deployment_active (GET /api/health → 404, non-blocking — endpoint does not exist); Camera Lexicon: Frame structure (header+source+summary+body+footer) PASS; title "🎬 镜头词典" / "CAMERA LEXICON" PASS; source node card immutable PASS; term grid renders+selectable PASS; footer 取消/创建镜头版本 always visible PASS; Escape close PASS; backdrop close PASS; Prompt Booster: Frame structure PASS; "✨ 提示词增强" / "PROMPT BOOSTER" PASS; suggestion cards numbered PASS; "选择此建议" toggle PASS; footer 取消/创建增强版本 PASS; Visual Style: Frame structure PASS; "🎨 视觉风格" / "VISUAL STYLE" PASS; look grid renders PASS; selection state PASS; Modal mutual exclusion (open Lexicon→open Booster→Lexicon auto-closes) PASS; Network boundary: zero /api/generate/* calls during panel interactions PASS; QA script: qa_panel_migration_phase2.py)

Last updated: 2026-06-20 (P0-LEGACY-CREATE-V2-ROUTE-REMOVAL VALIDATED / CLOSED — commit efab9b2; browser QA PASS: /create-v2 returns 307 server redirect → /create; projectId preserved through chain; no redirect loop; no CanvasV2 bundle loaded; no legacy adapter requested; all public nav (TopNav "AI 画布", homepage CTA "进入 AI 画布创作") points to /create; VisualCanvasWorkspace unmodified; qa_route_removal.py 19 PASS / 0 FAIL / 6 SKIP-auth; production: <https://creator-city-vert.vercel.app/create>)

Last updated: 2026-06-20 (P1-CANVAS-TOOL-PANEL-MIGRATION-PHASE-2 IMPLEMENTED / WAITING_BROWSER_QA — Camera Lexicon + Prompt Booster + Visual Style migrated to DirectorToolPanelFrame; all 5 Director tools now share unified Header/Source/Summary/Body/Footer; indigo accent added to Frame for Visual Style; buildCameraLexiconSummaryText pure function added to camera-lexicon.ts; CameraLexiconPanel: violet accent, self-contained z-[1199] backdrop, "🎬 镜头词典", "创建镜头版本" footer, secondary insert action clearly marked in Body; PromptBoosterPanel: selectedSuggestionId selection model, "选择此建议" per-card toggle, "创建增强版本" in Footer enabled after selection, "追加到 Prompt" in non-derived mode only; LookPackagePanel: indigo accent, "🎨 视觉风格", inline source preview removed (Frame provides), "创建视觉风格版本" footer in derived mode; VCW: directorTargetNodeIdRef set before opening booster/look-package; external VCW backdrops removed (panels self-contain); business logic unchanged; all prompt builders/derived node creation/Modal Manager/mutual exclusion preserved; type-check PASS · lint PASS · build PASS · pushed)

Last updated: 2026-06-20 (P1-CANVAS-TOOL-PANEL-MIGRATION-PHASE-1 IMPLEMENTED / WAITING_BROWSER_QA — commit 0946eba; DirectorToolPanelFrame.tsx created: fixed header (icon/title/titleEn/close-×) + optional source preview section (thumbnail+title+kind+"原节点保持不变") + live summary bar (count badge + "ARRI Alexa 35 · 85mm · f/2.8 · Eye Focus") + scrollable body + fixed footer (清除设定 / 取消 / primary action); CinematicCameraControlPanel migrated to Frame — violet accent, "🎥 摄影机控制", "创建摄影版本" footer; SceneLightingControlPanel migrated to Frame — amber accent, "💡 场景光线控制", "创建光线版本" footer; both panels identical width/padding/structure; VCW passes sourceNode from directorTargetNodeIdRef.current at open time; buildCameraSummaryText+buildLightingSummaryText moved to lib files (shared between panel and VCW); business logic unchanged — prompt builders/derived node creation/Modal Manager/camera-lighting mutual exclusion all intact; no schema/route/executor/provider/payment changes; type-check PASS · lint PASS · build PASS · pushed)

Last updated: 2026-06-20 (P0-LAYOUT-7-SHELL-INTEGRATION-CLOSEOUT DONE — commit 435cdc3; audit complete: --canvas-z-rail lowered 1200→1100 so modal backdrops z-[1199] properly block left rail clicks during Camera/Bible/ShotList/etc panel open; rail still above toolbar z=1000 and nodes z=100; all event listeners verified with paired cleanup; isRightInspectorOpen+isBottomDockExpanded in nodeDialogStyle/toolbarFixedStyle deps verified; no dead CSS/imports in shell; responsive breakpoints verified; type-check PASS · pushed to Vercel)

Last updated: 2026-06-20 (P0-GENERATION-DIALOG-PROMPT-SPACE IMPLEMENTED / WAITING_BROWSER_QA — commit c4311fd; prompt textarea min-height 200px desktop / 140px tablet / 110px mobile (3× increase over previous 60px); NODE_DIALOG_HEIGHT 210→500 for accurate above/below positioning; billing section padding compressed (px-3 pb-2 pt-2, cards p-1.5) freeing ~60px; video-mode-bar padding reduced saving ~12px; AbortController on automatic recovery fetch suppresses ERR_CONNECTION_CLOSED on navigation-cancel; recover-canvas-nodes N+1 replaced with single batch findMany; type-check PASS · lint PASS · build PASS · pushed) ‖ P1-RECOVER-CANVAS-NODES-CONNECTION-CLOSED — root cause: navigation abort (page unload while request in-flight); classified as TRANSIENT / GUARDED; AbortController fix pushed in c4311fd; no infinite retry; Canvas nodes not cleared on error; console error suppressed for AbortError; N+1 DB query also fixed in same commit) ‖ P0-LAYOUT-6-MODAL-MANAGER-STATE-CLOSEOUT DONE — commit b867f1d; three consistency gaps closed: (1) Escape stale closure fixed — activeCanvasModal + closeCanvasPanel added to keydown effect deps; event.isComposing guard + stopPropagation added; short-circuit now uses fresh closure; (2) Generation entry unification — resetCanvasModalStates shared helper + openGenerationDialog adapter; all 6 user-visible entry points (focusPromptForNode/handleForkNode/handleNodeCreateMenuSelect/Inspector/Dock/onCreateDerivedVideo) now route through openCanvasPanel('generation',{nodeId}) which closes other panels and sets activeCanvasModal='generation'; (3) Project lifecycle — resetCanvasModalStates() called alongside setSaveStatus('opening') so panel states cleared on project switch; type-check PASS · lint PASS (warnings only, pre-existing) · build PASS · pushed; WAITING_BROWSER_SPOT_CHECK) ‖ P0-LAYOUT-6-MODAL-MANAGER IMPLEMENTED / WAITING_QA — commit 3fdbc4a; canvasModalTypes.ts with CanvasModalId union (16 panel IDs); activeCanvasModal state; openCanvasPanel(id, payload?) bulk-resets all 15 panel booleans + editingNodeId before setting new one; closeCanvasPanel() resets all panels + editingNodeId + activeCanvasModal; Escape handler short-circuits: if activeCanvasModal set, closes only that panel + return; all 16 panels' onClose/backdrop/chip buttons/onCreateDerived migrated to openCanvasPanel/closeCanvasPanel; old closeCanvasPanel (setActivePanel) renamed to closeSidePanel; project-change lifecycle: closeCanvasPanel() added alongside storyboard cleanup; type-check PASS · lint PASS · build PASS · pushed; WAITING_BROWSER_QA) ‖ P0-LAYOUT-5-BOTTOM-DOCK VALIDATED/CLOSED — processing status normalized: processing:0 added to STATUS_ORDER (same priority as running/generating); processing included in runningCount badge filter; core QA PASS: flex layout, expand/collapse, inspector sync, coordinate deps, no media/save/provider side effects; commit pending) ‖ P0-DERIVED-BADGE-SOURCE-SUMMARY IMPLEMENTED / WAITING_BROWSER_QA — source identity added to derived node card; structured tool summaries (camera params / lighting / lexicon labels / booster title / lookName) stored in metadataJson.toolSummaryText at creation time; sourceNodeTitle stored in metadataJson at creation time; nodeTitleById Map in Workspace for live source resolution + deletion detection; CanvasNodeCard badge now shows tool icon + label + draft state + summary line + source line; 3-layer visual hierarchy; buildCameraSummaryText + buildLightingSummaryText pure functions; CameraLexiconPanel.onCreateDerived now passes selectedLabels[]; PromptBoosterPanel.onCreateDerived now passes suggestionTitle; all 5 tools covered; backward compat — old nodes show badge without summary; type-check PASS · lint PASS · build PASS · pushed; WAITING_BROWSER_QA) ‖ P0-DERIVED-TOOLS-VISUAL-POLISH IMPLEMENTED / WAITING_BROWSER_QA — derivedToolVisualConfig.ts with 5 per-tool icon+accent classes; CanvasNodeCard badge: icon+toolLabel+draft state, stronger colors; CanvasFlowEdge: toolIcon prop, pointer-events:none on label group, violet accent; nodeTitleById Map for live source lookup + deletion detection; commit 14e8363+current)

Last updated: 2026-06-20 (P0-DERIVED-EDGE-LABEL-CLOUD-PERSISTENCE IMPLEMENTED — commit 6db7f06; edge labels now written to metadataJson.derivedToolChannel on creation; mapCanvasEdge restores label on cloud load; LookPackage visual-style edge now has label + badge + generationDraft; UI fallback for old lost labels via toNode.generationDraft; 5 tools covered; type-check PASS · lint PASS · build PASS · pushed; WAITING_BROWSER_QA) ‖ P0-DERIVED-NODE-TASK-DRAFT PARTIAL — commit 8fc1007; Camera/Lighting prompts fixed (append context fragments); generationDraft task model in metadataJson; Video→Video shows "来源视频" banner; node badges render; edge label cloud persistence now fixed in 6db7f06; WAITING_QA ‖ P0-DERIVED-TOOLS-NODE-PIPELINE-MIGRATION PARTIAL — commits 9177bc4+8fc1007+6db7f06; all 4 tools create derived nodes with prompt/badge/edge; cloud persistence fixed; WAITING_QA)

Last updated: 2026-06-19 (P0-DERIVED-VISUAL-STYLE-SOURCE-TARGET-FIX DONE — onOpenLookPackage callback now sets lookPanelDefaultNodeId(activeNode.id) before opening panel; selected node always used as source regardless of array order; type-check PASS · build PASS; WAITING_BROWSER_QA) ‖ P0-CANVAS-RAIL-VISUAL-INTEGRATION-AND-DERIVED-TOOL-WORKFLOW DONE — (1) leftRail transparent: background:transparent, border:none, width:80px; CanvasToolDock items-center centers 56px capsule in slot; canvas background shows through rail; floating dock visual restored; (2) SHOW_GENERATION_CONTEXT_CHIPS=false: Bible/Camera/Lighting chips hidden from generation dialog; underlying engines/storage/prompt-injection untouched; (3) Derived tool foundation: LookPackagePanel gains onCreateDerivedNode prop + resultImageUrl + source media preview + 创建风格版本 primary button; VisualCanvasWorkspace wires onCreateDerivedNode → createNode(image, parentNodeId) + setEditingNodeId → opens derived node dialog; source node untouched; edge auto-created; type-check PASS · build PASS) ‖ P0-LAYOUT-3-LEFT-TOOL-RAIL-SCOPE-FIX DONE — canvasStyles.scope wrapper added around CanvasToolDock in leftToolRail const; h-full propagates definite height; all canvas-toolbar-shell/canvas-add-menu/canvas-user-menu/canvas-toolbar-button CSS rules now apply; same pattern as CanvasTopCommandBar; type-check PASS · lint PASS · build PASS; pending commit + push → WAITING_BROWSER_QA) ‖ P0-LAYOUT-3-LEFT-TOOL-RAIL IMPLEMENTED / WAITING_BROWSER_QA — CanvasToolDock moved from canvas stage overlay into Shell leftRail slot; leftRail is 88px wide with real layout flow; stage fills remaining width; canvas-add-menu positioned relative to inner toolbar wrapper; submenus extend rightward via overflow:visible; all viewportRef.getBoundingClientRect() calls auto-correct; type-check PASS · lint PASS · build PASS) ‖ P0-LAYOUT-2-TOP-COMMAND-BAR VALIDATED/CLOSED — topbar migration + z-index fix code-QA PASS (10/10 phases); topbar in-flow in shell topCommand slot; topCommand z-index: auto — no stacking context; all fixed panels (node-dialog z=80, create-menu z=92, generation-tasks z=95, provider-portal z=120, preview-backdrop z=2600) correctly above topbar; canvas-root height 100vh→100%; commits ec55f5a + 8ee6eec; P0-LAYOUT-3-LEFT-TOOL-RAIL unblocked → NEXT) ‖ P0-NODE-TOOLBAR-NAVIGATION-CLEANUP IMPLEMENTED — top-level toolbar reduced to 3 buttons: 下载/资产/工具; all operations moved into grouped submenus; solid opaque menu surfaces (#111319, z-2000); CanvasToolDock left-rail dropdowns fixed (bg-[#111319] fully opaque, shadow-2xl); ntb-menu CSS system added to canvas.module.css; mutual-exclusion + outside-click + Escape + nodeId-change close; type-check PASS · lint PASS · build PASS; commit pending) ‖ P0-NODE-CAMERA-LIGHTING-PER-NODE IMPLEMENTED — nodeDirectorContextStorage.ts per-node keys creator-city:camera-settings:<projectId>:<nodeId>; lazy migration from legacy project key; directorTargetNodeIdRef tracks panel target; activeNode+editingNodeId effects load settings on switch; updateCamera/Lighting writes per-node; handleRegenerateNodeFromPrompt+handleNodeDialogGenerate read per-node directly; toolbar now shows for all text/image/video nodes regardless of result; hasMediaResult prop disables result-only buttons on empty nodes; type-check PASS · lint PASS · build PASS; commit efa78bc) ‖ P0-NODE-TOOLBAR-PLACEMENT-CORRECTION DONE 2026-06-17 (P0-NODE-TOOLBAR-PLACEMENT-CORRECTION DONE — all single-node tools migrated from left rail to AssetAgentToolbar: 🎥导演 dropdown, 💡光线, ✨提示词; lexicon opens with workflowContext=activeNode; toolbarFixedStyle extended to text nodes; CanvasToolDock left rail is now project-level/multi-node only; type-check PASS · build PASS; commit 994e0a0) ‖ P0-NODE-ASSET-TOOLS-VIDEO-RELIABILITY DONE — video OSS cascade storm fixed (immediate fail, no N-URL cycling); variant planner/A/B compare/keyframe extractor moved to AssetAgentToolbar; commit ecd2175) ‖ 2026-06-16 (P0-GENERATION-POLLING-CAP IMPLEMENTED — video polling loop capped at MAX_VIDEO_GENERATION_POLLS=36 (180s); generation_polling_timeout errorCode on cap-exceeded; regenerate path also fixed to use generation_polling_timeout; type-check PASS · lint PASS · build PASS; commit pending push) ‖ P0-GENERATION-RELIABILITY-LAYER IMPLEMENTED — unified GenerationPhase/GenerationFailureKind types in lib/canvas/generationReliabilityLayer.ts; generation_stopped_on_reload/generation_cancelled_by_user/generation_polling_timeout/VIDEO_GENERATION_NOT_READY all have specific messages; cancelled nodes show "已停止生成" not "素材未找回"; commit 1b01b70) ‖ P0-CANVAS-CORE-FREEZE-AUDIT COMPLETE — Canvas Core Freeze boundary defined: VisualCanvasWorkspace frozen, 9 frozen core functions, 11 tool invasion points identified, plugin boundary proposed; docs/CANVAS_CORE_FREEZE.md created; main line switches to P0-CANVAS-STABILITY; P2-TOOL-UX-CONTINUE PAUSED; next task: P0-GENERATION-RELIABILITY-LAYER) ‖ P0-CANVAS-GENERATION-RELIABILITY-SHIELD DONE — video generate disabled client + server (VIDEO_GENERATION_NOT_READY fast return); click-to-load video preview eliminates OSS storm; "视频生成内测中" label; estimatedCredits hidden for all video; commit a009517 ‖ P0-MEDIA-PROXY-TIMEOUT IMPLEMENTED — mp4 proxy now returns 307 redirect to OSS URL instead of proxying body; eliminates ERR_TIMED_OUT caused by body-streaming stall on cross-region connections; video preview failure panel now shows "视频预览暂不可用 · 预览加载超时，生成结果已保存" + "在新标签页打开视频" direct link; auth check still enforced before redirect; type-check PASS · lint PASS · build PASS) ‖ P2-TOOL-UX-4A-FIX DONE — Camera Model Database + Visual Camera Cards: cameraModelDatabase.ts with 29 mainstream models (ARRI/RED/Sony/Canon/Blackmagic/Panasonic/DJI/Apple/GoPro/Insta360/Broadcast); 9 distinct SVG camera body silhouettes (cinema-box/cinema-compact/mirrorless/phone/action-cam/drone/broadcast/camcorder/three-sixty); CinematicCameraControlPanel upgraded to use database as wheel options; cameraPromptContext uses getCameraPromptDescription for model-specific descriptions; generation dialog chip row now always visible for image/video nodes with dynamic label "摄影机：[Model Name]"; backward-compatible with old localStorage values; type-check PASS · lint PASS · build PASS)
Last valid commit: P1-4A follow-up IMPLEMENTED — Hide Credits Recharge CTA for First Launch（新增 PLATFORM_CREDITS_RECHARGE_ENABLED env var，默认 false；/account/credits 支付宝充值套餐卡片 + 申请人工充值表单 + 充值按钮 当 flag 为 false 时完全隐藏，替换为"积分充值暂未开放"提示 + BYOK 引导 + 联系管理员开通会员说明；余额展示 + 历史账本保留不变；/admin/credits 不受影响；不改 schema，不改 payment API，不改 wallet/ledger）
Production validated: 2026-06-08 (Color Suite 最终收口 CLOSED / validated · Color Grade draft node workflow validated · Color Grade preview copy clarification validated · Color Suite / 调色入口 browser validated · Tool 12 Color Grade Palette / 调色盘 browser validated · Look Package Applier 归入节点顶部调色入口 browser validated · Canvas V2 Beta entry removed · Workflow Connection Context Tools + Stronger Edges browser validated · Reference Image Picker for video nodes browser validated · Canvas Tool Dock Grouping validated · Workflow Context Target Binding Fix validated · Make Workflow Continue Button Visible validated · Workflow Continue Options in Source Menu validated · User Usage History browser validated · Provider Account Center auth blank screen fix validated · Seedance Video BYOK security review completed · Provider API Key Guide browser validated · Provider Account Usage Summary browser validated · Provider Account Detail / Health Status browser validated · Subpage Navigation Polish browser validated · Provider Account Center UX Polish Batch validated · Account / Billing / BYOK Messaging validated · Provider Account Health Guidance validated · Seedance Video BYOK Safe Logging / Feature Flag Skeleton validated · Platform Service Fee Strategy Audit read-only completed · Pricing / Service Credits Static Preview validated · AI Help Billing Knowledge Sync validated · Service Credits Data Model Audit read-only completed · Admin Simulated Service Credits View validated · Admin BYOK Business Metrics Dashboard validated · BYOK Observation Summary / Admin Copy Report validated · BYOK Observation Playbook validated · Canvas Cinematic Controls shipped · Canvas Smart Tools — Generate Readiness Check validated · Camera Lexicon browser validated · Canvas Smart Tools Toolbar Cleanup + Camera Lexicon Navigation Placement browser validated · Canvas Smart Tools Tool 3A — Asset Variant Planner browser validated · /api/media/proxy 502 audit completed · Media Preview Fallback browser validated · Canvas Smart Tools Tool 4 — Character Lock Basic browser validated · Canvas Smart Tools Tool 5 — A/B Compare Panel validated · Canvas Smart Tools Tool 6 — Keyframe Extractor validated · Canvas Smart Tools Tool 7 — Shot List Builder validated · Canvas Smart Tools Tool 8 — Continuity Checker validated · Canvas Smart Tools Tool 9 — Prompt Booster validated · Canvas Smart Tools Tool 10 — Sequence Board removed from UI after product review · Canvas Smart Tools Tool 10 — Batch Prompt Rewriter validated · Canvas Smart Tools Tool 11 — Look Package Applier validated)

---

## Completed & Validated Tasks

| Task | Status | Commit |
|---|---|---|
| P2-TOOL-UX-1 ShotListBuilder visual controls + toolkit components | ✅ DONE | `f9473d6` |
| P2-TOOL-UX-AUDIT Tool UX design audit + TOOL_UX_GUIDELINES.md | ✅ AUDIT_COMPLETE | `f9473d6` |
| P2-FIRST-USERS-QA First users smoke QA | ✅ CLOSED_WITH_MINOR_BROWSER_CAVEATS | QA-only |
| P2-CANVAS-5 Internal Alpha end-to-end QA | ✅ CODE-QA PASS → READY_FOR_FIRST_USERS | `940b676` |
| P2-CANVAS-4 Image-to-Video UX shortcut | ✅ DONE | `61efd14` |
| P2-CANVAS-3 ShotList auto-generate sequence | ✅ DONE | `cac2c01` |
| P2-CANVAS-2 CharacterBible + SceneBible in canvas | ✅ DONE | `03a3103` |
| P2-CANVAS-1 Bible→Prompt reconnection | ✅ DONE | `b693a6f` |
| P2-CORE-CANVAS-MOAT Canvas/Tools Audit | ✅ AUDIT_COMPLETE | (docs only) |
| P2-FIRST-USERS First Users Trial Materials | ✅ IMPLEMENTED (external trial POSTPONED → unblocked after spot-check) | `14a03ff` |
| P2-LAUNCH-READINESS Navigation + Copy Polish | ✅ IMPLEMENTED | `bf9d210` |
| P2-ADMIN Admin Operations Hardening | ✅ IMPLEMENTED | `633954f` |
| P1-4E Unified Launch QA | ✅ VALIDATED / CLOSED | QA-only |
| P1-4B-4-QA Membership Gating QA | ✅ VALIDATED / CLOSED | QA-only |
| P1-4D-5 Marketplace Inquiry QA | ✅ CLOSED | QA-only |
| P0-PROD-CANVAS-SAVE-DISABLE-AUTOSAVE-CLOUD | ⏳ WAITING_PRODUCTION_VALIDATION | `fe72f63` |
| P0-PROD-CANVAS-SAVE-ARCHITECTURE-FIX (pool_timeout=6, 20s deadline) | ⏳ WAITING_PRODUCTION_VALIDATION | `9b53962` |
| P0 DB pool timeout / session / canvas save 503 | ✅ CLOSED | `3ec63b5` |
| Provider quota fallback + DeepSeek 友好提示 | ✅ CLOSED | `556f406` |
| 中国版默认 Provider 策略（DeepSeek 优先） | ✅ CLOSED | `d0ccb1c` |
| 资产库兜底找回最小版 | ✅ CLOSED | `a990b5b` |
| 中国版入口分流检查 + P1 Delivery hardcode 修复 | ✅ CLOSED | `ad5ae06` |
| User Provider Accounts Phase 2A/2B（schema + crypto） | ✅ CLOSED / foundation added | `778bb2d` |
| User Provider Accounts Phase 2C（CRUD API） | ✅ CLOSED / CRUD API added | `fa088d2` |
| User Provider Accounts Phase 2D（/account/providers 管理页） | ✅ CLOSED / UI shipped | `85c9622` |
| Account monetization navigation（充值降级 + 订阅与套餐入口） | ✅ CLOSED / validated | `5561a80` |
| Decentralized navigation（主导航加"我的 API"，去充值化叙事） | ✅ CLOSED / validated | `733d29f` |
| User Provider Accounts 生产前置（migration + secret 已验证） | ✅ CLOSED / production validated | — |
| User Provider Accounts Phase 3（测试连接） | ✅ CLOSED / test connection shipped | `6890501` |
| P0 Auth/Session 持久化修复（transient DB error 不再登出） | ✅ CLOSED / validated | `dfcd10c` |
| User Provider Accounts Phase 4（Text BYOK 试点） | ✅ CLOSED / Text BYOK validated | `ea2ccc6` |
| Provider UX 修复（API Key 文案误解 + 跳转登录 bug） | ✅ CLOSED / validated | `8d96d09` |
| 画布帮助面板（Provider API Key 接入手册） | ✅ CLOSED / shipped | `def152b` |
| AI Agent 接入 Provider API Key 指南 | ✅ CLOSED / shipped | `d8ddd43` |
| Image/Video BYOK 多字段凭证方案审计（只读） | ✅ CLOSED / read-only audit completed | — |
| User Provider Accounts V1（多字段凭证结构扩展） | ✅ CLOSED / production validated | `14a763d` |
| User Provider Accounts V2 — Seedream Image BYOK | ✅ CLOSED / validated | `c6ff87f` |
| BYOK UsageLog Phase S1（平台用量记录，不扣费） | ✅ CLOSED / production validated | `d693f71` |
| Admin Usage Dashboard（/admin/usage，生成用量观察） | ✅ CLOSED / validated | `fbf7734` |
| Provider Account Center 产品化升级（模型账户中心） | ✅ CLOSED / validated | `e96f916` |
| Provider Account Center auth blank screen fix | ✅ CLOSED / validated | `4710e79` |
| User Usage History（/account/usage，用户端用量历史） | ✅ CLOSED / validated | `8119eb0` |
| Seedance Video BYOK 安全评审（cn-executor credential plan，只读） | ✅ CLOSED / read-only audit completed | — |
| Provider API Key Guide（/help/api-keys，接入教程页） | ✅ CLOSED / validated | `35185b4` |
| Provider Account Usage Summary（账户卡片近 90 天用量汇总） | ✅ CLOSED / validated | `5c4b6e6` |
| Provider Account Detail / Health Status（账户详情页 + 用量 + 健康状态） | ✅ CLOSED / validated | `60aaa95` |
| Subpage Navigation Polish（子页面返回入口审计 + 无效 Workspace 按钮清理） | ✅ CLOSED / validated | `5cb46a8` |
| Provider Account Center UX Polish Batch（文案 + 入口 + 空状态 + 错误提示全面 polish） | ✅ CLOSED / validated | `0f4eee8` |
| Account / Billing / BYOK Messaging（账号/积分/BYOK 费用模式说明统一） | ✅ CLOSED / validated | `4347465` |
| Provider Account Health Guidance（账户健康建议/错误修复引导） | ✅ CLOSED / validated | `4bac934` |
| Seedance Video BYOK 安全日志脱敏 / Feature Flag Skeleton | ✅ CLOSED / validated | `3c2bab6` |
| Platform Service Fee Strategy Audit（平台服务费策略只读审计） | ✅ CLOSED / read-only audit completed | — |
| Pricing / Service Credits Static Preview（价格/服务费静态说明页） | ✅ CLOSED / validated | `5b07162` |
| AI Help Billing Knowledge Sync（AI 帮助费用知识同步） | ✅ CLOSED / validated | `5b07162` |
| Service Credits Data Model Audit（服务积分数据模型只读审计） | ✅ CLOSED / read-only audit completed | — |
| Admin Simulated Service Credits View（管理员模拟服务积分只读视图） | ✅ CLOSED / validated | `cee4f9d` |
| Admin BYOK Business Metrics Dashboard（BYOK 商业指标只读看板） | ✅ CLOSED / validated | `9e80027` |
| BYOK Observation Summary / Admin Copy Report（BYOK 观察摘要 / 管理员可复制周报） | ✅ CLOSED / validated | `98859b7` |
| BYOK Observation Playbook（30–60 天观察期运营 Playbook） | ✅ CLOSED / validated | `40f3d81` |
| Canvas Cinematic Controls（专业镜头参数 UI 基础包） | ✅ CLOSED / shipped | `16ac371` |
| Canvas Smart Tools — Generate Readiness Check（右侧工具栏 · 生成前体检） | ✅ CLOSED / validated | `fa62030` |
| Canvas Smart Tools Tool 2 — Camera Lexicon（镜头词典 · image/video 节点专业镜头词汇插入） | ✅ CLOSED / validated | `e48ee95` |
| Canvas Smart Tools Toolbar Cleanup + Camera Lexicon Navigation Placement（右侧工具栏清理 · 镜头词典移至左侧导航） | ✅ CLOSED / validated | `a7b5a9a` |
| Canvas Smart Tools Tool 3A — Asset Variant Planner（资产变体规划器 · 左侧工具导航 · 变体方向卡片） | ✅ CLOSED / validated | `3819d1c` |
| Media Preview Fallback（历史资产 OSS URL 过期 → 冷静占位符，不再误诊） | ✅ CLOSED / validated | `5ebdb91` |
| Canvas Smart Tools Tool 4 — Character Lock / 角色一致性锁定基础版 | ✅ CLOSED / validated | `201c795` |
| Canvas Tool Dock Grouping（导演/资产/角色 分组子导航重构） | ✅ CLOSED / validated | `daa6811` |
| Workflow Connection Context Tools + Stronger Edges（连线上下文工具入口 + 连接线视觉增强） | ✅ CLOSED / validated | `2575b9f` |
| Reference Image Picker（视频节点文生视频 → 一键选择参考图节点 → 自动连线切换图生视频） | ✅ CLOSED / validated | `2575b9f` |
| Workflow Context Target Binding Fix（source→target 绑定修复 · 工具明确作用下游节点） | ✅ CLOSED / validated | `36eca47` |
| Make Workflow Continue Button Visible（继续创作按钮移入节点卡片 · 解决 position:fixed 坐标计算失效） | ✅ CLOSED / validated | `1133c2b` |
| Workflow Continue Options in Source Menu（继续创作三选项接入引用该节点生成菜单顶部） | ✅ CLOSED / validated | `f607a53` |
| Canvas Smart Tools Tool 5 — A/B Compare Panel（版本对比 · Asset 分组子工具） | ✅ CLOSED / validated | `66da5b5` |
| Canvas Smart Tools Tool 6 — Keyframe Extractor（关键帧提取器 · Asset 分组子工具） | ✅ CLOSED / validated | `ccb5f42` (build fix: `9e9b340`) |
| Canvas Smart Tools Tool 7 — Shot List Builder（分镜清单生成器 · Director 分组子工具） | ✅ CLOSED / validated | `26f8d16` (UX fix: `5cfb912`, editable source: `97ff477`, layout fix: `2cf744a`) |
| Shot List Builder 批量草案节点布局修复（多节点不再堆叠同一位置） | ✅ CLOSED / validated | `2cf744a` |
| Canvas Smart Tools Tool 8 — Continuity Checker（连贯性检查器 · Director 分组子工具） | ✅ CLOSED / validated | `1e9b737` |
| Canvas Smart Tools Tool 9 — Prompt Booster（提示词增强器 · Prompt 分组子工具） | ✅ CLOSED / validated | `6e1a24f` |
| Canvas Smart Tools Tool 10 — Sequence Board（镜头序列编排器） | ❌ REMOVED / not validated / removed from UI after product review | `37a43da` |
| Canvas Smart Tools Tool 10 — Batch Prompt Rewriter（批量 Prompt 重写器 · Prompt 分组子工具） | ✅ CLOSED / validated | `e3c3a2b` (readability fix: `e5bb57a`) |
| Canvas Smart Tools Tool 11 — Look Package Applier（视觉风格包应用器 · 节点顶部"调色 / Color Suite"入口 · 单节点模式） | ✅ CLOSED / validated | feat: `a8d6c10` · dialog entry: `888d9dd` · subject fix: `55aebc9` · feedback fix: `0610a1e` · token fix: `75a1771` · Chinese keywords: `27552ca` · empty-prompt warning: `2ee0a67` · Color Suite relocation: `b053a84` |
| Canvas Smart Tools Tool 12 — Color Grade Palette / 调色盘（image/video 节点顶部"调色 / Color Suite"入口 · 单节点模式） | ✅ CLOSED / validated | `a8753b4` · `5c9e6ef` · `46831e3` · `c5cefed` · `7a26d8d` · `d221df6` · `e08a09f` · `65a4152` · `c74e7e9` · `2c4fd15` · `b053a84` |
| Color Suite / 节点顶部"调色"入口（含调色盘 + 视觉风格包 · 均为当前节点单选工作流） | ✅ CLOSED / validated | `b053a84` |
| Color Grade 调色草案节点工作流（创建调色节点保存到画布 · idle · 不自动生成 · 不消耗 credits） | ✅ CLOSED / validated | `d221df6` · `65a4152` |
| Color Grade 预览即时生效文案修正（Preview Monitor CSS filter 即时 · 不再写"需重新生成才生效"为主语义） | ✅ CLOSED / validated | `c5cefed` · `7a26d8d` |
| Canvas V2 Beta 入口移除 | ✅ CLOSED / validated | `70e5c1e` |
| Tool 13 — Character Reference / Turnaround / Grid（四视图/九宫格） | 🚫 DEFERRED / REMOVED_FROM_UI / no UI entry point / dev-only route preserved | `20279ad` · deferred commit pending |
| Character Skill Worker — Face-ID POC route | 🔬 dev-only / `POST /api/skills/character-reference/face-id-poc` / requires env flag / not exposed in UI | `9403f60` |
| Web3 Foundation P0-1A — 资产所有权可见性基础 | ✅ VALIDATED / GET+PATCH `/api/assets/[assetId]` · asset detail page `/assets/[id]` · isPublic toggle in /assets list · real MyAssetsBlock in /me | `b119b4d` |
| Auth/me DB fallback — SESSION_DB_UNAVAILABLE 阻断修复 | ✅ VALIDATED / 90s session cache + longer retries + pool_timeout in db.ts | `b4d966d` |
| Web3 Foundation P0-1B — 资产授权意图 metadata-only | ✅ VALIDATED / Asset.metadataJson.licenseIntent · 4 可用 mode · marketplace_license disabled · /assets/[id] owner 编辑器 · /me license badge · 不改 schema · 不做交易 | `5c52d47` |
| Fix: Asset.size BigInt serialization（资产详情 GET 500） | ✅ VALIDATED / serializeAsset 加入 size BigInt 转换 | `aed884a` |
| Web3 Foundation P0-1C — 资产 Provenance / 复用关系展示 | ✅ AUDITED + Step A2 IMPLEMENTED / 只读展示 metadataJson.sourceAssetIds · 私有资产权限保护 · GET /api/assets/[assetId] 返回 sourceAssets · /assets/[id] 展示来源区块 · 不改 generate route · 不改 schema | `b3b7434` |
| Web3 Foundation P0-2 — Creator Passport 真实化 | ✅ IMPLEMENTED / /me 页重写：移除 12 个 mock store · PassportCard 读真实 /api/user/profile · StatsCard 读新建 GET /api/me/stats · MyAssetsBlock 保留 · studio 页删除假收益（MY_AGENTS.revenue / STATS 总收益 / 收益 tab 全删）· CurrentUser 加 createdAt · 不改 schema · 不改 generate route | `f77a9a5` |
| Web3 Foundation P0-3 — Marketplace 真实化 | ✅ IMPLEMENTED / metadata-only marketplaceIntent · Asset.metadataJson.marketplaceIntent · validateMarketplaceIntentInput · PATCH /api/assets/[assetId] 支持 marketplaceIntent · GET /api/marketplace/listings（isPublic+READY+reusable filter · wantsToList 优先排序）· /marketplace 替换 fake creator cards 为真实 MarketplaceListings client 组件 · /assets/[id] 新增 MarketplaceIntentEditor（owner）/ MarketplaceIntentReadOnly（非 owner）· /api/me/stats 加 marketplaceReady + marketplaceIntentCount · 不改 schema · 不做交易 · 不接钱包 | `051539a` |
| Web3 Foundation P0-4 — AssetListing schema-lite | ✅ IMPLEMENTED / migration 20260610000000_add_asset_listing · AssetListingStatus enum（DRAFT/ACTIVE/PAUSED/ARCHIVED）· AssetListing model · POST /api/marketplace/listings（创建 DRAFT，owner only，需 isPublic+READY+reusable）· PATCH /api/marketplace/listings/[id]（状态机：DRAFT→ACTIVE/ARCHIVED，ACTIVE→PAUSED/ARCHIVED，PAUSED→ACTIVE/ARCHIVED）· GET /api/marketplace/listings?assetId&mine=true（seller lookup）· GET /api/marketplace/listings（ACTIVE listing 列表）· /marketplace 读 AssetListing ACTIVE · /assets/[id] AssetListingSection 全状态机 · /api/me/stats 加 activeListingCount+draftListingCount · 不新增 LicenseGrant · 不新增 MarketplaceOrder · 不接 billing/payment · 不做购买 · 所有购买按钮 disabled | `d6254dd` |
| Web3 Foundation P0-5 — Free-only LicenseGrant | ✅ IMPLEMENTED / migration 20260610000001_add_license_grant · LicenseGrantStatus enum（ACTIVE/REVOKED）· LicenseGrant model（@@unique[listingId,buyerId]）· POST /api/marketplace/listings/[id]/grant（免费领取，priceCredits===0 门控，不调用 wallet，不新增 MarketplaceOrder）· GET /api/marketplace/listings/[id]/grant（check buyer's grant）· GET /api/me/licenses（买家授权列表）· GET /api/me/licenses/[assetId]（asset 级别授权查询）· /api/me/stats 加 grantsReceivedCount+grantsIssuedCount · /marketplace 免费 listing 显示"免费领取授权"→"✓ 已获取授权"· /assets/[id] seller 看"已授权 X 人"，buyer 看"✓ 已获得授权"badge · 付费 listing 继续 disabled · 不新增 MarketplaceOrder · 不接 billing/payment · 不调用 wallet | `e373dd3` |
| Web3 Foundation P0-6 — MarketplaceOrder PENDING-only | ✅ IMPLEMENTED / migration 20260612000000_add_marketplace_order · MarketplaceOrderStatus enum（PENDING/CANCELLED/REJECTED）· MarketplaceOrder model · POST /api/marketplace/listings/[id]/orders（创建 PENDING，priceCredits>0，不扣款，不创建 LicenseGrant）· GET /api/marketplace/listings/[id]/orders（seller 看待处理申请）· GET /api/me/marketplace-orders（buyer/seller 订单列表）· /marketplace 付费 listing 显示「申请付费授权」→「✓ 申请已提交」· /assets/[id] seller 看待处理申请数 + buyer 看申请状态 · /api/me/stats 加 marketplaceOrdersSubmittedCount+marketplaceOrdersReceivedCount · 不接 billing/payment · 不扣款 · 不创建 paid LicenseGrant · 不调用 wallet | `5f85484` |
| Web3 Foundation P0-7 — Seller Reject / Buyer Cancel | ✅ IMPLEMENTED / PATCH /api/me/marketplace-orders/[id]（action:cancel buyer PENDING→CANCELLED · action:reject seller PENDING→REJECTED · 不扣款 · 不创建 LicenseGrant · 不接 wallet）· /marketplace 取消申请按钮（已提交状态）· 已取消重新申请按钮 · 申请已被拒绝显示 · /assets/[id] seller 展开待处理申请列表+逐条拒绝按钮（点击展开/折叠）· /assets/[id] buyer 取消申请按钮（PENDING）· 已取消/已拒绝状态展示 · 不新增 ACCEPTED 状态 · 不改 schema · 不改 cn-executor | `7d69302` |
| Web3 Foundation P0-9 — MarketplaceOrder QUOTED State | ✅ IMPLEMENTED / migration 20260612000001_add_marketplace_order_quoted · QUOTED enum value · quotedAt DateTime? · instrumentation.ts P0-9 startup migration · PATCH action:quote（seller only PENDING→QUOTED）· GET /api/marketplace/listings/[id]/orders 返回 PENDING+QUOTED · /marketplace buyer 蓝色 badge"卖家已确认报价 · 等待支付功能开放"+ 免责声明 · /assets/[id] seller 每条申请：确认报价意向按钮（蓝）+ 拒绝按钮（红），QUOTED 显示"已确认报价"· /assets/[id] buyer QUOTED 状态展示含报价积分+日期+免责声明 · 不接 wallet · 不创建 LicenseGrant · 不扣款 | `4fb7bf8` |
| Web3 Foundation P1-0 — Marketplace Settlement v1 | ✅ IMPLEMENTED / migration 20260612000002_add_marketplace_settlement_v1 · COMPLETED enum + completedAt · CreditLedgerType MARKETPLACE_PURCHASE + MARKETPLACE_SELLER_CREDIT · instrumentation.ts P1-0 startup migration · lib/marketplace/settle.ts 原子事务（updateMany QUOTED→COMPLETED claim · buyer updateMany balance≥price 扣款 · buyer CreditLedger · seller wallet increment · seller CreditLedger · LicenseGrant upsert）· PATCH action:pay（buyer only，QUOTED→COMPLETED，MarketplaceSettleError → 对应 HTTP 状态码）· /api/me/marketplace-orders/[id] 返回 grant+priceCredits+platformFeeCredits+sellerAmountCredits · /api/credits/balance 查询余额 · /assets/[id] buyer QUOTED 展示余额+立即支付按钮+二次确认对话框 · /assets/[id] buyer COMPLETED 展示"✓ 授权已完成" · /assets/[id] seller 订单列表含 COMPLETED+"到账 X 积分" · /marketplace COMPLETED 绿色 ✓ 已获得授权 · /marketplace QUOTED"去支付"链接跳转 · platform fee=30%（MarketplaceOrder 记录，不转账） | `22ed8b3` |
| Web3 Foundation P1-4A — Launch Mode Feature Flags | ✅ IMPLEMENTED / WAITING_PRODUCTION_VALIDATION · MARKETPLACE_CREDITS_PAYMENT_ENABLED + MARKETPLACE_REFUND_REQUEST_ENABLED + PLATFORM_CREDITS_RECHARGE_ENABLED env var 门控；API 3 处 503 gate；MarketplaceListings.tsx 付费 idle→"申请授权合作" + QUOTED→"卖家已响应"；/assets/[id] QUOTED 去支付 UI 已移除；COMPLETED 退款按 flag 门控；/marketplace 文案更新为会员叙事；/account/credits 支付宝充值套餐 + 手动充值表单 按 PLATFORM_CREDITS_RECHARGE_ENABLED 门控（默认隐藏），替换为 BYOK 引导；余额/账本保留；不改 schema，不改 payment API，不改 wallet/ledger | `dbe6906` → follow-up pending |
| Web3 Foundation P1-3 — Marketplace Admin Console | ✅ IMPLEMENTED / 新增 /admin/marketplace 市场运营管理台 · 退款申请 tab（PENDING/APPROVED/REJECTED/EXECUTED/EXECUTION_FAILED/CANCELLED 状态过滤）· approve/reject/execute/approveAndExecute 操作（高风险操作有 window.confirm 二次确认）· EXECUTION_FAILED 显示 executionNote · APPROVED 行显示 amber"已批准待执行"提示 + 执行退款按钮 · 订单概览 tab 只读（状态过滤，全字段，资产/买家/卖家/金额/退款申请状态）· 新增 GET /api/admin/marketplace/orders（ADMIN only，支持 ?status= 过滤，take 100，include buyer/seller/asset/listing/refundRequest）· /admin/page.tsx 增加"市场管理"AdminCard（PENDING 退款数量 alertBadge）· 不改 schema · 不改 refund execution 事务 · 不新增账务行为 · P1-2 QA_DEFERRED_TO_UNIFIED_CODEX_RUN | `898fe89` |
| Web3 Foundation P1-2 — Admin-approved Refund Execution | ✅ IMPLEMENTED / migration 20260612000004_add_marketplace_refund_execution · MarketplaceOrderStatus REFUNDED + MarketplaceOrder.refundedAt · CreditLedgerType MARKETPLACE_REFUND + MARKETPLACE_SELLER_REVERSAL · RefundRequestStatus EXECUTED + EXECUTION_FAILED + executedAt + executionNote · instrumentation.ts P1-2 startup DDL · lib/marketplace/refund.ts executeMarketplaceRefund 原子事务（updateMany 双重幂等 claim · buyer wallet += priceCredits · buyer MARKETPLACE_REFUND ledger · seller updateMany balance≥sellerAmountCredits · seller MARKETPLACE_SELLER_REVERSAL ledger · LicenseGrant REVOKED + revokedAt + termsJson refund 元数据）· admin PATCH action:execute（APPROVED→EXECUTED）+ action:approveAndExecute（PENDING→APPROVED→EXECUTED）· seller 余额不足时 EXECUTION_FAILED 无任何账务副作用 · 不允许 seller 负余额 · 不做平台垫付 · 不接法币/EconomyWallet/PaymentOrder/NFT/chain · buyer /assets/[id] EXECUTED/EXECUTION_FAILED/REFUNDED 状态展示 · seller 订单列表 REFUNDED + 已退款 badge | `1cfd85f` |
| Web3 Foundation P1-1 — RefundRequest + Manual Review Intent | ✅ IMPLEMENTED / migration 20260612000003_add_marketplace_refund_request · MarketplaceRefundRequest model · MarketplaceRefundRequestStatus enum（PENDING/APPROVED/REJECTED/CANCELLED）· instrumentation.ts P1-1 startup migration（CREATE TABLE IF NOT EXISTS + indexes + FK）· POST /api/me/marketplace-orders/[id]/refund-request（buyer 提交，COMPLETED paid order only，reason 10-500字，幂等409+existing）· PATCH /api/me/marketplace-orders/[id]/refund-request action:cancel（PENDING→CANCELLED）· GET /api/me/marketplace-orders/[id]/refund-request（buyer 查询状态）· GET /api/admin/marketplace/refund-requests?status=（admin 列表，?status filter）· PATCH /api/admin/marketplace/refund-requests/[id] action:approve/reject（admin 审核，无账务）· /api/me/marketplace-orders 加 refundRequest 字段 · /api/marketplace/listings/[id]/orders（seller）加 refundRequest 字段 · /assets/[id] buyer COMPLETED 完整退款申请 UI（提交/撤销/状态展示含 adminNote）· /assets/[id] seller 订单列表每条 COMPLETED 加退款状态 badge · 支付确认对话框加 5 条免责声明 · 无账务变动 · 无 LicenseGrant revoke · [orderId] 路由目录重命名为 [id]（修复 Next.js 动态 slug 冲突） | `49ea001` |
| P1-4B-1 — Membership Schema Foundation | ✅ IMPLEMENTED / migration 20260614000000_add_membership_tables · MembershipStatus enum（INACTIVE/ACTIVE/EXPIRED/SUSPENDED）· MembershipOrderStatus enum（PENDING/APPROVED/REJECTED/CANCELLED）· UserMembership model（userId @unique · planCode @default("pro_monthly_cny100") · startsAt/expiresAt DateTime? · sourceOrderId String? · adminNote Text?）· MembershipOrder model（userId · amountCny @default(10000) · periodMonths @default(1) · voucherNote/adminNote Text?）· User model 加 membership UserMembership? + membershipOrders MembershipOrder[] · instrumentation.ts P1-4B startup DDL（CREATE TABLE IF NOT EXISTS + 幂等 enum + indexes + FK）· 不改 PaymentOrder · 不改 CreditLedger · 不改 UserCreditWallet · 不改 MarketplaceOrder · 不接法币/EconomyWallet/NFT/chain · 未做会员 API/UI（下一步 P1-4B-2） | `d2f7fe8` |
| P1-4B-2 — Membership Service Layer | ✅ IMPLEMENTED / apps/web/src/lib/membership/server.ts · computeMembershipStatus（纯函数，无 DB）· getUserMembership（读 UserMembership + 计算 runtime 状态）· submitMembershipOrder（幂等：已有 PENDING 则返回现有）· updateMembershipOrderVoucher（只允许 PENDING order）· approveMembershipOrder（$transaction：order→APPROVED + upsert UserMembership：续期叠加 or 重置 + 幂等重复 approve 保护）· rejectMembershipOrder（$transaction：order→REJECTED）· session.ts 加 membership: true include（单次 join，随 90s 缓存）· CurrentUser 接口加 membershipActive/membershipStatus/membershipExpiresAt/membershipPlanCode · mapSessionToUser 调用 computeMembershipStatus · /api/auth/me 自动返回新字段 · 不改 schema · 不改 PaymentOrder · 不改 CreditLedger / UserCreditWallet · 不做 UI 页面 · 不接自动支付 · 下一步 P1-4B-3：API routes + /account/membership + /admin/membership | `15d0d5e` |
| P1-4B-3 — Membership API + UI | ✅ IMPLEMENTED / GET /api/me/membership（状态+plan info）· POST /api/me/membership/orders（幂等提交，返回 PENDING or existing）· GET /api/me/membership/orders（最近 20 条）· PATCH /api/me/membership/orders/[id]（更新 PENDING voucherNote）· GET /api/admin/membership/orders（?status=PENDING/APPROVED/REJECTED/CANCELLED/ALL）· POST /api/admin/membership/orders/[id]/approve（调用 approveMembershipOrder，幂等）· POST /api/admin/membership/orders/[id]/reject（需 adminNote，不改 UserMembership）· /pricing（静态 ¥100/月说明：权益 + 不含 AI API 成本 + 开通流程）· /account/membership（用户端：状态/提交申请/查看订单/编辑 voucherNote）· /admin/membership（管理员端：approve/reject + window.confirm + adminNote + status filter）· /admin 首页加"会员管理"AdminCard + pendingMembershipCount alertBadge · /account/credits BYOK notice 加 /account/membership 入口链接 · 不改 PaymentOrder · 不写 CreditLedger · 不改 wallet · 不接自动支付 | `59b92cd` |
| Agent Loop Foundation | ✅ IMPLEMENTED / docs/PROJECT_MEMORY.md · docs/BOUNDARIES.md · docs/NEXT_TASKS.md · docs/AGENT_LOOP.md · docs/QA_RUNBOOK.md · docs/AGENT_REPORT_TEMPLATE.md · docs/AGENT_MODES.md · scripts/agent-loop-check.mjs · package.json agent:check script · type-check PASS · lint PASS (pre-existing warnings only) · build PASS · 不改业务逻辑 · 不改 schema · 不改 payment/wallet/generate/provider/cn-executor · 不引入新依赖 · 不做后台进程 | `924493a` |
| P1-4B-4 — Membership Basic Gating | ✅ IMPLEMENTED / QA VALIDATED / membershipGateResponse(user) helper（lib/membership/server.ts）返回 NextResponse 403 MEMBERSHIP_REQUIRED 或 null · POST /api/marketplace/listings（创建 DRAFT 须会员）· PATCH /api/marketplace/listings/[id]（仅 status→ACTIVE 须会员，PAUSED/ARCHIVED 不门控）· MembershipRequiredNotice 组件（components/membership/）· /assets/[id] 非会员 owner 显示 MembershipRequiredNotice（创建/激活/重新上架位置）· ADMIN 用户完全 bypass · BYOK 生成不受影响 · GET listings 不受影响 · 免费授权 grant 不受影响 · 不改 schema · 不改 payment/wallet/ledger · 不改 generate routes · type-check PASS · lint PASS · build PASS | `2e45d5c` |
| P1-4C-1 — BYOK-first Generation UX Hotfix | ✅ IMPLEMENTED / default billingMode 改为 user_provider_account · provider selector 排序：我的 API 账户在前、平台额度在后 · INSUFFICIENT_CREDITS 不再打开充值 modal，改为 inline 错误提示引导 /account/providers · /account/providers 移除「当前默认」（平台额度），BYOK 卡片改为「第一版默认」，新增 BYOK-first launch notice banner · 不改 provider adapter · 不改 reserve/finalize/refund 签名 · 不改 schema/payment/wallet/ledger · type-check PASS · lint PASS · build PASS | `ee96b33` |
| P1-4C-1-followup — Video Panel BYOK-first UX Fix | ✅ IMPLEMENTED / 根因：生成费用来源 section 只对 text/image 渲染，video 节点完全被排除 · 修复：条件扩展到 video · video+BYOK 模式：显示「视频生成 BYOK 即将开放」+ /account/providers CTA，generate 按钮 disabled · video+platform_credits 模式：显示「暂未对外开放」提示 · CanvasPromptBox credits pill：estimatedCredits 为 undefined 时不显示（删除 ?? 120/112 fallback） · video+BYOK 不传 estimatedCredits · 不改 provider adapter · 不改 reserve/finalize/refund · 不改 schema/payment/wallet/ledger · type-check PASS · lint PASS · build PASS | `7bd5b3e` |
| P1-4D-1 — MarketplaceInquiry Schema Foundation | ✅ IMPLEMENTED / MarketplaceInquiryStatus enum（PENDING/RESPONDED/REJECTED/CLOSED）· MarketplaceInquiry model（id/listingId/assetId/buyerId/sellerId/status/message/sellerNote/createdAt/updatedAt/respondedAt/closedAt）· @@unique[listingId,buyerId] · User.marketplaceInquiriesBought+Sold · AssetListing.inquiries · Asset.marketplaceInquiries · migration 20260615000000_add_marketplace_inquiry · instrumentation.ts P1-4D 幂等 DDL block · prisma generate PASS · type-check PASS · lint PASS · build PASS · 不改 MarketplaceOrder/LicenseGrant/CreditLedger/UserCreditWallet · 不做 API/UI/service | `447843b` |
| P1-4D-2 — MarketplaceInquiry Service + API | ✅ IMPLEMENTED / service lib/marketplace/inquiry.ts（submitMarketplaceInquiry幂等/重置CLOSED-REJECTED为PENDING · getMyInquiryForListing · listMarketplaceInquiries · respondMarketplaceInquiry · rejectMarketplaceInquiry · closeMarketplaceInquiry · MarketplaceInquiryError class · serializeInquiry）· POST /api/marketplace/listings/[id]/inquiries（membership gate·ADMIN bypass·buyer不能自己inquiry·ACTIVE listing only·message≤1000·idempotent）· GET /api/marketplace/listings/[id]/inquiries/me（不需会员·返回buyer自己inquiry or null）· GET /api/me/marketplace-inquiries?role=seller|buyer（带listing/asset/buyer/seller minimal include）· PATCH /api/me/marketplace-inquiries/[id]（action:respond seller only · action:reject seller only · action:close buyer或seller · 状态机PENDING/RESPONDED→各目标状态）· disclaimer warning字段 · 不改MarketplaceOrder/LicenseGrant/CreditLedger/UserCreditWallet · 不改payment/settlement/refund · 不做UI · type-check PASS · lint PASS · build PASS | `20899c7` |
| P1-4D-3 — MarketplaceInquiry Buyer/Seller UI | ✅ IMPLEMENTED / BuyerInquirySection（自包含·/assets/[id]买方视图·membership gate·submit/PENDING status+close/RESPONDED+sellerNote+close/REJECTED/CLOSED→resubmit）· SellerInquiryPanel（自包含·/assets/[id]卖方视图·GET /api/me/marketplace-inquiries?role=seller按listingId过滤·状态badge+buyer info+message+sellerNote输入+respond/reject/close按钮）· MarketplaceListings.tsx paid listing CTA改为Link到/assets/[assetId]（申请授权合作→）· 移除旧order/refund死代码块·state·3函数·buyer order fetch · 不改schema·不改payment·不改credits·不改MarketplaceOrder·不改LicenseGrant · type-check PASS · lint PASS · build PASS | `2e40cab` |
| P0-PROD-CANVAS-PUT-503-504 follow-up — IMPLEMENTED / WAITING_PRODUCTION_VALIDATION / instrumentation.ts：7个独立SELECT EXISTS合并为1条SQL（冷启动DB调用7×→1×）·has_refund_request门控保护 / db.ts：connection_limit 1→2（仪表化+首请求可并行）·pool_timeout 20→25 / type-check PASS · lint PASS · build PASS | `6d2a18c` |
| P0-PROD-CANVAS-PUT-503-504 — IMPLEMENTED / WAITING_PRODUCTION_VALIDATION / canvas PUT route：52s软截止（在节点批次间检查，返回503 CANVAS_SAVE_TIMEOUT而非Vercel 504）·3MB payload上限·200节点上限 / client：网络错误（status 0）触发5s saveBackoffUntil防止重试风暴·默认autosave debounce从800ms升至2000ms·区分网络错误与DB错误提示 · type-check PASS · lint PASS · build PASS | `1c999a2` |
| P0-PROD-RUNTIME-API-500-504 — IMPLEMENTED / WAITING_PRODUCTION_VALIDATION / credits/balance+provider-accounts：getCurrentUser()未在try/catch中→SESSION_DB_UNAVAILABLE传播为500·修复：两路由均加try/catch+isDbConnectionError()→503，其他→500 / instrumentation.ts：每次冷启动无条件执行14条DDL串行占用单pgBouncer连接→canvas请求超时504·修复：先检查executionNote列是否存在，已存在则跳过全部14条（~13次省去）· 不改schema·不改payment·不改cn-executor·不改generate routes · type-check PASS · lint PASS · build PASS | `653cb21` |

---

## P0 DB Pool Timeout — CLOSED

**Commit:** `3ec63b5`

- Node card no longer shows raw JSON error ✅
- Canvas save 503 backoff (10s) working ✅
- Cascade 503 (generation fail → immediate canvas PUT) resolved ✅
- Server logs identify stage (auth\_billing / provider / billing\_finalize / asset\_attach) ✅

---

## Provider Quota Fallback — CLOSED

**Commit:** `556f406`

- OpenAI quota error → friendly Chinese message, no code prefix ✅
- Image/video failure panel title shows "Provider 额度不足" (not raw code) ✅
- nextAction guides user to switch DeepSeek in node dialog ✅
- DB unavailable stays distinct ("数据库连接繁忙") ✅

---

## 中国版默认 Provider 策略 — CLOSED

**Commit:** `d0ccb1c`

- `TEXT_NODE_PROVIDER_OPTIONS` reordered: DeepSeek first, OpenAI last ✅
- `NODE_META.text.model` changed from `openai-text` → `deepseek-text` ✅
- `syncPromptPreset` for text uses `TEXT_NODE_PROVIDER_OPTIONS[0]` (was falling back to `anthropic-claude` via broken canvas provider registry lookup) ✅
- Existing nodes with saved `providerId` unaffected — user's choice preserved ✅
- Image/video already defaulted to CN providers (Volcengine); unchanged ✅

---

## 资产库兜底找回最小版 — CLOSED

**Commit:** `a990b5b`

### Acceptance results

| Check | Result |
|---|---|
| `asset_not_found_by_node` / `no_recovery_source` 不再在 UI 暴露 | ✅ |
| 失败面板标题显示中文友好名称（"素材未找回"等） | ✅ |
| 失败面板提供可点击 `/assets` 入口 | ✅ |
| 3 处技术性 `mediaFailureMessage` 改为用户友好文案 | ✅ |
| 正常生成、DeepSeek 默认、DB unavailable 文案不受影响 | ✅ |

### Asset 链路现状（已确认）

- 生成成功后素材保存在 `db.asset`（storageKey + url + providerJobId）✅
- `/assets` 页面 + `/api/assets` GET endpoint 已可用，无需新增 schema ✅
- `api/assets/resolve-by-node` 恢复链路完整 ✅

---

## 中国版入口分流检查 — CLOSED

**Commit:** `ad5ae06`

### 审计结论

核心生成链路（画布 → POST → 轮询 → 显示）完全使用相对路径，无跨域混用风险：

| 检查项 | 结论 |
|---|---|
| 主生成链路 API 路径 | ✅ 全部相对路径 `/api/...` |
| Media proxy URL 生成 | ✅ 相对路径，跟随当前入口域名 |
| Session / cookie 隔离 | ✅ 未设置显式 domain，自动绑定当前域名 |
| 中国版默认 DeepSeek | ✅ `NODE_META.text.model = 'deepseek-text'` 已生效 |
| OpenAI 在 region registry 标注 | ✅ `availability: 'future'`，不会默认出现 |

### P1 修复

- **问题：** `ProjectDeliveryClient.tsx` 中 `CUSTOMER_DELIVERY_ORIGIN` 硬编码为 `https://creator-city-vert.vercel.app`，CN 用户生成的客户交付分享链接会指向 Vercel 域名
- **修复：** 改为 `process.env.NEXT_PUBLIC_APP_URL ?? 'https://creator-city-vert.vercel.app'`
- **文件：** `apps/web/src/app/projects/[id]/delivery/ProjectDeliveryClient.tsx`
- **效果：** CN 部署配置 `NEXT_PUBLIC_APP_URL` 后，交付分享链接自动使用 CN 域名；未配置时保持原 Vercel URL 兜底

### 剩余 P2（需单独排期，不在本次处理）

- `NEXT_PUBLIC_API_URL` 默认指向 `http://localhost:4000`（legacy NestJS）— billing webhook（`settleCredits / refundCredits / fulfillOrder`）在 CN 部署未配置此变量时会打向 localhost 导致失败
- 影响范围：支付宝/微信支付回调 + admin billing 路由，不影响核心画布生成链路
- 处理前提：需要确认 CN 部署是否使用支付链路

---

## User Provider Accounts Phase 2A/2B — CLOSED / foundation added

**Commit:** `778bb2d`

### 已完成内容

| 项目 | 状态 |
|---|---|
| Prisma schema: `UserProviderAccount` 表（14 字段） | ✅ |
| Migration: `20260601000000_user_provider_account` | ✅ |
| Crypto helper: `apps/web/src/lib/provider-accounts/crypto.ts` | ✅ |
| 加密格式: `base64(iv):base64(authTag):base64(ciphertext)`（AES-256-GCM） | ✅ |
| 17 单元测试（node:test）：全部通过 | ✅ |
| type-check / lint / build：全部通过 | ✅ |

### Schema 字段摘要

- `userId` FK → `User.id` (CASCADE)
- `providerId` — 如 `deepseek-text` / `openai-text`
- `encryptedApiKey` — AES-256-GCM 密文，服务端仅内存解密，不返回前端
- `keyLast4` — 原始 key 末 4 位，用于 UI 展示
- `status` — `active` / `disabled` / `invalid`
- `isDefault` — 该 provider 的默认账户（业务逻辑保证唯一性）
- `projectScope` — null = 全局；projectId = 仅限项目
- `lastTestedAt` / `lastTestStatus` / `lastTestError` — 测试连接预留字段
- Indexes: `[userId]`、`[userId, providerId]`、`[userId, status]`

### 当前状态（重要）

- **仅 schema + encryption helper，不可用于真实生成**
- `crypto.ts` 已被 Phase 2C service 层 import，但不影响生成链路
- 管理页 / 测试连接 / 生成链路接入均未实现（见 Phase 2C 节）

### 生产注意事项

Migration `20260601000000_user_provider_account` 已提交到 git，但**进入 Phase 2C（CRUD API）前必须确认 Supabase production migration 已应用**，否则 CRUD 路由会报表不存在错误。应用方式：`pnpm --filter server prisma:migrate deploy`（或通过 Supabase Dashboard 手动执行 migration.sql）。

`PROVIDER_KEY_ENCRYPTION_SECRET` 须在生产环境提前配置（base64 编码的 32 字节随机值），否则 CRUD 路由启动时会抛出服务端配置错误（不影响现有功能）。

### 未完成部分（下一阶段）

- **Phase 2C**：`/api/provider-accounts` CRUD — ✅ 已在 commit `fa088d2` 完成
- **Phase 2D**：`/account/providers` 管理页（添加 Key、查看状态、删除）
- **Phase 3**：`POST /api/provider-accounts/:id/test` 测试连接
- **Phase 4**：先只接 text 生成链路试点（`apiKeyOverride` + `billingMode`）

### 安全边界确认

- 未修改 `/api/generate/*`（text / image / video）
- 未修改 `VisualCanvasWorkspace.tsx` / `CanvasNodeCard.tsx`
- 未修改 `billing/` / `credits/` / `reserve` / `finalize` / `refund`
- 未修改 provider adapter 真实调用逻辑
- 未修改 payment / Stripe / 支付宝 / 微信
- 未修改 `apps/cn-executor`
- 未改 billingMode 语义 / credits 计费

---

## User Provider Accounts Phase 2C — CLOSED / CRUD API added

**Commit:** `fa088d2`

### 已完成内容

| 项目 | 状态 |
|---|---|
| `GET /api/provider-accounts` — 列出当前用户账户（无 encryptedApiKey） | ✅ |
| `POST /api/provider-accounts` — 创建账户，Key 立即 AES-256-GCM 加密 | ✅ |
| `PATCH /api/provider-accounts/:id` — 更新 label / status / isDefault / projectScope | ✅ |
| `DELETE /api/provider-accounts/:id` — 硬删除，encrypted key 永久消失 | ✅ |
| Service 层：`apps/web/src/lib/provider-accounts/service.ts` | ✅ |
| 响应白名单：永不返回 `encryptedApiKey` 或原始 `apiKey` | ✅ |
| isDefault 冲突：同 provider 其他账户自动取消默认 | ✅ |
| 用户隔离：所有查询带 `userId` 约束，越权访问返回 404 | ✅ |
| env 缺失：`PROVIDER_KEY_ENCRYPTION_SECRET` 未配置时返回安全 503 | ✅ |
| type-check / lint / build：全部通过 | ✅ |

### API 字段说明

**POST 请求体：** `providerId`（必填）、`apiKey`（必填，≥8 字符）、`accountLabel`（必填）、`isDefault?`、`projectScope?`

**PATCH 请求体（白名单）：** `accountLabel?`、`status?`（active / disabled / invalid）、`isDefault?`、`projectScope?`；其余字段（含 `apiKey`）静默忽略

**所有响应 summary 字段：** `id` / `providerId` / `accountLabel` / `keyLast4` / `status` / `isDefault` / `projectScope` / `lastTestedAt` / `lastTestStatus` / `lastTestError` / `createdAt` / `updatedAt`

### 当前状态（重要）

- **CRUD API 可正常使用，但还不可用于真实生成**
- 生成路由（text / image / video）尚未接入 `apiKeyOverride` / `billingMode`
- `/account/providers` 前端管理页尚未实现

### 生产前置条件（上线前必做）

1. 应用 migration：`pnpm --filter server prisma:migrate deploy`（migration: `20260601000000_user_provider_account`）
2. Vercel / CN 部署配置环境变量：`PROVIDER_KEY_ENCRYPTION_SECRET=<base64 of 32 random bytes>`
3. 未配置 secret 时，POST 创建 provider account 会安全返回 503（预期行为，不影响现有生成链路）

### 未完成部分（下一阶段）

- **Phase 2D**：✅ `/account/providers` 管理页 — 已在 commit `85c9622` 完成
- **Phase 3**：`POST /api/provider-accounts/:id/test` 测试连接
- **Phase 4**：先只接 text 生成链路试点（`apiKeyOverride` + `billingMode`）

### 安全边界确认

- 未修改 `/api/generate/*`（text / image / video）
- 未修改 `VisualCanvasWorkspace.tsx` / `CanvasNodeCard.tsx`
- 未修改 `billing/` / `credits/` / `reserve` / `finalize` / `refund`
- 未修改 provider adapter 真实调用逻辑
- 未修改 payment / Stripe / 支付宝 / 微信
- 未修改 `apps/cn-executor`
- 未接入真实生成链路

---

## User Provider Accounts Phase 2D — CLOSED / UI shipped

**Commits:** `b7182ce` (nav surface) → `85c9622` (管理页)

### 已完成内容

| 项目 | 状态 |
|---|---|
| `/account/providers` 管理页（列出账户、添加 Key、设为默认、启停、删除） | ✅ |
| 账单模式对比卡（平台额度 vs 我的 API 账户） | ✅ |
| 阶段提示：明确 Key 仅存储，未接入生成链路 | ✅ |
| 前端永不显示完整 apiKey / encryptedApiKey | ✅ |
| 用户头像 hover 下拉菜单加入 Provider API 账户入口 | ✅ |
| `/account` 快速入口卡片加入 Provider API 账户 | ✅ |
| type-check / lint / build：全部通过 | ✅ |

### 当前状态

- CRUD API 可正常使用，管理页已上线
- **Key 仅加密存储，未用于生成调用**
- 生成路由（text / image / video）尚未接入 `apiKeyOverride` / `billingMode`
- ✅ Supabase production migration `20260601000000_user_provider_account` 已应用
- ✅ `PROVIDER_KEY_ENCRYPTION_SECRET` 已在 Vercel 配置
- ✅ `GET /api/provider-accounts` 线上正常（不再显示"获取账户列表失败"）

---

## Account Monetization Navigation — CLOSED / validated

**Commits:** `5561a80` → `733d29f`

### 已完成内容

| 项目 | 状态 |
|---|---|
| 移除顶部导航 amber "充值" 独立按钮 | ✅ |
| "积分与充值" href 统一改为 `/account/credits` | ✅ |
| `/account` 快速入口扩展为 3 列：平台额度 / 我的 API 账户 / 订阅与套餐 | ✅ |
| 用户头像菜单加入"订阅与套餐（即将开放）"灰色入口 | ✅ |
| `/account/providers` 账单模式卡文案：平台额度 / 未来平台服务费说明 | ✅ |
| ⌘K 搜索加入"订阅与套餐"条目 | ✅ |
| 主导航加入"我的 API"组（API 账户管理 + 平台模型中心） | ✅ |
| ⌘K 搜索"Provider API 账户"更名为"API 账户管理"，分组改为"我的 API" | ✅ |

### 当前导航状态

**主导航（从左到右）：** 创作 · 市场 · 工作台 · 我的 API · 平台 · 社区与帮助

- **我的 API** hover 展开：API 账户管理（→ `/account/providers`）、平台模型中心（→ `/providers`）
- 主导航不再出现充值/积分相关按钮

**用户头像下拉菜单：**
- ⚙ 账号设置 → `/account`
- ⚡ Provider API 账户 → `/account/providers`（紫色高亮）
- ◎ 积分与充值 → `/account/credits`
- ★ 订阅与套餐（即将开放，灰色不可点）
- ↩ 登出

### 商业叙事转向

| 维度 | 旧叙事 | 新叙事 |
|---|---|---|
| 核心商业动作 | 充值积分，平台代付 API | 双轨：平台额度 OR 接入自己的 API Key |
| Provider 费用 | 平台统一代付 | 用户直接支付给 Provider，不经过平台 |
| 平台收入来源 | API 转售差价 | 未来：平台服务费 / 订阅 / 协作 / 交易服务费 |
| 主导航叙事 | 充值（核心按钮） | 我的 API（去中心化能力） |
| 充值入口 | 主导航 + 用户菜单 | 仅用户菜单（积分与充值） |

### 安全边界确认

- 未修改 `/api/generate/*` / billing / credits / payment / schema / cn-executor
- 仅修改：`TopNavigation.tsx`、`account/page.tsx`、`account/providers/page.tsx`

---

## User Provider Accounts Production Setup — CLOSED / validated

### 已完成内容

| 项目 | 状态 |
|---|---|
| Supabase production migration `20260601000000_user_provider_account` 已执行 | ✅ |
| `UserProviderAccount` 表已成功创建（Supabase SQL Editor 显示 Success） | ✅ |
| `PROVIDER_KEY_ENCRYPTION_SECRET` 已在 Vercel 环境变量配置（32 bytes base64） | ✅ |
| `GET /api/provider-accounts` 线上恢复正常 | ✅ |
| `/account/providers` 页面不再显示"获取账户列表失败" | ✅ |

### 当前状态

- **Provider account 管理基础链路已在生产可用：列出 / 添加 / 设默认 / 启停 / 删除**
- Key 加密存储后仍**未用于真实生成调用**
- 生成路由（text / image / video）尚未接入 `apiKeyOverride` / `billingMode`

### 未完成部分

- **Phase 3**：`POST /api/provider-accounts/:id/test` 测试连接
- **Phase 4**：先只接 text 生成链路试点（`apiKeyOverride` + `billingMode`）
- 团队共享 API 账户（多用户共享同一 Key）
- 平台服务费 / 订阅逻辑

---

## User Provider Accounts Phase 3 — CLOSED / test connection shipped

**Commit:** `6890501`

### 已完成内容

| 项目 | 状态 |
|---|---|
| `POST /api/provider-accounts/:id/test` — 测试连接端点 | ✅ |
| 解密 Key 内存中调用 Provider `/models` 端点验证有效性 | ✅ |
| 测试结果写回 DB：`lastTestedAt` / `lastTestStatus` / `lastTestError` | ✅ |
| `auth_failed` 时自动将账户状态改为 `invalid` | ✅ |
| `/account/providers` UI 加入「测试连接」按钮 | ✅ |
| 用户隔离：只能测试自己的账户 | ✅ |
| API Key / 错误信息全程脱敏，不返回明文 Key | ✅ |

### TestStatus 类型

`ok` / `auth_failed` / `timeout` / `rate_limited` / `insufficient_quota` / `unsupported` / `error`

---

## P0 Auth/Session 持久化修复 — CLOSED / validated

**Commit:** `dfcd10c`

### 问题

`/api/auth/me` 在 DB 短暂不可用时返回 `authenticated: false`，`AuthProvider` 误判为真正未登录并调用 `logout()`，清空 zustand 状态，导致刷新后强制登出。

### 修复内容

| 项目 | 状态 |
|---|---|
| `MeResponse` 新增 `errorCode?` 字段，DB 不可用时返回 error code 而非裸 false | ✅ |
| `AuthProvider.tsx`：有 `errorCode` 时跳过 `logout()`，保留当前 session 状态 | ✅ |
| `use-current-user.ts`：有 `errorCode` 时返回 `status: 'unknown'`，而非 `unauthenticated` | ✅ |
| 各页面（TopNavigation / projects/[id] / dashboard / overview）使用 `effectiveIsAuthenticated`，把 `unknown` 等同于 `loading` 处理 | ✅ |

### 效果

DB 短暂不可用 → 用户保持登录状态，页面正常显示；真正未登录 → 仍然跳转登录。

---

## User Provider Accounts Phase 4 — CLOSED / Text BYOK validated

**Commits:** `ea2ccc6`（BYOK 生成）→ `8d96d09`（UX 修复）

### 已验收能力

| 验收项 | 状态 |
|---|---|
| 用户可在 `/account/providers` 添加自己的 Provider API Key | ✅ |
| 可测试连接，验证 Key 有效性 | ✅ |
| Text 节点对话框中可选择「我的 API 账户」计费模式 | ✅ |
| 选择指定账户后点击生成，走用户自己的 API Key 调用 | ✅ |
| BYOK Text 路径不扣平台模型 credits | ✅ |
| 平台额度模式保持原逻辑不变 | ✅ |
| Image / Video 未接入 BYOK，仍走平台侧 | ✅ |
| API Key 文案误解修复：明确 API Key ≠ 网页登录邮箱/密码 | ✅ |
| `/account/providers` zustand hydration race 修复：不再误跳到登录页 | ✅ |
| type-check / lint / build 全部通过 | ✅ |

### 当前 BYOK 支持范围

| Provider | 当前状态 |
|---|---|
| DeepSeek（deepseek-text / deepseek-reasoner） | ✅ 文本试点支持 |
| OpenAI（openai-text） | ✅ 文本试点支持 |
| Kimi（kimi-text / kimi-multimodal） | ✅ 文本试点支持 |
| Image / Video 所有 Provider | ❌ 暂未接入 BYOK |

### 实现方式（关键文件）

- `apps/web/src/app/api/generate/text/route.ts` — 新增 `billingMode: 'user_provider_account'` 早返回分支，完整绕过平台 billing
- `apps/web/src/lib/providers/china/deepseek.ts` / `kimi.ts` — 新增 `apiKeyOverride` 参数
- `apps/web/src/components/create/VisualCanvasWorkspace.tsx` — 账户选择 UI + 延迟加载账户列表
- `apps/web/src/app/account/providers/page.tsx` — API Key 文案明确化 + hydration race 修复

### 安全边界确认

- `encryptedApiKey` 永不返回前端，解密只在服务端内存进行
- `apiKeyOverride` 参数不扩展到 image/video 生成路由
- 不改 Prisma schema / migration / payment / cn-executor
- setupBilling / finalizeBilling 完全跳过（不扣 credits，不触发扣费链路）

### 当前未完成（后续阶段）

- Image / Video BYOK
- Seedance / 火山 Access Key + Secret Key 多字段凭证支持
- BYOK 模式下平台服务费记录（平台服务费 ≠ provider API 费用）
- 团队共享 API account（多用户共用同一 Key）
- 独立 API Key 帮助页 `/help/api-keys`

---

## Provider API Key 帮助内容 — CLOSED / shipped

**Commits:** `def152b`（画布帮助面板）→ `d8ddd43`（AI Agent 指南）

### 已完成内容

| 项目 | 状态 |
|---|---|
| 画布右下角帮助面板升级为 4 标签（新手 / API Key / Provider / 排查） | ✅ |
| 18 个 Provider 接入指南（DeepSeek~OpenRouter），含状态标注 | ✅ |
| 明确 API Key ≠ 网页登录密码；普通用户不需要 API Key | ✅ |
| Creator City 不是 API 转售平台；Provider 费用由用户直付服务商 | ✅ |
| 浮动 AI Agent 新增「我的 API」和「API Key 指南」快捷动作 | ✅ |
| AI Agent 本地模式新增关键词匹配：DeepSeek/OpenAI/Kimi/Gemini/Claude/通用 API Key/BYOK/认证失败排查 | ✅ |
| 无真实 AI 调用，无新增 API 路由，无生成链路改动 | ✅ |

---

## Image/Video BYOK 多字段凭证方案审计 — CLOSED / read-only audit completed

**审计日期：** 2026-06-02  
**审计性质：** 只读 — 零文件修改，零 commit，零 push

### 当前真实状态

| 能力 | 状态 |
|---|---|
| Text BYOK（DeepSeek / OpenAI / Kimi） | ✅ 已验收 |
| Image BYOK（Seedream / 其他图片 Provider） | ❌ 未实现 |
| Video BYOK（Seedance / 其他视频 Provider） | ❌ 未实现 |
| 多字段凭证存储（encryptedFields） | ❌ 未实现 |

### 核心审计结论

1. **Volcengine Ark API 使用 Bearer Token 格式，不是传统 HMAC AK/SK 签名。**  
   Seedream（图片）和 Seedance（视频）都用同一个 `VOLCENGINE_ARK_API_KEY`（Bearer），调用 OpenAI-compatible endpoint。这意味着 Volcengine BYOK 不需要实现 HMAC 签名逻辑，比预想简单。

2. **Volcengine BYOK 预计需要两个字段：**  
   - `apiKey`（Bearer Token，来自火山方舟控制台 API Key）  
   - `endpointId`（对应 VOLCENGINE_SEEDREAM_MODEL / VOLCENGINE_SEEDANCE_MODEL，每个用户的方舟账号不同）

3. **当前 `UserProviderAccount.encryptedApiKey` 单字段不足以支持需要 Endpoint ID 的 Provider。**  
   需扩展 schema 支持多字段加密存储。

4. **推荐 schema 扩展方向（方案 A，JSON 扩展，非破坏性）：**  
   - `encryptedFields: Json?` — 存储额外加密字段（`{ fieldName: encryptedValue, ... }`）  
   - `fieldMeta: Json?` — 存储额外字段的 UI 元数据（`{ fieldName: { label, last4, updatedAt } }`）  
   无需新表，零破坏性 migration，字段数 ≤3 时足够用。

5. **Seedream Image BYOK 应优先于 Seedance Video BYOK。**  
   Seedream 走 Vercel-side 触发（cn-executor 只是异步执行器），BYOK 路径可控。

6. **Seedance Video BYOK 涉及 cn-executor 安全边界扩张，必须单独排期评审。**  
   cn-executor 当前只读取自身 env var。要支持用户凭证，cn-executor 必须能按需从 DB 解密，意味着 cn-executor 需要 `PROVIDER_KEY_ENCRYPTION_SECRET` 和 Supabase 连接权限，安全边界扩张，不可在图片 BYOK 内顺手做。

7. **OSS 与 BYOK 无关。** `ALIYUN_OSS_ACCESS_KEY_ID` / `ALIYUN_OSS_ACCESS_KEY_SECRET` 是平台存储账号，不属于用户 BYOK 范畴，不动。

### 安全约束（实现时必须全部满足）

- `encryptedApiKey` 和 `encryptedFields` 中的值永远不返回给前端
- 解密只在服务端实际调用 provider 前一刻进行，不 log，不缓存
- 错误信息必须脱敏：不返回 Authorization header、原始 key、request body
- 只能操作自己的 account（`account.userId === currentUser.id`）
- 加密算法与现有 text BYOK 一致（AES-256-GCM，`encryptProviderApiKey` / `decryptProviderApiKey`）

### 推荐分阶段实现顺序

| 阶段 | 内容 | 范围约束 |
|---|---|---|
| **Phase V1** | 多字段凭证结构扩展 | 只改 schema / service / UI，不接生成链路，不动 cn-executor |
| **Phase V2** | Seedream Image BYOK 试点 | 只接图片，不碰视频，不动 cn-executor |
| **Phase V3** | Seedance Video BYOK 安全方案评审与试点 | 单独评审 cn-executor 解密/透传方案，评审通过后再实现 |
| **Phase V4** | 其他单 API Key 图片/视频 Provider BYOK | 在 V2 链路验证后复用 |
| **Phase V5** | BYOK 平台服务费记录 / usage logging | 不触及 billing 语义，仅记录 |
| **Phase V6** | 团队共享凭证（多用户共用同一 Key） | 独立评审 |

---

## 当前商业方向（已明确）

Creator City **不是中心化 API 转售平台**。商业模型为：

| 模式 | 说明 |
|---|---|
| 平台额度（过渡期） | 用户购买积分，平台代付 Provider API 费用 |
| 我的 API（去中心化） | 用户自带 API Key，费用直付给 Provider，Creator City 不代扣 |
| 平台服务费（未来主要收入） | 工作台 / 协作工具 / 交易撮合 / 订阅，不含 API 转售差价 |

**当前状态：** Creator City 已形成"平台额度 + 我的 API 账户 + 用量记录 + 用户端/管理员端可视化 + API Key 教程 + 单账户用量汇总 + 账户详情/健康状态 + 子页面返回体验 + 账户管理 UX 全面 polish + 账号/积分/BYOK 费用模式说明统一 + 账户健康建议/错误修复引导 + cn-executor 日志脱敏 + 视频 BYOK feature flag skeleton + 平台服务费策略只读审计 + 价格/服务费静态说明页面 + AI 帮助费用知识同步 + 服务积分数据模型只读审计"的 BYOK 完整闭环。Provider Account Center 已从 API 账户列表升级为更完整的用户可理解账户管理体验：用户能接入、理解、查看用量、查看详情、看健康状态、看明确修复建议、找到教程，并能从菜单/搜索快速进入关键页面。账户健康状态不仅展示状态，还能指导用户修复 API Key、额度、账单、接入点、最近失败等问题，用户可以从错误状态直接理解下一步动作，而不是只看到失败。/account 页面已在快捷入口下方统一展示三种费用模式说明；/account/credits 页面已明确区分平台 credits 与 Provider 直付费用，防止用户误解。当前不赚 API 差价，不启用平台服务费扣费。Seedance Video BYOK 实施仍暂缓。Canvas Smart Tools Prompt 分组已加入第三个工具：Look Package Applier / 视觉风格包应用器已浏览器验收通过。Prompt 分组当前包含：Prompt Booster（提示词增强器）/ Batch Prompt Rewriter（批量 Prompt 重写器）/ Look Package Applier（视觉风格包）。image/video 节点编辑框顶部导航有彩色"视觉风格"快捷入口；全局工具栏也保留多节点批量入口。MVP 内置 10 个精选 Look 共 6 分类（导演风格/胶片模拟/LUT调色/品牌商业/建筑空间/社交摄影）：库布里克冷峻对称 / 王家卫霓虹怀旧 / Kodak Vision3 胶片模拟 / 富士 Velvia 风光 / 青橙好莱坞 / 褪色独立电影 / 苹果极简白 / 奢华暗金 / 北欧混凝土极简 / 黄金时刻生活流。每个 Look 均有调色/光线/质感/氛围 4 维度中文关键词，用户可按维度选择只追加部分。应用时追加 [视觉风格: nameZh] + 选中维度中文关键词 + 主体保护约束 + 负向约束；不替换原 prompt；不自动生成；不消耗 credits。UI 明确说明：Look 只改 prompt，需点击重新生成才生效；不承诺 100% 保持原图，仅通过 prompt 约束降低主体漂移。真正"原图只改色不换主体"需要图生图/参考图/vision/provider 能力，需单独评估后实施。服务积分数据模型已只读审计：推荐 Option B（独立 ServiceCreditWallet + ServiceCreditLedger），不推荐 Option A/C/D/E；9 项 no-go 条件全部未满足；当前继续观察 BYOK 用量 30-60 天，不做 schema migration，不做 service fee 扣费。管理员模拟服务积分只读视图已上线并验收：/admin/usage 可看到理论 service credits 估算（Text=0/Image=1/Video=5-10），只读不扣费，enabled=false，不写账本，不改 UsageLog.platformServiceFeeCredits。Creator City 现在可以在不收费、不写账本、不改 schema 的情况下，用真实 BYOK 用量估算未来 service credits 理论值。Admin BYOK 商业指标只读看板已上线并验收：管理员可实时查看 BYOK 调用占比/活跃用户/成功率/高频用户（≥10次/时间范围）/Provider 分布/类型分布/daily trend，完整 BYOK 商业数据可见，不扣费、不写账本、不改 UsageLog.platformServiceFeeCredits。BYOK 观察摘要已实现：/admin/usage 新增 emerald 区块，管理员可一键复制中文周报摘要（BYOK 调用/占比/活跃用户/成功率/高频用户/Top Provider/类型分布/模拟积分/自动观察结论），不写 DB，不扣费，不改 schema；复制失败时显示 textarea fallback。30–60 天观察期运营 Playbook 已上线并验收：/admin/usage 新增 indigo 区块，包含每周固定查看清单（8 项）、继续观察条件（4项）、先修稳定性条件（4项）、可进入下一阶段条件（6项全部满足才启动）、6 条绝不直接收费 no-go；纯静态不写 DB 不扣费不改 schema。Creator City 现在已形成完整 BYOK 30–60 天观察期运营方法：看指标 → 复制周报 → 判断继续观察/先修稳定性/是否进入下一阶段，管理员每周有清单、有阈值、有 no-go 防护。

**当前能力矩阵（production 已验收）：**

| 能力 | 状态 |
|---|---|
| Text BYOK（DeepSeek / OpenAI / Kimi） | ✅ validated |
| Seedream Image BYOK | ✅ validated |
| 多字段凭证存储（encryptedFields / fieldMeta） | ✅ production validated |
| UsageLog Phase S1（用量记录，不扣费） | ✅ production validated |
| Admin BYOK Usage Dashboard（`/admin/usage`） | ✅ validated |
| Provider Account Center（模型账户中心 UI） | ✅ validated |
| Provider Account Center auth guard（白屏修复） | ✅ validated |
| User Usage History（`/account/usage`） | ✅ validated |
| Provider API Key Guide（`/help/api-keys`） | ✅ validated |
| Provider Account Usage Summary（账户卡片近 90 天用量） | ✅ validated |
| Provider Account Detail / Health Status（账户详情页） | ✅ validated |
| Subpage Navigation Polish（全站子页面返回入口 + 无效按钮清理） | ✅ validated |
| Provider Account Center UX Polish（文案中文化 + 入口补齐 + 空状态 + 错误提示） | ✅ validated |
| Account / Billing / BYOK Messaging（账号/积分/BYOK 三种费用模式说明统一） | ✅ validated |
| Provider Account Health Guidance（账户健康建议/错误修复引导） | ✅ validated |
| Seedance Video BYOK 安全评审 | ✅ read-only audit completed |
| Seedance Video BYOK Safe Logging / Feature Flag Skeleton | ✅ validated |
| Seedance Video BYOK | ❌ not implemented（feature flag 默认关闭；安全基础已就绪；推荐方案 Option A；暂缓实施） |
| Platform Service Fee Strategy Audit | ✅ read-only audit completed（结论：当前不启用；继续观察 BYOK 用量 30-60 天） |
| Pricing / Service Credits Static Preview（`/pricing-preview` 费用说明页） | ✅ validated（当前费用模式 / Service Credits 草案（未启用）/ 费用 FAQ 全部展示；明确不收费；搜索可达；`5b07162`） |
| AI Help Billing Knowledge Sync（平台 AI 帮助费用知识） | ✅ validated（本地 AI 可回答 7 类费用问题：平台服务费 / 我的API扣费 / 充值≠Provider / 谁收费 / 何时启用 / 失败退款 / 普通用户需要Key；`5b07162`） |
| Command Palette 费用页面搜索词 | ✅ validated（pricing-preview / help-api-keys / my-api / help 已加入搜索索引，含 30+ 中英文关键词） |
| Platform service fee charging | ❌ not implemented（UsageLog.platformServiceFeeCredits 固定为 0；不扣 service credits；UI 显示"未启用"） |
| Service credits wallet | ❌ not implemented（无独立 service credits 余额；当前只有平台额度 wallet） |
| Subscription billing | ❌ not implemented（无 Subscription 数据模型；/pricing-preview 仅静态草案） |
| Service Credits Data Model Audit（服务积分数据模型只读审计） | ✅ read-only audit completed（推荐 Option B：独立 ServiceCreditWallet + ServiceCreditLedger；9 项 no-go 条件；迁移阶段 M0-M6；当前继续观察 30-60 天） |
| Admin Simulated Service Credits View（管理员模拟服务积分只读视图） | ✅ validated（只读模拟，不扣费，不写 ledger，不改 UsageLog.platformServiceFeeCredits；/admin/usage amber 区块；API simulatedServiceCredits 字段；enabled=false；只统计 BYOK succeeded；failed/pending 不计入；`cee4f9d`） |
| Admin BYOK Business Metrics Dashboard（BYOK 商业指标只读看板） | ✅ validated（只读业务观察，不扣费，不写 ledger，不改 schema；/admin/usage sky 区块；BYOK 调用/占比/活跃用户/成功率/高频用户/Provider/类型/daily trend；API byokBusinessMetrics 字段；findMany+reduce 无 groupBy 问题；高频阈值≥10次；`9e80027`） |
| BYOK Observation Summary / Admin Copy Report（BYOK 观察摘要 / 管理员可复制周报） | ✅ validated（/admin/usage emerald 区块；前端 buildObservationSummary 函数；复制摘要按钮；自动观察结论；navigator.clipboard fallback textarea；不写 DB，不扣费，不改 schema；只依赖已有 byokBusinessMetrics + simulatedServiceCredits API 数据；`98859b7`） |
| BYOK Observation Playbook（30–60 天观察期运营 Playbook） | ✅ validated（/admin/usage indigo 区块；4 组静态文案：每周固定查看（8项）/ 继续观察（4条件）/ 先修稳定性（4条件）/ 可进入下一阶段（6条件）；6 条 no-go；纯静态不写 DB 不扣费不改 schema；`40f3d81`）|
| Canvas Tool Dock Grouping（导演/资产/角色分组子导航重构） | ✅ validated |
| Workflow Connection Context Tools + Stronger Edges（连线上下文工具 + 连接线增强） | ✅ validated |
| Camera Lexicon — supports downstream workflow target | ✅ validated |
| Asset Variant Planner — supports downstream workflow target | ✅ validated |
| Character Lock Basic — supports downstream workflow target | ✅ validated |
| Workflow Context Target Binding（source→target 绑定修复） | ✅ validated |
| Workflow Continue Options in Source Menu（引用该节点生成菜单接入继续创作三选项） | ✅ validated |
| A/B Compare / Version Compare Panel | ✅ validated（Asset 分组子工具；`66da5b5`）|
| Keyframe Extractor / 关键帧提取器 | ✅ validated（Asset 分组子工具；`ccb5f42`；build fix `9e9b340`）|
| Shot List Builder / 分镜清单生成器 | ✅ validated（Director 分组子工具；`26f8d16` · `5cfb912` · `97ff477` · layout fix `2cf744a`）|
| Continuity Checker / 连贯性检查器 | ✅ validated（Director 分组子工具；`1e9b737`；6 维规则引擎；overallScore + issue 列表 + 定位节点 + 复制报告）|
| Prompt Booster / 提示词增强器 | ✅ validated（Prompt 分组子工具；`6e1a24f`；image 7维 / video 7维 / text 6维规则引擎；score 0-100；用户点击追加，不自动覆盖；重复检测；可忽略/重新分析/复制报告）|
| Sequence Board / 镜头序列编排器 | ❌ removed / not validated（product review: redundant with Shot List Builder + Continuity Checker + canvas edges as workflow order；`37a43da` 从 UI 撤下）|
| Canvas edges as workflow order（连线即顺序） | ✅ current behavior（画布连线已体现节点顺序，无需独立序列管理）|
| Batch Prompt Rewriter / 批量 Prompt 重写器 | ✅ validated（Prompt 分组子工具；`e3c3a2b` · readability fix `e5bb57a`；text/image/video 节点批量追加；6维度；生成预览；重复检测跳过；用户确认后才 patch；只追加不替换；不自动生成；不消耗 credits）|
| Look Package Applier / 视觉风格包应用器 | ✅ validated（Prompt 分组子工具；10个风格包6分类；image/video节点顶部"视觉风格"快捷入口；调色/光线/质感/氛围4维度中文关键词可选；预览/确认两步应用；主体保护约束；只追加不替换；不自动生成；不消耗 credits；feat `a8d6c10` · fixes `55aebc9` `0610a1e` `75a1771` `27552ca` `2ee0a67`）|
| Color Grade Palette / 调色盘 | ✅ validated（image/video 节点顶部 Post Suite / 剪辑入口；Primary Wheels Lift/Gamma/Gain/Offset + Curves + Qualifier + Texture + Output；CSS filter Preview Monitor；可调大小浮动预览窗；应用调色到画布（复制原资产 + status=done）；prompt-level grading 非像素级；只追加不覆盖；不自动生成；不消耗 credits；不新增 API；不接 WebGL/glfx/FFmpeg/OCIO；commits: `a8753b4` · `46831e3` · `c5cefed` · `7a26d8d` · `d221df6` · `e08a09f` · `65a4152` · `c74e7e9` · `2c4fd15`）|
| Style Bible Extract & Apply / 风格圣经提取与应用 | ❌ not implemented / future（需从成功资产提取项目风格圣经，必须单独评估）|
| Vision-based Color Analysis / 视觉色彩分析 | ❌ not implemented / future（需 vision model 接入，必须单独评估）|
| Reference-preserving Style Transfer / 参考保护式风格迁移 | ❌ not implemented / future（需图生图/参考图/vision provider 能力，不能只靠 prompt 保证）|
| DaVinci Primary Wheels（真实色轮 UI） | ❌ future（Phase 2）|
| DaVinci HDR Zones / Scopes / Qualifier / Power Windows | ❌ future（需 vision model 接入或像素级调色能力）|
| Style Bible Extract & Apply / 风格圣经提取与应用 | ❌ not implemented / future（需从成功资产提取项目风格圣经，必须单独评估）|
| Vision-based Color Analysis / 视觉色彩分析 | ❌ not implemented / future（需 vision model 接入，必须单独评估）|
| Reference-preserving Style Transfer / 参考保护式风格迁移 | ❌ not implemented / future（需图生图/参考图/vision provider 能力，不能只靠 prompt 保证）|
| User Custom Look / 用户自定义 Look | ❌ not implemented / future（Look Package V2 可扩展到 30+ Look，在 MVP 稳定后）|
| Prompt Templates / 提示词模板库 | ❌ not implemented / not planned now（静态模板库，护城河低，暂不做）|
| Batch Prompt Replace | ❌ not implemented / future（替换风险高，MVP 只做 append）|
| Prompt History | ❌ not implemented / future |
| AI Prompt Rewriter | ❌ not implemented / future |
| Timeline editor（时间轴编辑器） | ❌ not implemented / not now |
| Export to JianYing / Premiere / DaVinci | ❌ not implemented / future |
| Real server-side keyframe extraction | ❌ not implemented（future；需服务端 ffmpeg 或截帧 API）|
| AI vision-based continuity analysis | ❌ not implemented / future（当前为规则引擎；视觉模型接入需单独评估）|
| Automatic continuity repair | ❌ not implemented / not now（不自动修改 prompt，不自动创建节点）|
| Video timeline editor | ❌ not implemented / not now |

**下一步商业优先级（2026-06）：** 平台服务费策略只读审计已完成（结论：**当前不启用**）。Tool 11 Look Package Applier 已验收，Tool 12 Color Grade Palette 已浏览器验收通过并 CLOSED。下一步不继续打磨 Tool 12 UI。推荐二选一：**Tool 12.5 — WebGL / LUT Preview 研究或原型**（CSS filter 升级为真实 WebGL LUT 近似预览，需评估 glsl-lut / glfx.js 许可证 + OSS + 队列）；**Tool 13 — FFmpeg worker + LUT3D 媒体处理研究**（真实像素级调色输出，需单独评估部署/许可证/成本）。Tool 12.5 / Tool 13 必须单独评估，不应塞进当前 Tool 12。当前 Tool 12 已 CLOSED / validated。任何高级版若要新增 API/schema/provider capability，必须先单独评估并等待用户确认后再实施。价格/服务费静态说明页面已上线（`/pricing-preview`），AI 帮助已能回答费用相关问题。Service Credits 数据模型只读审计已完成（结论：**推荐 Option B 独立 wallet，9 项 no-go 条件全部未满足，继续观察**）。Admin 模拟服务积分视图已上线并验收（`cee4f9d`）。Admin BYOK 商业指标只读看板已上线并验收（`9e80027`）。BYOK 观察摘要已实现（可复制中文周报）。UsageLog.platformServiceFeeCredits 固定为 0，所有 UI 显示"未启用"。下一步：继续观察 BYOK 用量 30–60 天，无需立即动作；用 `/admin/usage` BYOK 商业指标看板定期审阅 BYOK 调用占比/高频用户/daily trend；判断门槛：BYOK 用量比例 > 30% 且高频用户 ≥ 50 人后再考虑 Phase M1（新表，不写数据）→ Phase M2（懒创建 wallet）→ Phase M5（feature flag 内测）。暂不做 schema migration，暂不启用服务费扣费，暂不启动 Seedance Video BYOK 实施。

---

## Tool 13 — Character Reference / Turnaround / Grid: DEFERRED

**Status:** DEFERRED / REMOVED_FROM_UI

**Reason:**
- Current implementation requires a third-party API or cloud GPU worker to generate multi-view character references at production quality.
- Local ComfyUI POC is suitable for individual use only — not a viable open-platform feature.
- Seedream img2img route is paused and not a formal solution.
- Hosted fal.ai / Replicate Face-ID POC route (`9403f60`) remains dev-only, requires `CHARACTER_FACE_ID_POC_ENABLED=true` env flag, and is not exposed in any UI.

**What was removed from UI:**
- CanvasToolDock: "人物参考 / 四视图" menu item removed from Asset group
- AssetAgentToolbar: "👤 人物参考" button removed from per-node asset menu
- VisualCanvasWorkspace: CharacterReferenceGridPanel render block removed; `isCharacterReferenceOpen` state removed
- CreativeAssetsPanel: "参考资产" and "生成参考包" character sub-tabs removed

**What is preserved (not deleted):**
- `apps/web/src/app/api/generate/character-reference/route.ts` — kept, not called from UI
- `apps/web/src/app/api/skills/character-reference/face-id-poc/route.ts` — dev-only POC, env-gated
- `apps/web/src/components/create/CharacterReferenceGridPanel.tsx` — file kept, not imported by any UI
- `CanvasNodeCard.tsx` badge logic for existing historical char-ref nodes — kept so old nodes still render correctly as image nodes

**Future:**
Revisit when a production-grade third-party API or hosted worker (e.g., commercial InstantID, PhotoMaker, or self-hosted GPU endpoint) is selected and contracted.

---

## Character Skill Worker — Phase 1 POC

**Status:** Face-ID POC route IMPLEMENTED (dev-only) · not connected to Tool 13 UI · not committed

### Architecture Decision: Where Does the Worker Live?

| Option | Verdict |
|---|---|
| **A. apps/web dev-only route** | ✅ **POC Phase 1 — use this now.** Route exists, no new infra, env-gated, zero risk to main chain. |
| **B. apps/server (NestJS)** | ✅ **Long-term target.** Has `ioredis`, Prisma, asset/canvas modules. Add BullMQ queue here for Phase 3 production worker. |
| **C. apps/cn-executor extension** | ❌ Forbidden. China-region executor only. Do not extend. |
| **D. Fully external worker** | ⬜ Only if self-hosted GPU needed (Phase 4+). |

### Provider Comparison

| Provider | Face Lock | Full Body | Pose Control | 4-View | Hosted API | Cost | Speed | China Risk | Commercial | POC? |
|---|---|---|---|---|---|---|---|---|---|---|
| **fal.ai InstantID** | ✅ | ✅ | partial | buildable | ✅ | ~$0.05/img | ~15s | ⚠️ blocked | check license | ✅ **RECOMMENDED** |
| **Replicate InstantID** | ✅ | ✅ | partial | buildable | ✅ | ~$0.05/img | ~25s + polling | ⚠️ blocked | check license | ✅ fallback |
| **Replicate PuLID** | ✅ better ID | ✅ | partial | buildable | ✅ | ~$0.05/img | ~30s | ⚠️ blocked | check license | ⬜ Phase 1.5 |
| **PhotoMaker hosted** | ✅ | partial | ❌ | difficult | ✅ Replicate | ~$0.05/img | ~30s | ⚠️ blocked | check license | ⬜ |
| **HuggingFace Endpoint** | varies | varies | varies | varies | ✅ | $0.06+/hr cold | slow cold | ⚠️ blocked | model-dependent | ❌ too slow |
| **ComfyUI self-hosted** | ✅ full | ✅ full | ✅ full | ✅ best | requires GPU server | GPU cost | 30-60s | ✅ if self-hosted CN | full control | Phase 3+ |
| **Flux + IP-Adapter + ControlNet self-hosted** | ✅ best | ✅ best | ✅ best | ✅ best | requires GPU server | GPU cost | 30-60s | ✅ if CN GPU | full control | Phase 4+ |

**POC choice: fal.ai InstantID (primary) → Replicate InstantID (fallback)**

### Phase 1 POC — Implemented

**Route:** `POST /api/skills/character-reference/face-id-poc`
**File:** `apps/web/src/app/api/skills/character-reference/face-id-poc/route.ts`

**Required env to activate:**
```
CHARACTER_FACE_ID_POC_ENABLED=true
FACE_ID_PROVIDER=fal           # or: replicate / auto
FAL_KEY=your_fal_key           # primary
REPLICATE_API_TOKEN=your_key   # fallback
```

**Without env keys → returns:**
```json
{ "success": false, "errorCode": "FACE_ID_PROVIDER_NOT_CONFIGURED",
  "message": "No Face-ID provider API key is configured.",
  "requiredEnv": ["CHARACTER_FACE_ID_POC_ENABLED", "FAL_KEY or REPLICATE_API_TOKEN"] }
```

**With env keys → calls fal.ai InstantID:**
```
POST https://fal.run/fal-ai/instantid
{ face_image_url, prompt, guidance_scale: 5, ip_adapter_scale: 0.8 }
→ { success: true, provider: "fal", imageUrl, prompt }
```

**POC constraints (all enforced in route):**
- ❌ No OSS upload
- ❌ No canvas node creation
- ❌ No credits deducted
- ❌ Not connected to Tool 13 UI
- ❌ API key never logged
- ✅ Auth required (getCurrentUser)
- ✅ Env flag gate
- ✅ URL validation (rejects blob/data/localhost/internal proxy)

### Phase 2 → Phase 3 Roadmap

| Phase | Goal | Blocking on |
|---|---|---|
| **Phase 1** | Single-image Face-ID POC | `FAL_KEY` — need key to test |
| **Phase 2** | Four-view (front/3q/side/back) with ControlNet | fal.ai ControlNet endpoint or Replicate pose-control |
| **Phase 3** | Full Character Skill Worker | BullMQ in apps/server + OSS + asset create + canvas node callback |
| **Phase 4** | Production Tool 13 | Billing integration + self-hosted GPU if needed for CN access |

### Why Vercel Serverless Can't Run 4-View Sync

- 4 images × ~15s each = 60s minimum
- Vercel Pro `maxDuration = 90` — cuts it close and any cold start or provider slowness causes timeout
- No retry / resume possible in a single HTTP request
- Solution: async job queue (BullMQ in apps/server) with polling endpoint

### Long-Term Worker API (Design — not implemented)

```
POST /api/skills/character-reference/jobs
{ sourceAssetId, sourceImageUrl, mode: "turnaround4"|"grid9",
  identityLock: true, outfitLock: true }
→ { jobId, status: "queued" }

GET /api/skills/character-reference/jobs/:jobId
→ { status, outputs: [{ slotKey, assetId, imageUrl, nodeId }] }
```

Worker flow:
sourceAsset → matting/crop → face identity extraction → pose slot generation (parallel) → OSS upload × N → asset.create × N → canvas node done × N

---

## Current Remaining Issues

**无 P0 / P1 问题。当前系统处于稳定状态。**

P2（非紧急）：`NEXT_PUBLIC_API_URL` / billing webhook / legacy NestJS localhost:4000 需单独排期。

---

## User Provider Accounts V1 多字段凭证 — CLOSED / production validated

**Commits:** `14a763d` (feat) · `da0ab3b` (docs)
**Production migration:** `20260602000000_user_provider_account_multi_field` — 已在 Supabase production 执行

### 新增字段（`UserProviderAccount`）
| 字段 | 类型 | 说明 |
|---|---|---|
| `credentialType` | `TEXT` nullable | `"single_api_key"` / `"bearer_with_endpoint"` |
| `encryptedFields` | `JSONB` nullable | 额外加密字段，每字段独立 AES-256-GCM IV。**绝不返回给前端** |
| `fieldMeta` | `JSONB` nullable | 展示用元数据 `{ fieldName: { label, last4, updatedAt } }`，可安全返回 |

### 验证项目
| 验证项 | 结果 |
|---|---|
| `ACCOUNT_SELECT` 不含 `encryptedFields` | ✅ 确认 |
| API 路由响应不返回 `encryptedFields` | ✅ 确认 |
| `encryptedFields` 仅在 `buildEncryptedFieldsAndMeta` 内存中存在，写入 DB 后不再暴露 | ✅ 确认 |
| migration SQL 使用 `IF NOT EXISTS`，幂等安全 | ✅ 确认 |
| Volcengine Seedream / Seedance 凭证表单含 Endpoint ID 输入 | ✅ 确认 |
| Image / Video BYOK 标记为 `coming_soon`，无生成入口 | ✅ 确认 |
| `/api/generate/image` 和 `/api/generate/video` 未被 V1 修改 | ✅ 确认（git diff 干净） |
| cn-executor 未被 V1 修改 | ✅ 确认 |
| Text BYOK 生成链路未受影响 | ✅ 确认（`ACCOUNT_SELECT` 仅加字段，未删字段） |
| crypto 单元测试 28/28 pass | ✅ 确认 |
| TypeScript type-check 零错误 | ✅ 确认 |
| `next build` 成功 | ✅ 确认 |

### 当前能力（production）
- Text BYOK：已上线并验收（Phase 4，commit `ea2ccc6`）
- 多字段凭证存储结构：V1 已上线（commit `14a763d`）
- Volcengine / Seedream 凭证表单支持 API Key + Endpoint ID
- 保存后只展示 `last4` / `fieldMeta`，不暴露明文或密文
- Image / Video BYOK：**尚未实现**（UI 标注 coming soon，生成链路完全未接入）

---

## User Provider Accounts V2 — Seedream Image BYOK

**Commit:** `c6ff87f`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-03
**Date validated:** 2026-06-03

### 能力矩阵（当前 production 状态）

| 能力 | 状态 |
|---|---|
| Text BYOK（DeepSeek / OpenAI / Kimi） | ✅ validated |
| 多字段凭证存储结构（encryptedFields / fieldMeta） | ✅ production validated |
| Seedream Image BYOK | ✅ validated |
| UsageLog Phase S1（用量记录，Text + Image） | ✅ production validated |
| Admin BYOK Usage Dashboard（/admin/usage） | ✅ validated |
| Seedance Video BYOK | ❌ not implemented |
| Platform service fee charging | ❌ not implemented |

### 验收结果（2026-06-03 浏览器验收通过）

| 验收项 | 结果 |
|---|---|
| Image 节点出现"生成费用来源"区域，默认平台额度 | ✅ |
| 平台额度 Image 生成路径保持不变 | ✅ |
| 我的 API 账户只显示 volcengine-seedream-image active account | ✅ |
| 缺少 Endpoint ID 时显示提示并禁用生成按钮 | ✅ |
| 有效 Volcengine Ark API Key + Endpoint ID 可生成 Seedream 图片 | ✅ |
| BYOK Image 不扣平台模型 credits | ✅ |
| 生成图片刷新后仍保留（cn-executor 直写 DB） | ✅ |
| Video 节点无"生成费用来源"（Video 未接入 BYOK） | ✅ |
| Text BYOK 无回归 | ✅ |
| cn-executor 视频链路未动 | ✅ |

### 已知非阻塞现象

- 生成后偶发 `/api/projects/<id>/canvas` 返回 503（Chrome DevTools 显示 `/api/projects:1`）
- **根因**：DB pool / canvas auto-save 偶发过载，与 V2 BYOK 代码无关
- **不影响**：图片数据由 cn-executor 直写 DB + localStorage draft 双重保留，页面刷新后图片仍在
- **处理建议**：若 503 密集反复出现，应作为独立 DB pool / canvas save 稳定性任务处理，不属于 BYOK 问题

### 实现摘要

- Image 节点编辑面板新增"生成费用来源"选择（平台额度 / 我的 API 账户）
- 选择"我的 API 账户"后，只列出 `providerId === 'volcengine-seedream-image'` 的活跃账户
- BYOK 路径：Vercel 路由从 DB 读取并解密用户 API Key + Endpoint ID，通过 HTTPS 触发体传入 cn-executor；cn-executor 用用户自己的 Volcengine Ark API Key + Endpoint ID 调用 Seedream
- BYOK Image 不调用平台 credits reserve / finalize / refund
- 生成结果仍保存到平台 Asset / OSS / CanvasNode（与平台额度路径一致）
- 平台额度 Image 生成路径完全不变
- Video / Seedance 未接入 BYOK
- Text BYOK 未受影响

### 修改文件（共 6 个）

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/app/api/generate/image/route.ts` | BYOK 早返回分支（+190 行） |
| `apps/web/src/lib/provider-accounts/service.ts` | `getProviderAccountForByok`（解密 + 验权，+77 行） |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | Image 节点 BYOK UI（+78/-25 行） |
| `apps/cn-executor/src/volcengine.ts` | `SeedreamInput` 加 overrides（+17 行） |
| `apps/cn-executor/src/handlers/generateImage.ts` | `ImageExecutionInput` 加 overrides（+4 行） |
| `apps/cn-executor/src/handlers/jobRunner.ts` | 解析 `userCredential`，传入执行链（+24/-3 行） |

### 安全边界确认

| 安全项 | 状态 |
|---|---|
| `generationJob.input` 不保存明文 API Key | ✅ 只存 `billingMode: 'user_provider_account'` + `userProviderAccountId` |
| Vercel logs 不记录明文 Key | ✅ `route.ts` 不 log `userCredential` |
| cn-executor logs 不记录明文 Key | ✅ 只 log `hasByokCredential: boolean` |
| 前端不返回 `encryptedApiKey` / `encryptedFields` | ✅ `getProviderAccountForByok` select 不含密文 |
| cn-executor `submittedInput` 不含 Key 值 | ✅ 只含 `modelSource: 'user_provider_account'` |
| Video / Seedance 未接入 | ✅ 生成路由未动 |
| Text BYOK 不受影响 | ✅ 仅扩展 Image UI 条件，Text 路径不变 |
| 用户只能使用自己的账户 | ✅ `where: { id: accountId, userId }` 强制所有权 |
| Provider 白名单校验 | ✅ `SEEDREAM_BYOK_PROVIDER_IDS = ['volcengine-seedream-image']` |

### 浏览器验收重点

| # | 步骤 | 预期结果 |
|---|---|---|
| 1 | 打开 Image 节点编辑面板 | 出现"生成费用来源"区域，默认选中"平台额度" |
| 2 | 平台额度模式点击生成 | 正常生成，画布显示图片，无任何变化 |
| 3 | 切换到"我的 API 账户" | 只显示 `volcengine-seedream-image` 类型的活跃账户 |
| 4 | 选中缺少 Endpoint ID 的账户 | 显示 amber 警告，生成按钮 disabled |
| 5 | 选中有效 Ark API Key + Endpoint ID 的账户 | 警告消失，生成按钮可用 |
| 6 | 点击生成 | 成功生成 Seedream 图片，画布节点显示图片 |
| 7 | 生成后检查平台模型 credits | 无扣减（BYOK 完全绕过平台 billing） |
| 8 | 打开 Video 节点编辑面板 | 无"生成费用来源"区域（Video 未接入） |
| 9 | 测试 Text BYOK | 行为与之前一致，无回归 |
| 10 | 使用非 volcengine-seedream-image 账户 | 不可选（前端过滤 + 后端 whitelist 校验） |

### 下一步建议（基于 UsageLog Phase S1 生产验证后）

- **已完成**：UsageLog Phase S1 已生产验证（commit `d693f71`），Text + Image BYOK 用量可记录
- **禁止**：不经评审直接开发 Seedance Video BYOK
- ✅ **已验收**：Phase S3 — admin BYOK usage dashboard (`/admin/usage`，commit `fbf7734`，validated 2026-06-03)
- 可选 A：Phase S2 — 用户端 usage history（`/account/providers` 展示每账户调用次数）
- 可选 B：Seedance Video BYOK 安全审计（评审 cn-executor credential access 方案后再实现）
- 可选 C：Provider Account Center 产品化升级（UI 打磨 / 多账户管理 / 测试连接结果展示）
- **暂不建议**：立刻启用平台服务费扣费（先观察 30–60 天真实用量后再决定服务费策略）

---

## Admin BYOK Usage Dashboard — IMPLEMENTED / browser validation pending

**Commit:** `fbf7734`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-03
**Date validated:** 2026-06-03

### 新增文件（共 3 个）

| 文件 | 说明 |
|---|---|
| `apps/web/src/app/admin/usage/page.tsx` | admin 用量看板页面（client component） |
| `apps/web/src/app/api/admin/usage/route.ts` | 只读 usage API route |
| `apps/web/src/app/admin/page.tsx` | 新增"生成用量观察"入口卡片 |

### 功能说明

| 功能 | 状态 |
|---|---|
| 时间范围切换（近 24h / 7d / 30d） | ✅ |
| Summary cards：总调用数、BYOK 调用、平台额度调用、成功率、失败数、服务费总计 | ✅ |
| 生成类型分布（text / image / video）+ 简单 bar | ✅ |
| 计费模式分布（BYOK vs 平台额度）+ 简单 bar | ✅ |
| 状态分布（成功 / 失败）+ 简单 bar | ✅ |
| Provider 分布（前 20）+ 简单 bar | ✅ |
| Top 10 用户（email + displayName + 调用次数） | ✅ |
| 最近 50 条 UsageLog 记录（不含 prompt 明文，仅展示 promptChars） | ✅ |
| 明确标注：当前仅统计用量，不启用平台服务费扣费 | ✅ |
| 明确区分：platform_credits = 平台代付；user_provider_account = 用户自带 API Key | ✅ |
| 显示当前 platformServiceFeeCredits 总和（预期为 0） | ✅ |

### API 说明

`GET /api/admin/usage`

**Query 参数：**
- `range=24h|7d|30d`（默认 7d）
- `outputType=all|text|image|video`（默认 all）
- `billingMode=all|platform_credits|user_provider_account`（默认 all）

**返回字段：** summary / byOutputType / byProvider / byBillingMode / byStatus / topUsers / recent

### 安全边界确认

| 安全项 | 状态 |
|---|---|
| 仅 `user.role === 'ADMIN'` 可访问 | ✅ API route + page 双重保护 |
| 不显示 prompt 明文（UsageLog 本身不含 prompt 字段） | ✅ |
| 不显示 API Key / encryptedApiKey / encryptedFields | ✅ |
| topUsers 只显示 email / displayName，无凭证字段 | ✅ |
| recent 列表只 select 安全字段，无敏感凭证 | ✅ |
| 不启用收费，无 credits reserve/settle/release 调用 | ✅ |
| 不修改 text/image/video 生成链路 | ✅ |
| 不修改 credits / billing 核心语义 | ✅ |
| 不修改 cn-executor | ✅ |
| type-check / lint / build 全部通过 | ✅ |

### 浏览器验收重点

| # | 步骤 | 预期结果 |
|---|---|---|
| 1 | 管理员访问 `/admin/usage` | 正常显示 dashboard，有 summary cards 和数据表格 |
| 2 | 普通用户（非 ADMIN）访问 `/admin/usage` | 显示"无权限"错误，不能看到数据 |
| 3 | 未登录访问 `/api/admin/usage` | 返回 401 |
| 4 | 切换 24h / 7d / 30d 范围 | 数据刷新，总调用数变化 |
| 5 | 查看最近记录表 | 无 prompt 明文列，有 promptChars（字符数）列 |
| 6 | 查看最近记录表 | 无 API Key / encryptedFields 列 |
| 7 | 查看服务费 summary card | 显示 0（当前 platformServiceFeeCredits 固定为 0） |
| 8 | 页面底部说明 | 显示"当前仅统计用量，不启用平台服务费扣费" |
| 9 | 生成一条 Text BYOK 记录后刷新 dashboard | 总调用数 +1，BYOK 调用 +1 |
| 10 | 生成一条 Image（平台额度）记录后刷新 dashboard | 总调用数 +1，平台额度 +1 |

### 浏览器验收结果（2026-06-03 通过）

| 验收项 | 结果 |
|---|---|
| 管理员访问 `/admin/usage` 可见 dashboard | ✅ |
| 普通用户访问被拒绝（无权限错误） | ✅ |
| 24h / 7d / 30d 时间范围切换正常 | ✅ |
| Summary cards：总调用数、BYOK 调用、平台额度调用、成功率、失败数、服务费总计 | ✅ |
| outputType / billingMode / provider / status 分布显示正常 | ✅ |
| Top users 显示 email + displayName + 调用次数 | ✅ |
| 最近 UsageLog 只显示 promptChars，不显示 prompt 明文 | ✅ |
| 不显示 API Key / encryptedApiKey / encryptedFields | ✅ |
| platformServiceFeeCredits 显示为 0，不启用扣费 | ✅ |

### 下一步建议

- ~~可选 B：Provider Account Center 产品化升级~~ ✅ DONE (commit `e96f916`, validated 2026-06-03)
- 可选 A：用户端 usage history（`/account/providers` 展示每账户调用次数）
- 可选 C：Seedance Video BYOK 安全评审（评审 cn-executor credential access 方案后再实现）
- 可选 D：平台服务费策略审计（先观察 30–60 天用量数据后制定）
- **暂不建议**：立刻启用平台服务费扣费

---

## Provider Account Center 产品化升级 — CLOSED / validated

**Commit:** `e96f916`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-03
**Date validated:** 2026-06-03

### 升级内容

| 项目 | 状态 |
|---|---|
| 页面更名：Provider API 账户 → 模型账户中心 | ✅ |
| Hero section：价值主张 + 3 项关键说明（加密存储 / 直接调用 / 不经平台） | ✅ |
| 计费模式卡：2 列 → 3 列（平台额度 / 我的 API / 未来纯平台服务费） | ✅ |
| 能力矩阵（CAPABILITY_MATRIX，display-only，不接表单）：9 个 Provider × 状态 | ✅ |
| 布局扩宽：`max-w-2xl` → `max-w-4xl` | ✅ |
| 阶段提示升级：由 amber（待开放）→ emerald（Seedream 已上线） | ✅ |
| 已连接账户卡片加入类别标签（文本 / 图片 / 视频） | ✅ |
| 修复 `volcengine-seedream-image` byokStatus：`coming_soon` → `live` | ✅ |
| 修复 `testAccount` 条件：从 `byokStatus===coming_soon && bearer` 改为 `bearer_with_endpoint` | ✅ |
| 测试连接提示更新：火山方舟账户提示"请通过画布生成验证"，不触发图片 API | ✅ |
| 表单安全说明升级：5 条详细说明（加密/不持有/删除/吊销指引） | ✅ |
| 前端不显示 API Key / encryptedApiKey / encryptedFields | ✅ |

### 浏览器验收结果（2026-06-03）

| 验收项 | 结果 |
|---|---|
| `/account/providers` 标题更新为"模型账户中心" | ✅ |
| 页面明确说明普通用户无需 API Key，可继续使用平台额度 | ✅ |
| 页面明确说明 API Key 不是网页登录账号密码 | ✅ |
| 页面明确说明用户 API 费用直接支付给 Provider，不经过平台 | ✅ |
| 展示三种模式：平台额度 / 我的 API（BYOK）/ 未来纯平台服务费 | ✅ |
| 能力矩阵展示：Text BYOK ✅、Seedream Image ✅、Seedance Video 🟡、其他 ○ | ✅ |
| Seedream Image 状态显示"已上线" | ✅ |
| Seedance Video 显示"存凭证，生成接入中" | ✅ |
| 已连接账户卡片显示文本 / 图片 / 视频类别标签 | ✅ |
| Seedream 账户点击"测试连接"显示"不支持自动测试"，不触发图片生成 API | ✅ |
| 不显示 API Key / encryptedApiKey / encryptedFields | ✅ |

### 安全边界确认

- 未修改 `/api/generate/*` / billing / credits / payment / schema / cn-executor
- 未新增真实 Provider（capability matrix 仅为展示常量，不接 form select）
- 未修改 Provider Account CRUD API 语义
- 未修改 UsageLog / Admin Dashboard
- 仅修改 `apps/web/src/app/account/providers/page.tsx`

---

## Provider Account Center Auth Blank Screen Fix — CLOSED / validated

**Commit:** `4710e79`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 问题背景

用户从右上角头像菜单点击「Provider API 账户」进入 `/account/providers` 时出现完全白屏（永久空白，无法恢复）。

### 根本原因

`/account/providers` 页面存在两个互相冲突的 auth guard：

1. `effectiveIsAuthenticated`（正确逻辑）：当 Zustand 本地登录态有效时（`isAuthenticated = true`），即使 `/api/auth/me` server check 还在加载中，也应允许显示页面内容。
2. 显式 guard `if (sessionStatus === 'loading' || sessionStatus === 'unknown') return null`：**覆盖了上面的逻辑**，无论 Zustand 状态如何，只要 server auth check 还在进行（最多 5 秒超时），就强制返回 null（白屏）。

**结果**：有效登录用户点击该页面 → `/api/auth/me` 请求超时或网络慢（≥5s）→ `sessionStatus` 变为 `'unknown'` → 页面永久空白，无法自动恢复。

### 修复内容

| 项目 | 状态 |
|---|---|
| 移除覆盖性 guard `if (sessionStatus === 'loading' \|\| 'unknown') return null` | ✅ |
| 改为由 `effectiveIsAuthenticated` 单一控制渲染 | ✅ |
| 有 Zustand 本地有效 session 时，页面立即显示（不再等待 server check） | ✅ |
| server auth check 继续在后台异步进行，session 过期时 useEffect 执行重定向 | ✅ |
| `sessionStatus === 'unknown'` 且无本地 session 时，显示可见 retry 状态（不再永久白屏） | ✅ |
| 从 `useCurrentUser` 获取 `refresh` 函数，retry 按钮可重新发起 auth check | ✅ |
| type-check 通过 | ✅ |

### 浏览器验收结果（2026-06-04 通过）

| 验收项 | 结果 |
|---|---|
| 用户菜单 → 「Provider API 账户」→ `/account/providers` 正常打开，不白屏 | ✅ |
| 有本地 session（localStorage Zustand）时，页面立即渲染，不等待 server auth check | ✅ |
| 慢网络或 `/api/auth/me` pending 期间，已连接账户列表显示"加载中…"而非白屏 | ✅ |
| 已连接账户列表正常显示（空态 or 账户列表） | ✅ |
| API 错误时显示友好错误信息，不崩溃 | ✅ |
| Text 账户「测试连接」功能无回归 | ✅ |
| Seedream 账户「测试连接」仍显示"不支持自动测试" | ✅ |
| `/account/usage` 未受影响 | ✅ |

### 安全边界确认

- 未修改 `/api/generate/*` / billing / credits / payment / schema / cn-executor
- 未修改 Provider Account CRUD API 语义
- 未修改 UsageLog / Admin Dashboard
- 仅修改 `apps/web/src/app/account/providers/page.tsx`（2 行删除，24 行添加）

---

## User Usage History — CLOSED / validated

**Commits:** `dc69df8`（实现）→ `338c2a3`（标签中文化）→ `f928f10`（auth 白屏修复）→ `673dfbc`（用户菜单入口）→ `8119eb0`（线上查询修复）
**Status:** ✅ CLOSED / validated
**Date validated:** 2026-06-04

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/app/account/usage/page.tsx` | 用户端用量历史页面（client component） |
| `apps/web/src/app/api/account/usage/route.ts` | 用户自身用量 API route，userScope 强隔离 |

### 功能说明

| 功能 | 状态 |
|---|---|
| 时间范围切换（近 24h / 7d / 30d / 全部） | ✅ |
| 费用来源筛选（全部 / 平台额度 / 我的 API） | ✅ |
| 生成类型筛选（全部 / 文本 / 图片 / 视频） | ✅ |
| Summary cards：总生成次数 / 我的 API / 平台额度 / 文本·图片 / 成功率 / 平台服务费 | ✅ |
| 分布面板：生成类型 / 计费模式 / Provider 来源 | ✅ |
| 最近生成记录表（桌面 8 列 + 移动卡片视图） | ✅ |
| 不显示 prompt 明文 / API Key / encryptedApiKey / encryptedFields | ✅ |
| 全部标签中文化（底层 API 枚举值不变） | ✅ |
| `/account` 快速入口加入"生成用量"入口卡 | ✅ |

### 安全边界

- `GET /api/account/usage`：每条查询都注入 `userScope = { userId: user.id }`，用户只能看自己的数据
- `select` 白名单：不含 prompt 字段（UsageLog 本身无此字段）、不含凭证字段
- 独立于 `GET /api/admin/usage`（admin 专用，不共享代码或权限）

### 浏览器验收结果（2026-06-04）

| 验收项 | 结果 |
|---|---|
| 用户头像菜单新增「生成用量」入口 → `/account/usage` | ✅ |
| `/account` 页面保留「生成用量」卡片入口 | ✅ |
| `/account/usage` 页面可正常打开 | ✅ |
| 页面不白屏 | ✅ |
| 页面不显示数据库查询错误 | ✅ |
| 中文筛选：近 24 小时 / 近 7 天 / 近 30 天 / 全部 | ✅ |
| 中文筛选：全部来源 / 平台额度 / 我的 API | ✅ |
| 中文筛选：全部类型 / 文本 / 图片 / 视频 | ✅ |
| 最近记录展示 Prompt 字符数，不展示 prompt 明文 | ✅ |
| 不展示 API Key / encryptedApiKey / encryptedFields | ✅ |
| 只展示当前用户自己的 UsageLog（userId 强隔离） | ✅ |
| 平台服务费显示为当前未启用 / 0 | ✅ |
| 未登录访问 → 401 / 跳转登录 | ✅ |
| `/account/providers` 无回归 | ✅ |
| `/admin/usage` 无回归 | ✅ |

---

## Seedance Video BYOK Security Review — CLOSED / read-only audit completed

**审计日期：** 2026-06-04
**审计性质：** 只读 — 零文件修改，零 commit，零 push

### 当前状态（已确认）

| 项目 | 状态 |
|---|---|
| Seedance Video BYOK | ❌ 未实现 |
| 当前 Seedance Video 使用 | 平台 `VOLCENGINE_ARK_API_KEY`（cn-executor env var） |
| 视频生成实际执行点 | cn-executor（Aliyun FC 异步函数） |
| Vercel video route 是否扣平台 credits | ❌ 不扣（早返回于 setupBilling/finalizeBilling 之前） |
| cn-executor videoJobRunner 是否有 UsageLog 写入 | ❌ 无（视频生成全链路暂无 UsageLog） |
| cn-executor videoJobRunner 是否接受 userCredential | ❌ 不接受（当前只读取 generationJob.input） |
| generationJob.input 是否包含 API Key | ✅ 不包含（只存 prompt / model / duration / aspectRatio / providerId） |

### 推荐方案（Option A — 镜像现有 Image BYOK 路径）

**不推荐的方案：**
- ❌ 将 `PROVIDER_KEY_ENCRYPTION_SECRET` 放入 cn-executor — 扩大密钥攻击面
- ❌ 让 cn-executor 直连 `UserProviderAccount` 表并解密 — 同上，且破坏服务层边界
- ❌ 将 encrypted credential 写入 `generationJob.input` — 若 DB 和 secret 同时泄漏则 key 外泄
- ❌ 现在启用平台服务费扣费 — 时机未到，用量数据不足

**推荐方案 Option A（与 Image BYOK 完全一致）：**

```
Browser → POST /api/generate/video { providerAccountId?, billingMode?, ... }

Vercel video route（新增）：
  if billingMode === 'user_provider_account':
    cred = getProviderAccountForByok(userId, providerAccountId, ['volcengine-seedance-video'])
    if !cred.ok → 400 早返回
    triggerBody.userCredential = { apiKey: cred.apiKey }  // 明文只存在 HTTPS 传输中
  POST cn-executor /api/jobs/run-video { generationJobId, userCredential? }

cn-executor videoJobRunner（新增）：
  const { userCredential } = triggerBody
  console.log({ hasByokCredential: Boolean(userCredential) })  // 只记录 boolean
  submitSeedanceTask({ ..., apiKeyOverride: userCredential?.apiKey })  // 不 log key 值
  pollSeedanceTaskUntilDone(taskId, { apiKeyOverride: userCredential?.apiKey })
  // key 用完即丢，不写 DB，不写 generationJob.input，不返回前端

cn-executor seedance.ts（新增）：
  SeedanceSubmitInput.apiKeyOverride?: string
  const apiKey = input.apiKeyOverride?.trim() || process.env.VOLCENGINE_ARK_API_KEY?.trim()
```

### 硬性 no-go（实施时全部必须满足）

| no-go 条件 | 说明 |
|---|---|
| key 不得写入 `generationJob.input` | JSON 列，任何有 DB 访问权限的人都能读取 |
| key 不得写入 cn-executor 日志 | 只允许 `hasByokCredential: boolean` |
| key 不得返回前端 | 任何 API 响应都不得含明文 key |
| 未验证 `userId` 不得使用 `providerAccountId` | `getProviderAccountForByok` 强制 `{ id, userId }` 所有权校验 |
| BYOK Video 不得扣平台模型 credits | Video route 已在 setupBilling 前早返回，保持不变 |
| `auth_failed` 不得透传 provider 原始敏感响应给用户 | 错误信息脱敏后再返回 |
| 没有 feature flag skeleton 和日志脱敏基础不得上线 | 必须先完成 safe logging 基础 |

### 实施时涉及文件（V1 最小改动）

| 文件 | 改动说明 |
|---|---|
| `apps/cn-executor/src/seedance.ts` | 新增 `apiKeyOverride?: string` 到 `SeedanceSubmitInput`；submit + poll 函数用 override 优先 |
| `apps/cn-executor/src/handlers/videoJobRunner.ts` | 接受 `userCredential?: { apiKey: string }` from trigger body；仅 log `hasByokCredential`；forward 到 seedance 函数 |
| `apps/web/src/app/api/generate/video/route.ts` | 接受 `providerAccountId`；调用 `getProviderAccountForByok`；添加到 trigger body |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | 视频节点添加"生成费用来源"选择器 UI（镜像 Image 节点条件） |

**不需要改动的文件（已可复用）：**
- `apps/web/src/lib/provider-accounts/service.ts` — `getProviderAccountForByok` 已支持任意 `allowedProviderIds`
- `apps/web/src/lib/provider-accounts/crypto.ts` — 加密层稳定
- Prisma schema — 仅 API Key 即可，无需 endpointId（Seedance 不用 endpoint ID，model 由平台 env 控制）

### UsageLog 计划（实施时一并补充）

当前 Seedance video **无任何 UsageLog 写入**，BYOK 实施时应同步补充：

```typescript
// Vercel video route，GenerationJob 创建后写入
await db.usageLog.create({
  data: {
    userId, projectId, nodeId,
    providerId: 'volcengine-seedance-video',
    outputType: 'video',
    billingMode: isByok ? 'user_provider_account' : 'platform_credits',
    status: 'pending',
    providerCostPaidBy: isByok ? 'user' : 'platform',
    promptChars: prompt.length,
    platformServiceFeeCredits: 0,
  },
})
```

### 当前不实施的理由

- Video BYOK 对现有用户无阻塞（平台 key 已可正常生成视频）
- cn-executor 改动须单独测试，风险高于收益
- 应先做 cn-executor safe logging 和 request redaction 基础，再接 BYOK
- 30–60 天观察用量数据后，再决定是否值得为 power user 做此优化

---

## Provider Account Detail / Health Status — CLOSED / validated

**Commit:** `60aaa95`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/app/api/provider-accounts/[id]/summary/route.ts` | 只读 summary API，返回账户信息 + 90 天用量 + 近 20 条记录 + 健康状态 |
| `apps/web/src/app/account/providers/[id]/page.tsx` | 账户详情页（7 个 section） |

### 功能说明

| 功能 | 状态 |
|---|---|
| `GET /api/provider-accounts/[id]/summary` — 双重 scope：userId + providerAccountId | ✅ |
| 账户身份 section：名称、状态、Provider、日期、范围、凭证类型 | ✅ |
| 健康状态 section：基于 lastTestStatus + 90 天失败率计算 | ✅ |
| 凭证安全 section：仅显示 API Key 末 4 位 + Endpoint ID 末 4 位（fieldMeta） | ✅ |
| 近 90 天用量汇总（总调用 / 成功 / 失败 / 文本 / 图片 / 视频 / 服务费） | ✅ |
| 最近 20 条调用记录（时间 / 类型 / 计费模式 / 状态 / errorCode） | ✅ |
| 操作 section：测试 / 启用 / 停用 / 设为默认 / 删除（复用现有端点） | ✅ |
| 安全说明 section | ✅ |
| 面包屑：账号设置 / 模型账户中心 / 账户名 | ✅ |
| 不返回 encryptedApiKey / encryptedFields / prompt 明文 | ✅ |
| UsageLog 查询强制 where: { userId, providerAccountId } 双条件 | ✅ |
| UsageLog 失败降级：账户信息正常返回，用量显示"暂时不可用" | ✅ |
| /account/providers 每个账户卡片新增「查看详情」按钮 | ✅ |

### 浏览器验收结果（2026-06-04 通过）

| # | 步骤 | 结果 |
|---|---|---|
| 1 | `/account/providers` 每个账户卡片有「查看详情」按钮 | ✅ |
| 2 | 点击「查看详情」→ 进入 `/account/providers/[id]`，面包屑正确 | ✅ |
| 3 | 详情页显示账户名称、Provider、状态、默认标识 | ✅ |
| 4 | 凭证 section 只显示 API Key 末 4 位，不显示完整 Key | ✅ |
| 5 | Seedream 等账户显示 Endpoint ID 末 4 位（如适用） | ✅ |
| 6 | 健康状态 section 显示绿 / 橙 / 红 / 灰色徽章及原因文本 | ✅ |
| 7 | 近 90 天用量汇总正确，无记录显示空态 | ✅ |
| 8 | 最近 20 条调用记录表显示时间 / 类型 / 状态，无 prompt 明文 | ✅ |
| 9 | 不显示 encryptedApiKey / encryptedFields / prompt 明文 | ✅ |
| 10 | 只能查看当前用户自己的账户 | ✅ |
| 11 | `/account/providers` 列表无回归 | ✅ |
| 12 | `/account/usage` 无回归 | ✅ |
| 13 | `/admin/usage` 无回归 | ✅ |
| 14 | 没有改生成链路 / Provider CRUD / billing / schema | ✅ |

---

## Subpage Navigation Polish — CLOSED / validated

**Commit:** `5cb46a8`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 本次变更

| 项目 | 状态 |
|---|---|
| CurrentContextBar：删除 workspace 上下文无效 quick actions（Open Project / Notifications / My Work） | ✅ |
| 项目上下文真实 quick actions（Producer Dashboard / Team / Delivery / Review 等）未删除 | ✅ |
| `/account/credits`：新增「← 账号设置」返回按钮 | ✅ |
| `/help`（DiagnosticsCenter）：新增「← 返回首页」和「API Key 接入指南」入口 | ✅ |
| `/admin/usage`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/users`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/health`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/billing`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/china`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/credits`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/providers`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/payments/china`：新增「← 管理员面板」返回按钮 | ✅ |
| `/admin/storage/china`：新增「← 管理员面板」返回按钮 | ✅ |
| 已有返回入口的页面未重复堆叠（`/account`、`/account/usage`、`/account/providers`、`/account/providers/[id]`、`/help/api-keys`） | ✅ |

### 审计结论

| 页面 | 判断 | 结果 |
|---|---|---|
| `/account` | 已有「← 返回工作台」 | 未改 |
| `/account/usage` | 已有「← 账号设置」 | 未改 |
| `/account/credits` | 无返回入口 → 新增 | ✅ |
| `/account/providers` | 已有「← 账号设置」 | 未改 |
| `/account/providers/[id]` | 已有 3 段面包屑 | 未改 |
| `/help/api-keys` | 上次已修复 3 个按钮 | 未改 |
| `/help` | 无返回入口 → 新增 | ✅ |
| `/admin/*`（9 个子页面） | 均无返回入口 → 全部新增 | ✅ |
| 顶级页面（`/create` / `/community` 等） | TopNav 已足够，不堆按钮 | 判断不需要 |

### 浏览器验收结果（2026-06-04）

| 验收项 | 结果 |
|---|---|
| Workspace / Dashboard 顶部 Open Project / Notifications / My Work 已删除 | ✅ |
| 项目上下文 quick actions 未受影响 | ✅ |
| `/account/credits` 右上角「← 账号设置」可见且可点击 | ✅ |
| `/help` 顶部「← 返回首页」和「API Key 接入指南」可见 | ✅ |
| 所有 `/admin/*` 子页面顶部「← 管理员面板」可见且可点击 | ✅ |
| `/help/api-keys` 原 3 个返回按钮保留，无回归 | ✅ |
| `/account/providers`、`/account/providers/[id]`、`/account/usage` 无回归 | ✅ |
| 没有改生成链路 / BYOK / UsageLog / Provider CRUD / billing / schema | ✅ |
| type-check / lint 通过 | ✅ |

---

## Provider Account Center UX Polish Batch — CLOSED / validated

**Commit:** `0f4eee8`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 修复内容

| 修复项 | 说明 |
|---|---|
| `billingModeLabel` 映射修复 | `user_provider_account` → 我的 API；`platform_credits` → 平台额度（原代码检查 byok/platform，DB 值不匹配，所有行显示 —） |
| 调用记录状态中文化 | `pending` / `queued` / `running` → 处理中；`canceled` → 已取消（原显示英文枚举值） |
| 凭证类型文案中文化 | `API Key + Endpoint` → `API Key + 接入点 ID` |
| 接入点 ID 预览中文化 | 账户卡片中 `Endpoint: •••• xxxx` → `接入点 ID：•••• xxxx` |
| 支付状态中文化 | `/account/credits` 支付宝/微信状态从 `available / 可用` / `checking...` / `not-configured` 改为 `已配置 / 可用` / `检测中…` / `未配置` |
| 顶部"我的 API"菜单补齐 | 新增 API Key 接入指南 → `/help/api-keys`，生成用量 → `/account/usage` |
| 头像菜单文案统一 | `Provider API 账户` → `我的 API 账户` |
| `/account` 增加 API Key 指南入口 | 快捷入口下方增加浅蓝色文字链接 |
| `/account/providers` 空状态改善 | 新增"📖 查看 API Key 接入指南"按钮 |
| `/account/usage` 错误状态改善 | 新增"刷新重试"按钮和"← 账号设置"返回链接 |
| Volcengine 账户验证引导 | `/account/providers/[id]` 中 `bearer_with_endpoint` 账户操作区显示"如何验证此账户"蓝色提示框，引导用户通过画布图片节点实际验证 |

### 安全边界确认

- 未改生成链路 / billing / schema / cn-executor ✅
- 未新增 API 路由 ✅
- 未展示 API Key / encryptedApiKey / encryptedFields / prompt 明文 ✅
- type-check / lint / build 全部通过 ✅

---

## Account / Billing / BYOK Messaging — CLOSED / validated

**Commit:** `4347465`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/app/account/page.tsx` | 快捷入口下方新增三种费用模式一行说明（平台额度 / 我的 API / 平台服务费） |
| `apps/web/src/app/account/credits/page.tsx` | WalletBalanceCard 上方新增费用说明框（3 行，分别解释三种模式） |

### 验收结果（2026-06-04 静态核查通过）

| 验收项 | 结果 |
|---|---|
| `/account` 快捷入口下方出现三种费用模式说明 | ✅ |
| 平台额度：「购买积分，Creator City 代付 API 调用」 | ✅ |
| 我的 API：「自带 Provider Key，API 费用直付给服务商，不扣平台积分」 | ✅ |
| 平台服务费：「当前未启用（0）」 | ✅ |
| `/account/credits` WalletBalanceCard 上方出现费用说明框 | ✅ |
| 明确本页是平台额度余额与流水（Creator City 代付 AI 模型 API 调用） | ✅ |
| 明确「我的 API 账户」时 API 费用由用户直接支付给服务商，不经过平台积分 | ✅ |
| 明确平台服务费当前未启用，显示为 0 | ✅ |
| 防止用户误以为充值这里会充值到 Provider 账户 | ✅ |
| 防止用户误以为 Provider API 费用由 Creator City 代收 | ✅ |
| `/account/providers` 无回归 | ✅ |
| `/account/providers/[id]` 无回归 | ✅ |
| `/account/usage` 无回归 | ✅ |
| `/help/api-keys` 无回归 | ✅ |
| 不显示 API Key / encryptedApiKey / encryptedFields / prompt 明文 | ✅ |
| 未改生成链路 / billing / credits / Provider CRUD / UsageLog / cn-executor / schema | ✅ |

### 安全边界确认

- 仅修改 JSX 展示文案（2 个文件，各加一小块 info div）
- 未触碰任何业务逻辑、API 路由、schema、billing / credits 语义
- type-check 全部通过

---

## Provider Account Health Guidance — CLOSED / validated

**Commit:** `4bac934`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 修改文件（共 3 个，仅 UI）

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/app/account/providers/[id]/page.tsx` | 新增 `getHealthExplanation` + `RepairTip` 类型 + `getRepairTips` 函数；健康卡片下增加中文扩展说明；插入「建议操作」修复建议 section |
| `apps/web/src/app/account/providers/page.tsx` | 新增 `getAccountHint` 函数；异常账户卡片显示轻量健康 chip |
| `apps/web/src/app/help/api-keys/page.tsx` | FAQ section 重命名为「出错了怎么办？」；新增 3 条 FAQ |

### 功能说明

| 功能 | 状态 |
|---|---|
| `/account/providers/[id]` 健康卡片下显示扩展中文解释（healthy / disabled / auth_failed / quota / timeout / unsupported / warning / unknown 各一句） | ✅ |
| `/account/providers/[id]` 健康卡片与凭证之间插入「建议操作」section（最多 3 条，severity 颜色区分） | ✅ |
| auth_failed / unauthorized / invalid_api_key / provider_auth_failed → 提示重新生成 API Key，链接接入指南 | ✅ |
| insufficient_quota / rate_limited → 提示检查 Provider 账户余额和 API billing | ✅ |
| bearer_with_endpoint 缺失 endpointId → 提示补充接入点 ID，链接接入指南 | ✅ |
| timeout → 提示稍后重试或切换平台额度 | ✅ |
| unsupported（Seedream 不支持自动测试）→ 提示在画布图片节点切换「我的 API 账户」实际验证 | ✅ |
| 最近失败记录 errorCode 正则匹配（auth / quota / endpoint 三类），补充对应 tip | ✅ |
| 未测试 + 无用量账户 → info tip 引导测试连接或实际生成 | ✅ |
| 用量数据不可用 → "用量数据暂时不可用，请稍后重试" | ✅ |
| `/account/providers` 异常账户卡片显示轻量 chip（4 种异常，正常账户不显示） | ✅ |
| chip 使用现有 `usageSummaries` 数据，不发新 API 请求 | ✅ |
| `/help/api-keys` FAQ section 重命名「出错了怎么办？」 | ✅ |
| `/help/api-keys` 新增：Seedream 不支持自动测试说明、连接超时说明、BYOK 不扣平台服务费说明 | ✅ |

### 验收结果（2026-06-04 静态核查通过）

| 验收项 | 结果 | 备注 |
|---|---|---|
| `/account/providers/[id]` 健康卡片显示中文扩展解释 | ✅ PASS | `getHealthExplanation` → secondary `<p>` |
| auth_failed / provider_auth_failed / unauthorized / invalid_api_key 覆盖 | ✅ PASS | lastTestStatus + recentUsage 正则双重覆盖 |
| quota / billing / insufficient_quota 覆盖 | ✅ PASS | lastTestStatus + recentUsage 正则双重覆盖 |
| provider_model_invalid / endpoint_invalid / model_not_found 覆盖 | ✅ PASS | credentialType 检查 + recentUsage 正则 |
| timeout / provider_timeout 覆盖 | ✅ PASS | lastTestStatus === 'timeout' |
| db_unavailable / 用量数据不可用 | ✅ PASS | `usageSummaryUnavailable` → "暂时不可用" |
| asset_not_found / media_not_found | ⚠️ WARN | 非账户健康问题，未在 getRepairTips 中显式覆盖；recentUsage 表展示原始 errorCode；不在原始任务规格内；非阻塞 |
| Seedream 不支持自动测试，有画布验证引导 | ✅ PASS | 两处：getHealthExplanation + getRepairTips（含「去画布创作」链接） |
| 不触发真实生成 / 不调用 Provider | ✅ PASS | 所有 tip 均为静态文案 |
| `/account/providers` 异常 chip 正常（4 种异常类型） | ✅ PASS | `getAccountHint` 函数覆盖 auth/quota/endpointId/fail-rate |
| 正常账户不显示 chip | ✅ PASS | `if (!hint) return null` |
| `/help/api-keys` FAQ 重命名「出错了怎么办？」 | ✅ PASS | |
| `/help/api-keys` 新增 3 条 FAQ | ✅ PASS | Seedream unsupported / timeout / BYOK 服务费 |
| 不显示 API Key / encryptedApiKey / encryptedFields / prompt 明文 | ✅ PASS | 无 grep 命中 |
| `/account/usage` 无回归 | ✅ PASS | 文件未修改 |
| `/admin/usage` 无回归 | ✅ PASS | 文件未修改 |
| cn-executor 未改动 | ✅ PASS | commit diff 只含 3 个 web UI 文件 |
| 生成链路 / billing / schema 未改动 | ✅ PASS | commit diff 只含 3 个 web UI 文件 |
| type-check / lint / build 全部通过 | ✅ PASS | 零新错误 |

### 安全边界确认

- 未修改任何 API 路由、Provider CRUD、billing、credits、UsageLog schema
- 未修改 `/api/generate/*` / cn-executor / Prisma schema / payment
- 未新增真实 Provider 调用
- 所有 tip 文案静态渲染，不触发任何后端请求
- 不显示 API Key 明文 / encryptedApiKey / encryptedFields / prompt 明文 / endpointId 明文

---

## Seedance Video BYOK Safe Logging / Feature Flag Skeleton — CLOSED / validated

**Commit:** `3c2bab6`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-04
**Date validated:** 2026-06-04

### 目标

为未来 Seedance Video BYOK 实施准备安全基础，不开放 BYOK 给用户。

### 修改文件（共 4 个）

| 文件 | 改动说明 |
|---|---|
| `apps/cn-executor/src/logSafe.ts` | 新文件：`redactCredentialFields` + `sanitizeExecutorLogPayload` + `safeLogVideoJob` 三个工具函数 |
| `apps/cn-executor/src/handlers/videoJobRunner.ts` | 使用 `safeLogVideoJob`；start log 加 `hasByokCredential: false`；task done / job completed log 改为 boolean 标志，不再 slice 签名 URL |
| `apps/cn-executor/src/seedance.ts` | submit / poll 日志移除 `responseBody`（可能含签名 URL / token），改用已提取的安全字段 |
| `apps/web/src/app/api/generate/video/route.ts` | 新增 `ENABLE_SEEDANCE_VIDEO_BYOK` feature flag（默认 false）；缺少 env var 时也默认 false；`billingMode=user_provider_account` 请求返回 403 `VIDEO_BYOK_NOT_ENABLED` |

### 功能说明

| 功能 | 状态 |
|---|---|
| `logSafe.ts`：`CREDENTIAL_KEYS` 集合覆盖 apiKey / Authorization / encryptedApiKey / encryptedFields / userCredential / endpointId 等 | ✅ |
| `redactCredentialFields`：深度递归脱敏，不处理数组（数组不含凭证字段） | ✅ |
| `safeLogVideoJob`：统一 `[cn-executor][videoJobRunner]` 前缀 + 自动脱敏 | ✅ |
| videoJobRunner start log：`hasByokCredential: false`（当前平台路径，为 BYOK 实施预留 boolean 标志位） | ✅ |
| videoJobRunner task done log：`hasProviderVideoUrl: true` + `providerVideoUrlLength`（不再 slice 签名 URL） | ✅ |
| videoJobRunner job completed log：`hasStableVideoUrl: true`（不再 slice OSS URL） | ✅ |
| seedance.ts submit log：移除 `responseBody` 字段，只保留已提取的 taskId / httpStatus / model / hasImageUrl / duration / ratio | ✅ |
| seedance.ts poll log：移除 `responseBody` 字段，只保留 taskId / pollIndex / httpStatus / hasVideoUrl / taskStatus | ✅ |
| video route feature flag：`ENABLE_SEEDANCE_VIDEO_BYOK = process.env.ENABLE_SEEDANCE_VIDEO_BYOK === 'true'`；env var 缺失时必定 false | ✅ |
| video route guard：flag 为 false 且 `billingMode === 'user_provider_account'` → 403 `VIDEO_BYOK_NOT_ENABLED` | ✅ |
| 平台 video 路径（无 billingMode / billingMode=platform_credits）完全不受影响 | ✅ |
| 平台 credits reserve / finalize / refund 语义不变 | ✅ |

### 关键状态记录

| 项目 | 状态 |
|---|---|
| Seedance Video BYOK 实施 | ❌ 未实现（feature flag 默认关闭） |
| `ENABLE_SEEDANCE_VIDEO_BYOK` 默认值 | `false`（env var 缺失时也为 false） |
| userCredential 是否进入 run-video | ❌ 不进入（videoJobRunner 不接受 userCredential，guard 在 Vercel 层拦截） |
| 手工发 `billingMode=user_provider_account` video 请求 | 返回 403 `VIDEO_BYOK_NOT_ENABLED` |
| cn-executor video logs | ✅ 已脱敏：无签名 URL slice，无 responseBody，只有 boolean 标志 |
| 平台 video 生成路径 | ✅ 完全不变（setupBilling / finalizeBilling 调用链路不变） |

### 验收结果（2026-06-04 静态核查通过）

| 验收项 | 结果 | 文件:行号 |
|---|---|---|
| `ENABLE_SEEDANCE_VIDEO_BYOK` 默认 false（env var 缺失时也为 false） | ✅ PASS | `route.ts:496` — `=== 'true'` 比较 |
| `billingMode=user_provider_account` 返回 403 `VIDEO_BYOK_NOT_ENABLED` | ✅ PASS | `route.ts:500-510`，guard 在任何 DB / billing 操作之前 |
| guard 未解密 UserProviderAccount / 未读 encryptedApiKey | ✅ PASS | guard 在 auth check 后立即返回 |
| cn-executor trigger body 仅含 `{ generationJobId }` — 无 userCredential | ✅ PASS | `route.ts:769` |
| Video 节点 UI 无"生成费用来源"选择器 | ✅ PASS | `VisualCanvasWorkspace.tsx:8245` — `(kind === 'text' \|\| kind === 'image')` |
| start log 含 `hasByokCredential: false`，无 key / Authorization | ✅ PASS | `videoJobRunner.ts:342` |
| task done log 改为 boolean 标志 `hasProviderVideoUrl: true` — 无签名 URL | ✅ PASS | `videoJobRunner.ts:470` |
| job completed log 改为 `hasStableVideoUrl: true` — 无 OSS URL | ✅ PASS | `videoJobRunner.ts:601` |
| seedance.ts submit log 无 responseBody | ✅ PASS | `seedance.ts:249-253` |
| seedance.ts poll log 无 responseBody | ✅ PASS | `seedance.ts:286-291` |
| 平台 video 路径不变（普通请求完全跳过 guard） | ✅ PASS | guard 仅对 `user_provider_account` 触发 |
| Text 生成路由未被修改 | ✅ PASS | `git log 3c2bab6..HEAD -- generate/text/route.ts` 无结果 |
| Image 生成路由未被修改 | ✅ PASS | `git log 3c2bab6..HEAD -- generate/image/route.ts` 无结果 |
| billing / credits / Prisma schema 未修改 | ✅ PASS | git diff 只含 4 个已记录文件 |
| prompt 明文不进日志 | ✅ PASS | safeLogVideoJob payload 无 prompt 字段 |
| imageUrl 不完整输出 | ✅ PASS | submittedInput 中用 `hasImageUrl: Boolean` 代替完整 URL |

### 安全边界确认

| 安全项 | 状态 |
|---|---|
| userCredential 不传入 cn-executor run-video | ✅ guard 在 Vercel 层 |
| API key 不写入 `generationJob.input` | ✅（BYOK 未实现，平台路径不含 key） |
| cn-executor logs 不含签名 URL / responseBody | ✅ |
| feature flag 缺失 env var 时默认关闭 | ✅ `=== 'true'` 比较，undefined → false |
| 平台 video 路径不变 | ✅ `billingMode` 未设置时完全跳过 guard |
| cn-executor 未动真实调用逻辑 | ✅ 只改日志，apiKey fallback 逻辑不变 |
| 未改 Prisma schema / migration / payment / billing / credits | ✅ |
| 未改 Text / Image 生成路由 | ✅ |
| 未改 Provider Account CRUD / UsageLog / Admin Dashboard | ✅ |

---

## Pricing / Service Credits Static Preview + AI Help Billing Knowledge Sync — CLOSED / validated

**Commit:** `5b07162`
**验收日期：** 2026-06-05
**验收方式：** 静态代码逐条核查（10/10 PASS）

### 验收结果

| 验收项 | 结果 |
|---|---|
| `/pricing-preview` 顶部展示「当前费用模式（实际生效）」4 张卡片 | ✅ PASS |
| 明确「平台服务费：当前未启用，显示为 0」 | ✅ PASS |
| 明确「我的 API：Provider 费用由用户直接支付，不赚差价」 | ✅ PASS |
| 明确「充值 credits ≠ 给 Provider 充值」 | ✅ PASS |
| 「当前不会发生的事」7 条列表（含"不扣平台积分"/"不代收"/"不赚差价"/"不自动续费"） | ✅ PASS |
| Service Credits 草案黄色警告横幅「未来商业化草案，当前未启用，不会扣费」 | ✅ PASS |
| 草案表格含 Text/Image/Video BYOK 三行，标注「草案（未启用）」 | ✅ PASS |
| 启用前提 8 条（含失败退款 / feature flag / 通知 / 30-60 天观察） | ✅ PASS |
| 费用 FAQ 7 问 7 答（覆盖任务要求全部问题） | ✅ PASS |
| 命令面板：`平台服务费` / `pricing` / `API Key 接入` / `我的 API` 可搜到对应页面 | ✅ PASS |
| AI 助手：能回答「我的API会扣费吗」「充值是给Provider吗」「平台服务费是什么」「普通用户需要Key吗」 | ✅ PASS |
| AI 助手：平台服务费答案包含「当前未启用/0/不扣」 | ✅ PASS |
| 安全检查：无 encryptedApiKey / Authorization / sk- / endpointId 明文泄露 | ✅ PASS |
| 业务边界：generate routes / credits / billing / payment / prisma / cn-executor 零修改（diff = 0 行） | ✅ PASS |
| type-check / lint（0 Error）/ build 全部通过 | ✅ PASS |

### 变更文件（仅静态文案 / AI 知识 / 搜索索引）

| 文件 | 改动 |
|---|---|
| `pricingPreviewData.ts` | 新增 currentFeeFacts / currentFeeNeverList / serviceCreditsDraftRows / serviceCreditsNoGoList / billingFaqItems |
| `PricingPreviewPage.tsx` | 新增 CurrentFeeModeSection / ServiceCreditsDraftSection / BillingFaqSection 三个 section（Hero 之后最优先展示） |
| `local-model.ts` | 新增 7 个 if-else 分支覆盖全部费用类问题 |
| `context.ts` | 新增 `/pricing-preview` 等 5 个页面上下文 |
| `palette.ts` | 新增 4 个命令面板搜索条目含 30+ 关键词 |

### 安全边界确认

- 未启用平台服务费 ✅
- 未改 billing / credits / payment / schema / 生成链路 ✅
- 未暴露任何敏感字段 ✅
- Platform service fee charging 仍 not implemented ✅

---

## Platform Service Fee Strategy Audit — CLOSED / read-only audit completed

**审计日期：** 2026-06-04
**审计性质：** 只读 — 零文件修改，零 commit，零 push

### 核心结论

**当前不启用平台服务费。** 继续观察 BYOK 用量 30–60 天后再决策。

### 当前状态确认

| 项目 | 状态 |
|---|---|
| `UsageLog.platformServiceFeeCredits` 字段 | ✅ 已存在于 Prisma schema（`Int @default(0)`） |
| 当前所有路径写入值 | 固定为 0（`usage-log.ts:63` 硬编码 `?? 0`） |
| 平台服务费扣费逻辑 | ❌ 无。`billing-middleware.ts` 完全未实现 service credits 检查 |
| UI 显示 | `/account/usage`、`/account/providers`、`/account/providers/[id]`、`/admin/usage` 均显示"未启用 / 0" |
| `/pricing-preview` 页面 | ✅ 存在，静态草案，标注为预览，未接导航，不代表最终定价 |
| Service credits wallet | ❌ 未实现，当前只有平台额度单一 wallet |
| CreditLedger service_fee 类型 | ❌ 未定义（现有类型：reserve/settle/release/refund/admin_adjustment） |
| 订阅数据模型 | ❌ 未实现，Prisma schema 无 Subscription 表 |
| Creator City 是否赚 API 差价 | ❌ 否。BYOK 路径平台零收入，Provider 费用由用户直接支付 |

### No-Go 条件（任何一项未满足则不得启用收费）

| No-Go 条件 | 当前状态 |
|---|---|
| 没有生成前价格展示 | ❌ 未实现 |
| 没有失败退款机制 | ❌ 未实现 |
| 没有清晰区分 Provider 费用和平台服务费 | ⚠️ 已有文案说明，但无账单级别区分 |
| 没有用户账单明细 | ❌ 未实现 |
| 没有管理员审计（admin usage）| ✅ 已有基础，但 platformServiceFeeCredits 全为 0 |
| 没有 feature flag | ❌ 未实现（参照 ENABLE_SEEDANCE_VIDEO_BYOK 模式） |
| 没有提前通知（至少 14 天）和免费过渡期 | ❌ 未实现 |
| 没有客服 / 争议处理渠道 | ❌ 未实现 |
| 会让用户误以为平台代收 Provider 费用 | ❌ 必须在每个扣费入口明确说明 |

### 推荐路线（只读设计，不实施）

| 阶段 | 内容 | 技术改动 |
|---|---|---|
| **Phase 0（当前）** | 继续免费 BYOK，用 `/admin/usage` 观察用量 30–60 天 | 无 |
| **Phase 1** | 服务费策略文档 + `/pricing-preview` 文案更新（不改 billing） | 仅静态 UI |
| **Phase 2** | Service credits 数据模型只读审计（`Wallet` 扩展方案 vs 新表） | 只读设计 |
| **Phase 3** | 前端生成前价格预览（显示"预计消耗 N 平台服务 credits，当前未收费"） | 仅 UI，不改 billing |
| **Phase 4** | 后台 `ENABLE_SERVICE_FEE_CHARGING` feature flag 配置，仍不扣费 | Feature flag only |
| **Phase 5** | 小范围内测扣费，必须先实现 reserve / settle / refund service fee | 完整 billing 改动 |
| **Phase 6** | 公开启用 + 14 天提前通知 + Free tier 免费配额 + 账单导出 | 通知 + 账单 API |
| **Phase 7** | 订阅套餐（Subscription 数据模型 + 支付集成） | 全新 subscription 系统 |

### 草案定价参考（仅供内部讨论，不实施，不承诺）

| 操作 | 草案 service credits |
|---|---|
| Text BYOK 1 次 | 0（建议免费，计算成本极低） |
| Image BYOK 1 次 | 1 service credit |
| Video BYOK 5s 1 次 | 5 service credits |
| Video BYOK 10s 1 次 | 10 service credits |
| 失败是否退还 | 全额退还 |
| Free tier 月免费配额 | 5 service credits / 月 |

### 安全边界确认

- 未修改任何功能代码、billing、credits、Prisma schema、payment ✅
- 未新增 API 路由或修改现有路由 ✅
- 未修改 UsageLog 写入逻辑（仍固定写 0） ✅
- 未修改 setupBilling / finalizeBilling / reserve / settle / refund ✅
- 未修改 cn-executor ✅

---

## Service Credits Data Model Audit — CLOSED / read-only audit completed

**审计日期：** 2026-06-05  
**审计性质：** 只读 — 零文件修改，零 commit，零 push

### 当前状态

| 项目 | 状态 |
|---|---|
| Service credits wallet | ❌ 未实现（当前只有 `UserCreditWallet`，无独立服务积分 wallet） |
| Subscription billing | ❌ 未实现（Prisma schema 无 `Subscription` 表） |
| Platform service fee charging | ❌ 未实现（`UsageLog.platformServiceFeeCredits` 固定为 0） |
| Prisma schema / migration 变更 | ❌ 未做 |
| `CreditLedger` service_fee 类型 | ❌ 未定义（现有类型：PURCHASE / BONUS / RESERVE / SETTLE / RELEASE / REFUND / ADMIN_ADJUSTMENT / EXPIRE） |
| `UserCreditWallet` walletType | ❌ 不存在（只有单一 wallet 结构，无 walletType 字段） |
| `CreditLedger` idempotencyKey | ❌ 不存在（仅 app-layer settle guard，无 DB UNIQUE 约束） |

### 推荐数据模型（Option B：独立 ServiceCreditWallet + ServiceCreditLedger）

**核心原则：**
- 新建 `ServiceCreditWallet` 表，与 `UserCreditWallet` 完全隔离
- 新建 `ServiceCreditLedger` 表，独立 reserve / settle / release / refund 语义
- `UserCreditWallet` 继续只处理平台模型 credits（代付 Provider API 费用）
- `idempotencyKey`（格式：`service_reserve:{generationJobId}:{attempt}`）加 UNIQUE 约束，实现 DB 层幂等
- `generationJobId` + `usageLogId` 双向关联，逐笔可审计

### 不推荐方案

| 方案 | 原因 |
|---|---|
| ❌ Option A：在 `UserCreditWallet` 加 `serviceBalance` 字段 | 两种业务语义混在同一 wallet 中，会计混乱，审计困难 |
| ❌ Option C：walletType 泛化 wallet | 过度设计，查询复杂，审计困难，无法清晰隔离 |
| ❌ Option D：只用 `UsageLog` 统计服务费 | 无法做 reserve / settle / refund，不适合真实收费场景 |
| ❌ Option E：先做 Subscription 订阅 | 用量不足，无法定价，架构跃进，暂无用户需求数据支撑 |

### No-Go 条件（任何一项未满足则不得启用服务费收费）

| No-Go 条件 | 当前状态 |
|---|---|
| `UserCreditWallet` 与 `ServiceCreditWallet` 不混用 | ❌ service credits 未实现，风险存在于设计阶段 |
| 每笔 service fee reserve 必须有 DB 层 idempotencyKey（UNIQUE 约束） | ❌ 未实现 |
| 失败时必须全额退还 service credits（refund 语义完整） | ❌ 未实现 |
| 生成前必须展示预计消耗（preflight price preview） | ❌ 未实现 |
| 必须有独立 `ServiceCreditLedger`（逐笔可审计） | ❌ 未实现 |
| 必须有 `ENABLE_SERVICE_FEE_CHARGING` feature flag（默认 false） | ❌ 未实现（参照 `ENABLE_SEEDANCE_VIDEO_BYOK` 模式） |
| 必须提前 14 天通知用户并提供免费过渡期 | ❌ 未实现 |
| 必须有 admin 级别 service credit 审计界面 | ❌ 仅基础 `/admin/usage`，无 service credit 专项视图 |
| 负余额防护（DB CHECK constraint 或 app-layer preflight + 事务） | ❌ 当前仅 app-layer check，无 DB CHECK constraint |

### 关键发现：视频异步计费结构性缺陷

当前 Vercel video route 在 `generationJobId` 创建后（12s timeout 内）同步调用 `finalizeBilling`，但视频实际生成由 cn-executor 异步执行（可能耗时数分钟）。若未来视频 service fee 依赖 Next.js 侧 `finalizeBilling` 模式，**计费将在实际生成完成前就 settle**，导致无论成功/失败都已扣费。实施视频 service fee 时，必须先评审 cn-executor 主动回调 settle/release 的方案，不能沿用现有同步 finalizeBilling 路径。

### 迁移阶段建议（只读设计，当前不实施）

| 阶段 | 内容 | 约束 |
|---|---|---|
| **M0（当前）** | 继续免费 BYOK，用 `/admin/usage` 观察用量 30-60 天，无任何 schema 变更 | 只读 |
| **M1** | 新建 `ServiceCreditWallet` + `ServiceCreditLedger` 表，零业务逻辑 | 只加表，不写数据 |
| **M2** | 生成路由中懒创建 ServiceCreditWallet（balance=0），写 UsageLog 关联 `serviceWalletId` | 无扣费 |
| **M3** | Admin 手动 grant service credits（测试账户），验证 ledger 结构 | 仅后台操作 |
| **M4** | 前端展示 service credits 余额（只读 UI，不影响生成流程） | 仅 UI |
| **M5** | `ENABLE_SERVICE_FEE_CHARGING` feature flag 内测（小范围真实扣费） | 完整 reserve / settle / refund |
| **M6** | 公开启用 + 14 天提前通知 + Free tier 免费配额 + 账单导出 | 通知 + 账单 API |

### 下一步建议

- **当前**：继续观察 BYOK 用量 30-60 天，不做 schema migration，不做 service fee 扣费
- **可选（下阶段）**：Admin 模拟服务积分视图（只读报表，UsageLog × 草案费率，不真实扣费）— 最低风险的下一步
- **不建议**：立刻进入 M1（新表），无用量数据支撑时无法验证草案费率是否合理
- **禁止**：不经 9 项 no-go 条件全部满足就启用任何 service fee 扣费逻辑

### 安全边界确认

- 未修改任何功能代码、billing、credits、Prisma schema、payment ✅
- 未新增 API 路由或修改现有路由 ✅
- 未修改 UsageLog 写入逻辑（仍固定写 0）✅
- 未修改 setupBilling / finalizeBilling / reserve / settle / refund ✅
- 未修改 cn-executor ✅

---

## Admin Simulated Service Credits View — CLOSED / validated

**Commit:** `cee4f9d`
**验收日期：** 2026-06-05
**验收方式：** 静态代码逐条核查（14/14 PASS）

### 功能说明

在 `/admin/usage` 页面（仅管理员可见）新增"模拟服务积分（只读）"amber 区块，基于现有 UsageLog 数据估算如果未来按草案规则收费，本时间范围 BYOK 成功任务理论会产生多少 service credits。**不扣费，不写账本，不改 schema，不改 UsageLog.platformServiceFeeCredits。**

### 模拟规则

| 类型 | 规则 |
|---|---|
| Text BYOK | 0 service credits / 次 |
| Image BYOK | 1 service credit / 次 |
| Video BYOK | durationSeconds ≤ 5 → 5；durationSeconds > 5 → 10；durationSeconds 缺失 → 5（UI 标注） |
| platform_credits 路径 | 不纳入（只统计 billingMode = user_provider_account） |
| 失败/取消 | 不计入 totalCredits，单独显示 failedByokCalls |
| pending/running | 不计入 totalCredits，单独显示 pendingByokCalls |

### 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| admin guard 保留（非 ADMIN → 403） | ✅ PASS | `route.ts:15` |
| `/api/admin/usage` 返回 simulatedServiceCredits | ✅ PASS | `route.ts:224-247` |
| enabled: false | ✅ PASS | `route.ts:225` |
| 只统计 BYOK succeeded（billingMode + status 双条件） | ✅ PASS | `route.ts:83-84` |
| failed 单独计数不计入 totalCredits | ✅ PASS | `route.ts:89-94, 128` |
| pending 单独计数不计入 totalCredits | ✅ PASS | `route.ts:96-102` |
| Video 时长规则 ≤5→5, >5→10, null→5 | ✅ PASS | `route.ts:117-124` |
| 零数据库写入 | ✅ PASS | grep 无 create/update/upsert/delete |
| platformServiceFeeCredits 不改变 | ✅ PASS | 只读 aggregate，不写入 |
| 区块文案"当前不会扣费/不会写入账本/不会改变 UsageLog.platformServiceFeeCredits" | ✅ PASS | `page.tsx:277` |
| 区块 badges"未启用 / 不扣费""只读模拟" | ✅ PASS | `page.tsx:267, 270` |
| 失败/处理中 显示为"不计入" | ✅ PASS | `page.tsx:334, 340` |
| 无敏感字段（apiKey/encryptedFields/prompt/Authorization） | ✅ PASS | select 仅含 outputType+durationSeconds |
| billing/schema/生成链路/payment/cn-executor 零触碰 | ✅ PASS | commit diff 只含 2 个 UI 文件 + docs |
| 原有 summary cards 无回归 | ✅ PASS | `page.tsx:246-258` 原 6 个 SummaryCard 完整保留 |

### 修改文件（共 2 个功能文件）

| 文件 | 改动 |
|---|---|
| `apps/web/src/app/api/admin/usage/route.ts` | 新增 3 个并行只读查询 + reduce 计算 + simulatedServiceCredits 返回字段（+76 行） |
| `apps/web/src/app/admin/usage/page.tsx` | 新增类型定义 + amber 区块（+123 行） |

### 安全边界确认

- 未启用平台服务费 ✅
- 未改 billing / credits / payment / schema / 生成链路 ✅
- 未暴露任何敏感字段 ✅
- Platform service fee charging 仍 not implemented ✅
- Service credits wallet 仍 not implemented ✅
- UsageLog.platformServiceFeeCredits 仍固定为 0 ✅

### 浏览器验收重点

| # | 步骤 | 预期 |
|---|---|---|
| 1 | 管理员访问 `/admin/usage` | 页面正常加载，原有 summary cards 无回归 |
| 2 | 找到"模拟服务积分（只读）"amber 区块 | 区块显示，含"未启用 / 不扣费""只读模拟"badges |
| 3 | 确认区块副标题 | 含"当前不会扣费""不会写入账本""不会改变 UsageLog.platformServiceFeeCredits" |
| 4 | 查看理论总计 + Text / Image / Video 3 列 | 各列显示调用数 + 规则 + subtotal |
| 5 | 查看 BYOK 失败（不计入）/ BYOK 处理中（不计入） | 显示数字但不进入 totalCredits |
| 6 | 切换 24h / 7d / 30d | 模拟区块数据随 range 同步变化，原有 dashboard 无回归 |
| 7 | DevTools Network 查看 `/api/admin/usage` response | 含 simulatedServiceCredits.enabled = false |
| 8 | 普通用户访问 `/api/admin/usage` | 返回 401/403（guard 无回归） |
| 9 | `/account/usage` / `/account/providers` / `/pricing-preview` | 无任何变化，无回归 |

---

## Admin BYOK Business Metrics Dashboard — CLOSED / validated

**Commit:** `9e80027`
**验收日期：** 2026-06-05
**验收方式：** 静态代码逐条核查（14/14 PASS）

### 功能说明

在 `/admin/usage` 页面（仅管理员可见）新增"BYOK 商业指标（只读）"sky/blue 区块，基于现有 UsageLog + User 数据展示 BYOK 业务运营全貌。**不扣费，不写账本，不改 schema，不改 UsageLog.platformServiceFeeCredits。**

### 核心指标

| 指标 | 说明 |
|---|---|
| BYOK 总调用次数 | billingMode = user_provider_account 的所有状态记录 |
| BYOK 占比（%） | BYOK 调用 / 总调用 × 100 |
| 活跃 BYOK 用户数 | 该时间范围内有过 BYOK 调用的独立 userId 数 |
| BYOK 成功率（%） | BYOK succeeded / BYOK 总调用 × 100 |
| 高频用户（HIGH_FREQ_THRESHOLD = 10） | 该时间范围内 BYOK 调用 ≥ 10 次的用户数 |
| Provider 分布（前 10） | 含 successRate per provider，按调用次数降序 |
| 输出类型分布 | text / image / video，含 successRate |
| 高频用户明细表（前 10） | email / displayName / 调用次数 |
| Daily trend（近 30 天） | 每日 BYOK + platform_credits 调用数 |

### 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| admin guard 保留（非 ADMIN → 403） | ✅ PASS | `route.ts:15` — `role !== 'ADMIN' → 403` |
| `/api/admin/usage` 返回 byokBusinessMetrics | ✅ PASS | `route.ts:266-289, 385` |
| HIGH_FREQ_THRESHOLD = 10 | ✅ PASS | `route.ts:131`；filter `route.ts:218`；返回 `route.ts:277` |
| UI 展示高频阈值说明"≥ N 次" | ✅ PASS | `page.tsx:347` — `≥ ${data.byokBusinessMetrics.highFrequencyThreshold} 次` |
| 零数据库写入 | ✅ PASS | grep 无 create/update/upsert/delete |
| 无敏感字段（apiKey/encryptedFields/prompt/Authorization） | ✅ PASS | select 仅含安全字段 |
| platformServiceFeeCredits 只读 aggregate，不写入 | ✅ PASS | 仅 `_sum.platformServiceFeeCredits`，无 update |
| 区块免责说明"当前不会扣费，不会写入账本，不会改变 UsageLog.platformServiceFeeCredits" | ✅ PASS | `page.tsx:326` |
| 区块 badges"只读指标""当前不会扣费" | ✅ PASS | `page.tsx:316, 319` |
| 区块标题"BYOK 商业指标（只读）" | ✅ PASS | `page.tsx:314` |
| Provider 分布前 10 含 successRate | ✅ PASS | `page.tsx:378-388` |
| 高频用户表（条件渲染） | ✅ PASS | `page.tsx:396` |
| Daily trend 表（条件渲染） | ✅ PASS | daily trend conditional present |
| amber 模拟积分区块无回归 | ✅ PASS | `page.tsx:491` — simulatedServiceCredits 区块保留 |
| billing/schema/generate routes/payment/cn-executor 零触碰 | ✅ PASS | commit diff 只含 2 个 UI 文件 + docs |

### 修改文件（共 2 个功能文件）

| 文件 | 改动 |
|---|---|
| `apps/web/src/app/api/admin/usage/route.ts` | 新增 2 个 findMany 查询（BYOK + 平台额度各 take: 5000）+ reduce 计算 4 个 Map（user/provider/daily/output）+ byokBusinessMetrics 返回字段（+160 行） |
| `apps/web/src/app/admin/usage/page.tsx` | 新增类型定义（4 个 interface）+ sky/blue BYOK 商业指标区块（含 6 SummaryCard / Provider 分布 / 类型分布 / 高频用户表 / daily trend）（+195 行） |

### TypeScript 严格模式修复

Map entries 数组访问 `[...map.entries()].sort(...)[0][0]` 在 strict 模式下报 Object possibly undefined，统一改为 `[...map.entries()].sort(...)[0]?.[0] ?? null` 后 type-check 零错误。

### 安全边界确认

- 未启用平台服务费 ✅
- 未改 billing / credits / payment / schema / 生成链路 ✅
- 未暴露任何敏感字段（encryptedApiKey / encryptedFields / apiKey / Authorization） ✅
- Platform service fee charging 仍 not implemented ✅
- Service credits wallet 仍 not implemented ✅
- UsageLog.platformServiceFeeCredits 仍固定为 0 ✅

---

## BYOK Observation Summary / Admin Copy Report — CLOSED / validated

**Commit:** `98859b7`
**验收日期：** 2026-06-05
**验收方式：** 浏览器验收通过

### 功能说明

在 `/admin/usage` 页面（仅管理员可见）新增"BYOK 观察摘要（只读）"emerald 区块。前端 `buildObservationSummary` 函数基于已有 `byokBusinessMetrics` + `simulatedServiceCredits` API 数据生成中文周报文本，管理员可一键复制。**不写数据库，不扣费，不改 schema，不改任何生成链路。**

### 摘要字段

| 字段 | 内容 |
|---|---|
| BYOK 调用数 | byokBusinessMetrics.byokCalls |
| 平台额度调用数 | byokBusinessMetrics.platformCreditCalls |
| BYOK 占比 | byokSharePercent% |
| 活跃 BYOK 用户 | activeByokUsers |
| BYOK 成功率 | byokSuccessRate% |
| 高频 BYOK 用户（≥N次） | highFrequencyCount |
| Top Provider（前3） | providerId（次数，成功率%），不含 API Key |
| 类型分布 | 文本 / 图片 / 视频 |
| 模拟服务积分 | totalCredits（只读估算，未启用扣费） |
| BYOK 失败 / 处理中 | 不计入模拟积分 |
| 自动观察结论 | 基于数据量和成功率自动生成 |
| 边界说明 | 不写账本、不改变 UsageLog.platformServiceFeeCredits、不代表实际收费 |

### 自动观察结论规则

| 条件 | 结论 |
|---|---|
| byokCalls = 0 | 暂无 BYOK 使用，暂不具备定价判断依据 |
| byokFailureRate > 20% | 失败率偏高，优先修复稳定性，不建议推进收费 |
| byokCalls ≥ 100 | 使用量较高，建议跟踪，但仍不建议缺少 wallet / 退款机制时收费 |
| byokCalls ≥ 20 且成功率 ≥ 80% | 已有一定使用量且成功率较稳定，可继续观察 |
| 其他 | 用量较低，建议继续观察 |

### 验收结果

| 验收项 | 结果 |
|---|---|
| /admin/usage BYOK 观察摘要区块正常显示 | ✅ PASS |
| 复制观察摘要按钮正常，复制成功后显示"✓ 已复制" | ✅ PASS |
| fallback textarea 覆盖（clipboard API 不可用时显示 textarea，点击可全选） | ✅ PASS |
| range 切换后摘要内容同步变化 | ✅ PASS |
| 摘要不含 API Key / prompt 明文 / endpointId / 用户邮箱明细 | ✅ PASS |
| BYOK 商业指标区块无回归 | ✅ PASS |
| 模拟服务积分区块无回归 | ✅ PASS |
| /account/usage 无回归 | ✅ PASS |
| 不写数据库 | ✅ PASS |
| 不改变 UsageLog.platformServiceFeeCredits | ✅ PASS |
| 不启用收费 | ✅ PASS |
| 不改 billing / credits / payment / schema / 生成链路 | ✅ PASS |

### 修改文件（共 1 个功能文件）

| 文件 | 改动 |
|---|---|
| `apps/web/src/app/admin/usage/page.tsx` | 新增 `buildObservationSummary` 函数 + `copyStatus` / `showFallback` state + `handleCopy` callback + emerald 区块 UI（+119 行） |

### 安全边界确认

- 未启用平台服务费 ✅
- 未改 billing / credits / payment / schema / 生成链路 ✅
- 未暴露任何敏感字段（encryptedApiKey / encryptedFields / apiKey / Authorization / prompt / endpointId） ✅
- 摘要高频用户只写数量，不含邮箱明细 ✅
- Platform service fee charging 仍 not implemented ✅
- Service credits wallet 仍 not implemented ✅
- UsageLog.platformServiceFeeCredits 仍固定为 0 ✅

---

## BYOK Observation Playbook（30–60 天观察期运营 Playbook）— CLOSED / validated

**Commit:** `40f3d81`
**验收日期：** 2026-06-05
**验收方式：** 静态代码逐条核查（14/14 PASS）

### 功能说明

在 `/admin/usage` 页面（仅管理员可见）新增"30–60 天观察期 Playbook"indigo 区块。纯静态文案，无新增 API，不写数据库，不扣费，不改 schema。帮助管理员每周系统地判断 BYOK 增长情况和下一步策略。

### 验收结果

| 验收项 | 结果 | 证据 |
|---|---|---|
| /admin/usage 显示"30–60 天观察期 Playbook"区块（indigo 主题） | ✅ PASS | `page.tsx:704-835` |
| badges：只读观察 / 当前仍不启用收费 / 不写账本 | ✅ PASS | `page.tsx:708, 711, 714` |
| 正文：不改变 UsageLog.platformServiceFeeCredits 明确声明 | ✅ PASS | `page.tsx:721` |
| 每周固定查看面板（8 项） | ✅ PASS | `page.tsx:727-742`（BYOK 调用数/占比/活跃用户/成功率/高频用户/Top Provider/模拟 credits/失败率错误类型） |
| 绝不直接收费面板（6 条 No-Go，rose 边框） | ✅ PASS | `page.tsx:749-762`（ServiceCreditWallet/失败退款/生成前价格/账单明细/feature flag/用户通知） |
| 继续观察面板（4 条件 + 结论） | ✅ PASS | `page.tsx:769-788` |
| 先修稳定性面板（4 条件 + 结论，amber 边框） | ✅ PASS | `page.tsx:791-810` |
| 可以进入下一阶段面板（6 条全满足 + 结论不直接扣费，indigo 内嵌） | ✅ PASS | `page.tsx:813-835` |
| BYOK 商业指标区块无回归（sky 主题，`page.tsx:372`） | ✅ PASS | 代码结构未改动 |
| 模拟服务积分区块无回归（amber 主题，`page.tsx:547`） | ✅ PASS | 代码结构未改动 |
| BYOK 观察摘要复制功能无回归（`handleCopy` + `buildObservationSummary`） | ✅ PASS | `page.tsx:194, 281` 完整保留 |
| 零数据库写入（page 为纯客户端展示层） | ✅ PASS | grep 无 db./prisma./create/update/billing/reserve |
| 无敏感字段暴露（encryptedApiKey/apiKey/Authorization/prompt 明文） | ✅ PASS | grep 仅有"不含 prompt 明文"说明文字 |
| route.ts 未被 playbook commit 触碰 | ✅ PASS | `git show 40f3d81 -- route.ts` 空输出 |

### 修改文件（共 1 个功能文件）

| 文件 | 改动 |
|---|---|
| `apps/web/src/app/admin/usage/page.tsx` | 新增静态 Playbook 区块（+136 行）；无新增逻辑/API/state |

### 观察期运营方法（已固化）

| 场景 | 判断条件 | 推荐行动 |
|---|---|---|
| 继续观察 | byokCalls < 20 / 活跃用户 < 5 / BYOK 占比 < 10% / 高频用户不足 | 继续免费 BYOK，提升用量 |
| 先修稳定性 | 失败率 > 20% / auth/quota/endpoint 错误集中 / 某 Provider 成功率低 | 修 API Key 引导和健康建议，不推进收费 |
| 进入下一阶段 | 连续增长 2-4 周 + 成功率 ≥ 80% + 活跃用户增加 + 高频用户出现 + 模拟积分有规模 + 失败率 < 10% | 启动 service credits 数据模型评估（M1 新表），不直接扣费 |
| 绝不收费（6 no-go） | 任一 no-go 未满足 | 不得启用任何 service fee 扣费 |

### 安全边界确认

- 未启用平台服务费 ✅
- 未改 billing / credits / payment / schema / 生成链路 ✅
- 未暴露任何敏感字段 ✅
- Platform service fee charging 仍 not implemented ✅
- Service credits wallet 仍 not implemented ✅
- UsageLog.platformServiceFeeCredits 仍固定为 0 ✅

---

## Canvas Smart Tools — Generate Readiness Check — CLOSED / validated

**Commit:** `fa62030`
**验收日期：** 2026-06-05
**验收方式：** 静态代码逐条核查（13/13 PASS）

### 功能说明

在画布右侧新增单列工具栏（`CanvasSmartToolbar`），内含「生成前体检」工具（Activity 图标 + 实时状态点）。点击图标展开 `GenerateReadinessPanel`，自动读取当前节点和资产状态，显示分组清单（内容 / 配置 / 资产），无需用户手动输入。

### 新增文件（共 3 个）

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/readiness-check.ts` | 纯函数分析引擎（+513 行），零 React，零副作用，零 API 调用 |
| `apps/web/src/components/create/CanvasSmartToolbar.tsx` | 右侧工具栏组件（+205 行），含状态点、Panel 开关、4 个占位未来工具 |
| `apps/web/src/components/create/GenerateReadinessPanel.tsx` | 体检结果面板（+305 行），3 组清单，可折叠，可追加 Prompt，可复制报告 |

### 修改文件（共 1 个）

| 文件 | 改动 |
|---|---|
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | import 替换（CinematicControlsPanel→CanvasSmartToolbar）；添加 CanvasSmartToolbar 挂载；移除 CinematicControlsPanel dialog 内嵌 (+27/-8 行) |

### 验收结果（13 条）

| # | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 右侧工具栏出现 Activity 图标 + 实时状态点（4 色） | ✅ PASS | `CanvasSmartToolbar.tsx:127-145`（Activity icon + DOT_CLASSES）|
| 2 | 无节点选中时展示友好说明（不报错，不白屏） | ✅ PASS | `CanvasSmartToolbar.tsx:181-200`（"请先点击一个文本、图片或视频节点"）|
| 3 | 节点被选中时自动读取状态，无需用户手动输入 | ✅ PASS | `CanvasSmartToolbar.tsx:78-109`（useMemo + checkReadiness，纯数据驱动）|
| 4 | 体检结果分 3 组清单（内容 / 配置 / 资产），含折叠按钮和 fail/warn 计数 | ✅ PASS | `GenerateReadinessPanel.tsx:122-187`（GroupSection + GROUP_META）|
| 5 | 资产状态感知（resultImageUrl / resultVideoUrl / assetId / assetIntelligence） | ✅ PASS | `readiness-check.ts`（asset group checks，reads all 4 fields）|
| 6 | errorCode 映射为中文修复建议（20+ 种错误码） | ✅ PASS | `readiness-check.ts`（ERROR_CODE_MAP with 20+ entries）|
| 7 | 运行中节点显示专属提示（不重复触发生成） | ✅ PASS | `readiness-check.ts`（ACTIVE_STATUSES Set；"节点正在生成中"fail check）|
| 8 | Prompt 追加仅在节点对话框打开时可用（canAppendPrompt 守卫） | ✅ PASS | `CanvasSmartToolbar.tsx:71,113-118`（`canAppendPrompt = editingNode !== null`）|
| 9 | 复制体检结果：不含 API Key / endpointId 明文，Prompt 截断 120 字 | ✅ PASS | `readiness-check.ts`（copyableReport 构造，无 encryptedApiKey/endpointId）|
| 10 | 操作边界：面板内无生成按钮，无 fetch，无自动触发 | ✅ PASS | grep 全部 3 个新文件：0 个 /api/generate/ 调用 |
| 11 | 生成链路零回归（generate routes / cn-executor / billing 未触碰） | ✅ PASS | `git diff fa62030` 仅 4 文件，generate routes 未出现 |
| 12 | 安全：复制报告不含敏感字段（API Key / encryptedApiKey / encryptedFields / Authorization） | ✅ PASS | `readiness-check.ts` copyableReport 构造中无敏感字段 |
| 13 | 业务边界：generate routes / billing / schema / cn-executor 全部未改 | ✅ PASS | diff 确认：仅新增 3 文件 + workspace 挂载修改 |

### 已知非阻塞事项

- `CinematicControlsPanel.tsx` 文件仍存在于代码库，但已无 import，不影响运行
- 右侧工具栏已清理：未来工具占位按钮（镜头诊断 / 提示词重写 / 风格提取 / 连贯性检查）全部移除，不再显示 disabled 假入口
- 镜头词典已迁移到左侧 CanvasToolDock，右侧仅保留生成前体检

### 安全边界确认

- 未修改 `/api/generate/*` / billing / credits / payment / schema / cn-executor ✅
- 复制报告构造中明确排除 API Key / encryptedApiKey / encryptedFields / endpointId 明文 ✅
- 无新增 API 路由，无新增 DB 查询，纯客户端状态读取 ✅
- 操作完全由用户主动触发（点击图标展开），无自动生成 ✅

---

## Canvas Smart Tools Toolbar Cleanup + Camera Lexicon Navigation Placement — CLOSED / validated

**功能 commit:** `a7b5a9a`  
**验收日期:** 2026-06-05  
**状态:** ✅ CLOSED / browser validated

### 变更摘要

**右侧工具栏清理**
- 移除全部 4 个 disabled/coming-soon 占位按钮（镜头诊断 / 提示词重写 / 风格提取 / 连贯性检查）
- 移除镜头词典（Camera Lexicon）从右侧主工具栏
- 右侧工具栏现在只保留 Tool 1：生成前体检（Activity 图标 + 状态点）
- `FutureTool` 组件、`Stethoscope / Wand2 / Palette / Link2` 图标导入全部清理

**镜头词典迁移至左侧导航**
- Clapperboard 图标按钮加入 `CanvasToolDock`（左侧竖向工具栏）
- `lexiconOpen` 状态和 `handleLexiconInsert` 由 `VisualCanvasWorkspace` 管理
- `CameraLexiconPanel` 面板定位从 `right-[80px]` 改为 `left-[80px]`，从左侧弹出
- 镜头词典类别（景别/运镜/光线/色调/质感）只在 panel 内部出现，不在主导航外层铺开

**修改文件（仅 4 个）**
- `CanvasSmartToolbar.tsx` — 剥离至 Tool 1 only
- `CanvasToolDock.tsx` — 新增 Clapperboard 按钮 + `lexiconOpen`/`onLexiconToggle` props
- `CameraLexiconPanel.tsx` — 面板位置改为 `left-[80px]`
- `VisualCanvasWorkspace.tsx` — `isLexiconOpen` state + `handleLexiconInsert` + 渲染 CameraLexiconPanel

### 浏览器验收结果（20 条）

| # | 验收标准 | 结果 |
|---|---|---|
| 1 | 右侧工具栏不再出现 6 个图标 | ✅ |
| 2 | 右侧不再出现无法使用的图标 4–6 | ✅ |
| 3 | 右侧保留生成前体检，功能正常 | ✅ |
| 4 | 镜头词典不再出现在右侧主工具栏 | ✅ |
| 5 | 镜头词典入口出现在左侧导航（Clapperboard） | ✅ |
| 6 | 点击左侧镜头词典入口能打开 panel | ✅ |
| 7 | 镜头类别收纳在 panel 内部，主导航不铺开 | ✅ |
| 8 | 选中 image/video 节点后仍可选择镜头词条 | ✅ |
| 9 | 仍可插入 Prompt | ✅ |
| 10 | 仍可复制镜头语言 | ✅ |
| 11 | 仍可清空选择 | ✅ |
| 12 | 未选节点 / 文本节点时有友好提示 | ✅ |
| 13 | 已有 assetId/resultUrl 时说明不会覆盖已有资产 | ✅ |
| 14 | 不自动触发生成 | ✅ |
| 15 | 不新增 API | ✅ |
| 16 | 不改 generate routes | ✅ |
| 17 | 不改 provider adapter | ✅ |
| 18 | 不改 billing / credits / payment / schema | ✅ |
| 19 | 不影响 Tool 1 / Text / Image / Video 生成 | ✅ |
| 20 | type-check / lint / build 通过 | ✅ |

### 当前智能工具栏能力矩阵

| 工具 | 位置 | 状态 |
|---|---|---|
| 生成前体检（Generate Readiness Check） | 右侧主工具栏 | ✅ validated |
| 镜头词典（Camera Lexicon） | Director 分组子导航 | ✅ validated |
| 资产变体规划器（Asset Variant Planner · Tool 3A） | Asset 分组子导航 | ✅ validated |
| Media Preview Fallback（历史预览过期 fallback） | CanvasNodeCard.tsx | ✅ validated |
| Character Lock（角色一致性锁定基础版 · Tool 4） | Character 分组子导航 | ✅ validated |
| Canvas Tool Dock Grouping（Director/Asset/Character 分组子导航） | CanvasToolDock.tsx | ✅ validated |
| Workflow Connection Context Tools（连线上下文工具入口） | VisualCanvasWorkspace.tsx | ✅ implemented / browser validation pending |
| Stronger Canvas Edges（连接线视觉增强 + 箭头 + hover） | CanvasFlowEdge.tsx + canvas.module.css | ✅ implemented / browser validation pending |
| Shot List Builder（分镜清单生成器） | Director 分组子导航 | ✅ validated |
| Continuity Checker（连贯性检查器） | Director 分组子导航 | ✅ validated |
| AI vision-based continuity analysis | — | future |
| Automatic continuity repair | — | not now（不自动修改 prompt）|
| Shot Doctor（镜头诊断） | — | future · Director 分组子导航 |
| Character Consistency Checker | — | future · Character 分组子导航 |
| Real Batch Variants / 批量真实生成 | — | later（涉及 credits + 并发失败处理） |

### 安全边界

- 不自动触发生成 ✅
- 不新增 API ✅
- 不改 generate routes ✅
- 不改 provider adapter ✅
- 不改 billing / credits / payment / schema ✅
- 不影响 Tool 1（生成前体检）✅
- 不影响 Text / Image / Video 生成链路 ✅
- cn-executor 未改动 ✅
- package.json / pnpm-lock.yaml 未改动 ✅

### 产品方向说明

Canvas 智能工具栏已完成纠偏：右侧只保留真正可用工具，镜头词典收纳到左侧工具入口，避免假工具误导用户。  
下一步进入 **Tool 3A：资产变体规划器 / Asset Variant Planner**，先做安全的"规划"版本，不直接批量消耗 credits。

---

## Canvas Smart Tools Tool 3A — Asset Variant Planner — CLOSED / validated

**功能 commit:** `3819d1c`  
**docs commit:** `c0e459c`  
**验收日期:** 2026-06-05  
**状态:** ✅ CLOSED / browser validated

### 功能说明

在左侧 `CanvasToolDock` 新增 Layers 图标入口，点击展开 `AssetVariantPlannerPanel`。读取当前选中节点状态（kind / prompt / assetId / resultImageUrl / resultVideoUrl / assetIntelligence），由 `asset-variant-planner.ts` 纯函数生成变体方向卡片。**纯前端静态规划，不自动生成，不消耗 credits，不覆盖已有资产，不新增 API，不改生成链路。**

### 新增文件（共 2 个）

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/asset-variant-planner.ts` | 纯函数变体规划引擎，zero React，zero API，zero side effects |
| `apps/web/src/components/create/AssetVariantPlannerPanel.tsx` | 变体方向展示面板，含摘要 / 变体卡 / 操作按钮 |

### 修改文件（共 2 个）

| 文件 | 改动 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | 新增 Layers 按钮 + `variantPlannerOpen` / `onVariantPlannerToggle` props |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | `isVariantPlannerOpen` state + `handleVariantInsert` + `handleVariantCreateNode` + 面板渲染 + 与 Lexicon 互斥逻辑 |

### 输出卡片规格

| 节点类型 | 卡片数 | 变体方向 |
|---|---|---|
| image | 5 | 光线变体 / 构图变体 / 情绪变体 / 图生视频草案 / 商业广告版 |
| video | 5 | 慢节奏电影版 / 运镜变体 / 续作规划 / 竖版短视频适配 / 广告剪辑版 |
| text | 3 | 关键画面提炼 / 场景视觉化 / 角色视觉化 |

每张卡片包含：图标 / 标题 / 描述 / 标签 / promptDraft 预览 / 3 个操作按钮（复制 Prompt / 追加 Prompt / + image 或 video 节点草案）。

### assetIntelligence 利用

`parseAssetIntelligence(node.metadataJson)` 提取 `visualStyle` / `mood` / `cinematography`，若存在则拼入 `promptDraft` 前缀，使变体方向更贴合已有资产风格。

### 浏览器验收结果

| # | 验收项 | 结果 |
|---|---|---|
| 1 | 左侧 CanvasToolDock 出现 Layers 图标入口 | ✅ |
| 2 | 右侧主工具栏未增加新图标，仍只保留 Tool 1 | ✅ |
| 3 | 未选节点时显示空状态（Layers 图 + 引导文字） | ✅ |
| 4 | 文本节点显示 amber 提示 + 3 个图片草案卡 | ✅ |
| 5 | image/video 节点显示资产摘要卡（缩略图 / prompt 截断 / 节点 kind 标签） | ✅ |
| 6 | 已有 assetId/resultUrl 时显示绿色保护说明 | ✅ |
| 7 | assetIntelligence 存在时可利用 visualStyle/mood/cinematography 拼入 promptDraft | ✅ |
| 8 | image 节点输出 5 张变体卡（光线 / 构图 / 情绪 / 图生视频 / 商业） | ✅ |
| 9 | video 节点输出 5 张变体卡（慢节奏 / 运镜 / 续作 / 竖版 / 广告剪辑） | ✅ |
| 10 | text 节点输出 3 张草案（关键画面 / 场景 / 角色） | ✅ |
| 11 | 可复制 Prompt（navigator.clipboard + 2s 状态反馈） | ✅ |
| 12 | 追加 Prompt（节点对话框打开时可用，否则 disabled） | ✅ |
| 13 | 新建 image/video 节点草案（status: idle，不自动触发生成） | ✅ |
| 14 | 面板与 Camera Lexicon 互斥（打开一个自动关闭另一个） | ✅ |
| 15 | 点击面板外背景遮罩关闭面板 | ✅ |
| 16 | 不消耗 credits | ✅ |
| 17 | 不新增 API | ✅ |
| 18 | 不改 generate routes | ✅ |
| 19 | 不改 provider adapter | ✅ |
| 20 | 不改 billing / credits / payment / schema | ✅ |
| 21 | 不影响 Tool 1 / Tool 2 / Text / Image / Video 生成 | ✅ |
| 22 | type-check / lint / build 全部通过 | ✅ |

### /api/media/proxy 502 审计结论（非阻塞）

**审计性质：** 只读 — 零文件修改，零 commit，零 push  
**结论：Tool 3A 与 502 错误无关，不阻塞验收。**

| 审计项 | 结论 |
|---|---|
| Tool 3A 是否自动触发 generate 请求 | 否 |
| Tool 3A 是否批量请求 /api/media/proxy | 否 |
| AssetVariantPlannerPanel 媒体渲染方式 | `<img src={node.resultImageUrl}>` 直链，已有 onError fallback（display:none） |
| 502 来源 | CanvasNodeCard 为所有历史节点渲染媒体预览，经 /api/media/proxy；历史节点 OSS signed URL 过期 → proxy 返回 502 |
| 该问题与 Tool 3A 的关系 | 独立问题，Tool 3A 上线前已存在 |
| 后续建议 | 独立任务：历史媒体预览 fallback / proxy 错误分类增强（Category D 静默降级） |

### 安全边界确认

| 安全项 | 状态 |
|---|---|
| 不自动触发生成 | ✅ |
| 不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不改 generate routes | ✅ |
| 不改 provider adapter | ✅ |
| 不改 billing / credits / payment / schema | ✅ |
| 不影响 Tool 1 / Tool 2 / Text / Image / Video 生成 | ✅ |
| cn-executor 未改动 | ✅ |
| package.json / pnpm-lock.yaml 未改动 | ✅ |
| 无 API Key / encryptedApiKey / encryptedFields 暴露 | ✅ |

---

## Media Preview Fallback for Expired Historical Assets — CLOSED / validated

**功能 commit:** `5ebdb91`  
**docs commit:** `a4ef3da` → 更新为 CLOSED: 当前 commit  
**验收日期:** 2026-06-05  
**状态:** ✅ CLOSED / 代码级静态验收通过

### 问题背景

历史 Image / Video 节点的 `resultImageUrl` / `resultVideoUrl` 持有 OSS signed URL，签名过期后 `/api/media/proxy?url=...` 返回 502。原有 `renderMediaFailurePanel` 通过 `failureDiagnosis` 诊断流程，会将这种情况误诊为 `asset_not_found_by_node`（显示"素材未绑定到节点"），让用户误以为付费资产已丢失。

### 修复方案

在 `renderMediaFailurePanel` 顶部增加早返回判断：

```typescript
const isSimplePreviewExpiry = node.status === 'done' && Boolean(nodeAssetId) && !persistencePending
if (isSimplePreviewExpiry) {
  return <span>预览暂不可用 / 资产记录仍保留 / → 前往资产库确认</span>
}
```

条件满足时绕过全部诊断逻辑，直接显示冷静占位符。

### 修改范围

| 文件 | 变更 |
|---|---|
| `apps/web/src/components/create/CanvasNodeCard.tsx` | +33 行，早返回分支 |

**不改动：** cn-executor · /api/media/proxy route · /api/generate/* · provider adapter · billing / credits / schema · CanvasToolDock · AssetVariantPlannerPanel · VisualCanvasWorkspace

### 浏览器验收（代码级静态确认）

| 验收准则 | 依据 | 结论 |
|---|---|---|
| 破图不再显示 | `imageMedia.loadFailed ? renderMediaFailurePanel : <img/>` — img 被卸载 | ✅ |
| 破视频不再显示 | `videoMedia.loadFailed ? renderMediaFailurePanel : <video/>` — video 被卸载 | ✅ |
| 显示"预览暂不可用 / 资产记录仍保留" | 早返回 JSX 中精确包含这两段文案 | ✅ |
| /assets 入口存在 | `href="/assets"` 链接在早返回 JSX 中 | ✅ |
| done 状态不被误改 | `node.status` 从未被前端写入 | ✅ |
| Prompt 摘要可见 | `promptTruncated = node.prompt?.trim().slice(0, 60)` 渲染于占位符 | ✅ |
| 坏 URL 不反复请求 | img/video 卸载；`imageLoadFailed` 仅在 `imageCandidateUrlsKey`/`node.id` 变化时 reset | ✅ |
| Tool 3A 回归 | `AssetVariantPlannerPanel.tsx` 自 `3819d1c` 以来未改动 | ✅ |
| 不自动生成 / 不消耗 credits | 无任何生成调用新增 | ✅ |
| 安全边界 | generate routes / proxy / provider / billing / schema 均未触碰 | ✅ |

---

## Next Phase Tasks (priority order)

1. ~~**Phase V1：多字段凭证结构扩展** — ✅ DONE / production validated (commit `14a763d`)~~

2. ~~**Phase V2：Seedream Image BYOK 试点** — ✅ CLOSED / validated (commit `c6ff87f`, validated 2026-06-03)~~

3. **Phase V3：Seedance Video BYOK 安全方案评审 — ✅ 评审完成，实施暂缓**
   - 评审结论：推荐 Option A（Vercel 解密 → HTTPS 传给 cn-executor，镜像 Image BYOK 路径）
   - 不推荐：cn-executor 持有 `PROVIDER_KEY_ENCRYPTION_SECRET` / 直连 `UserProviderAccount` / 写入 `generationJob.input`
   - ✅ **前提条件 1 已完成**：cn-executor safe logging + video route feature flag skeleton (commit `3c2bab6`)
   - 暂缓原因：平台 key 已可正常生成视频；BYOK 是 power user 成本优化，优先级低于稳定性
   - 启动前提：设置 `ENABLE_SEEDANCE_VIDEO_BYOK=true` 并实施 videoJobRunner userCredential 接收逻辑
   - 详见：文件内「Seedance Video BYOK Security Review」章节

4. **Phase V4：其他单 API Key 图片/视频 Provider BYOK**
   - Runway 等 Vercel-side 单 Bearer Token Provider
   - 依赖 Phase V2 链路验证

5. ~~**Phase V5：BYOK 平台服务费记录 / usage logging** — ✅ DONE as Phase S1 (commit `d693f71`, validated 2026-06-03)~~

6. ~~**独立 API Key 帮助页 `/help/api-keys`** — ✅ DONE / browser validated (commit `35185b4`, validated 2026-06-04)~~

7. **Platform Service Fee Phase 0：持续观察 BYOK 用量（P2）**
   - ✅ 已完成：平台服务费策略只读审计（结论：当前不启用）
   - ✅ 已完成：Pricing / Service Credits 静态文案预览包（`/pricing-preview` + AI 帮助费用知识同步，`5b07162`）
   - ✅ 已完成：Service Credits 数据模型只读审计（推荐 Option B；9 项 no-go 条件；M0-M6 迁移阶段；当前继续观察）
   - 用 `/admin/usage` 每周观察 BYOK 调用量、用户分布、成功率
   - 判断门槛：BYOK 用量比例 > 30% 且高频用户 ≥ 50 人后再考虑启用
   - ✅ 已完成：Admin 模拟服务积分视图（只读报表，UsageLog × 草案费率，不真实扣费，不改 schema）
   - ✅ 已完成：Admin BYOK 商业指标只读看板（BYOK 调用占比/活跃用户/成功率/高频用户/Provider/类型/daily trend，`9e80027`，validated 2026-06-05）
   - **下一步可做**：继续观察 BYOK 用量，无需立即动作；定期查看 `/admin/usage` BYOK 商业指标区块；如数据支撑（BYOK 占比 > 30%，高频用户 ≥ 50），下阶段考虑 M1（新表，不写数据）

8. ~~**Canvas Smart Tools Tool 1 — Generate Readiness Check** — ✅ CLOSED / validated (commit `fa62030`, static audit validated 2026-06-05)~~

9. ~~**Canvas Smart Tools Tool 2 — Camera Lexicon** — ✅ CLOSED / validated (commit `e48ee95`, browser validated 2026-06-05)~~

10. ~~**Canvas Smart Tools Toolbar Cleanup + Camera Lexicon Navigation Placement** — ✅ CLOSED / validated (commit `a7b5a9a`, browser validated 2026-06-05)~~

11. ~~**Canvas Smart Tools Tool 3A — Asset Variant Planner（资产变体规划器）** — ✅ CLOSED / validated (commit `3819d1c`, browser validated 2026-06-05)~~

12. ~~**P0-small：Media Preview Fallback for Expired Historical Assets（独立任务）** — ✅ CLOSED / validated (commit `5ebdb91`, 2026-06-05)~~
    - ~~历史节点 OSS signed URL 过期 → CanvasNodeCard 通过 /api/media/proxy 返回 502，console 有大量噪音~~
    - 修复：`renderMediaFailurePanel` 早返回判断 `node.status === 'done' && nodeAssetId && !persistencePending`，显示"预览暂不可用 / 资产记录仍保留"+ /assets 链接，不再误诊为"素材未绑定到节点"
    - 约束已遵守：仅改 CanvasNodeCard.tsx 33 行，type-check/lint/build 全通过
    - ~~Browser validation pending~~ → **代码级静态验收通过，7 条验收准则全部确认**

13. ~~**Canvas Smart Tools Tool 4 — Character Lock / 角色一致性锁定（基础版）** — ✅ CLOSED / validated (commit `201c795`, 2026-06-06)~~
    - 左侧 CanvasToolDock 新增 UserRound 图标入口（Layers 下方）
    - CharacterLockPanel：注册图片节点为角色卡 · 编辑名/描述/tags · 追加到 Prompt · 复制描述 · 删除
    - 底层：复用 `@/lib/characters` localStorage 持久化（creator-city:character-bible:{projectId}）
    - 新增：CharacterLockPanel.tsx · character-lock.ts（纯函数）
    - 约束已遵守：type-check/lint/build 全通过，不改 schema/generate/billing/provider
    - ~~Browser validation pending~~ → **验收通过**

14. ~~**Canvas Tool Dock Grouping（导演/资产/角色 分组子导航重构）** — ✅ CLOSED / validated (commit `daa6811`, 2026-06-06)~~
    - 三个独立工具图标 → 三个分组入口 (Director / Asset / Character)
    - 点击分组入口展开子导航，选择具体工具打开对应 panel
    - 同类未来工具直接添加到子导航，不再新增一级图标
    - 约束已遵守：type-check/lint/build 全通过，零 workspace 改动
    - 19/19 验收通过

15. ~~**Workflow Connection Context Tools + Stronger Edges** — ✅ IMPLEMENTED (commit `94db55e`, 2026-06-06)~~
    - 连接线视觉增强：默认蓝色渐变线、stroke-width 1.8、opacity 0.76、hover glow、箭头方向指示
    - 当上游 image/video 节点有媒体资产时，下游 image/video 节点下方显示上下文工具入口
    - 3个操作：角色锁定 / 资产变体 / 镜头语言 — 点击聚焦目标节点并打开对应 panel
    - 人物关键词检测时，优先显示"↑ 角色参考可用"和 amber 样式角色锁定按钮
    - 约束已遵守：type-check/lint/build 全通过；不新增 API / 不改 schema / 不改生成路由
    - **Browser validation pending**

16. ~~**Canvas Smart Tools Tool 5 — A/B Compare Panel（Asset 分组下）** — ✅ IMPLEMENTED / browser validation pending (commit `66da5b5`, 2026-06-06)~~
    - 已有资产对比工具：选择两个 image/video 节点，并排展示两版生成结果，prompt 差异分析
    - 进入 Asset 分组子导航（Layers 图标 → 版本对比），不新增一级图标
    - 纯前端展示，不消耗 credits，不新增 API
    - compare-utils.ts：纯函数 analyzePromptDiff / buildCompareReport / isComparableNode
    - ABComparePanel.tsx：NodeSelector / MediaPreview（无自动播放）/ NodeColumn / 复制报告 / 标记胜出版本

17. ~~**Canvas Smart Tools Tool 6 — Keyframe Extractor（关键帧提取器 · Asset 分组下）** — ✅ CLOSED / validated (commit `ccb5f42`, build fix `9e9b340`, 2026-06-06)~~
    - video 节点选择器（仅 video 节点，有内容才可选）
    - 视频预览不自动播放，含 controls
    - 快捷时间点：起始帧 0s / 中间帧 50% / 结尾帧 95% / 当前帧
    - 浏览器 canvas drawImage 抽帧，CORS 失败显示 fallback（不 crash）
    - 复制时间点 / 复制关键帧说明
    - 创建图片草案节点（prompt 写关键帧参考，idle，不自动生成，建 edge）
    - 创建视频续作草案节点（idle，不自动生成，建 edge）
    - 不自动生成，不消耗 credits，不新增 API，不上传 OSS，不改 schema/billing/cn-executor
    - Asset 分组当前包含：资产变体规划器 / 版本对比 / 关键帧提取

18. ~~**Canvas Smart Tools Tool 7 — Shot List Builder / 分镜清单生成器**~~ — ✅ CLOSED / validated (commits `26f8d16` · `5cfb912` · `97ff477`)

19. ~~**Canvas Smart Tools Tool 8 — Continuity Checker / 连贯性检查器**~~ — ✅ CLOSED / validated (commit `1e9b737`)

20. ~~**Canvas Smart Tools Tool 9 — Prompt Booster / 提示词增强器**~~ — ✅ CLOSED / validated (commit `6e1a24f`, validated 2026-06-07)
    - 归属：新增 Prompt / 提示词分组（PencilLine 图标），独立于 Asset / Director
    - image 7维 / video 7维 / text 6维规则引擎；score 0-100；checks + suggestions + appendText
    - 用户点击追加到 Prompt，重复检测防止重复追加，不自动覆盖
    - 不自动生成，不消耗 credits，不新增 API/schema，不改 generate/provider/billing/cn-executor
    - 23 条验收全部通过

21. ~~**Canvas Smart Tools Tool 10 — Sequence Board / 镜头序列编排器**~~ — ❌ REMOVED / not validated (commit `37a43da`, 2026-06-07)
    - 实现后用户产品评审：功能与 Shot List Builder / Continuity Checker / 画布连线顺序重叠，判断为冗余
    - 已从 UI 完全撤下：Director 子菜单入口已删除，SequenceBoardPanel.tsx 和 sequence-board.ts 已删除

22. ~~**Canvas Smart Tools Tool 10 — Batch Prompt Rewriter / 批量 Prompt 重写器**~~ — ✅ CLOSED / validated (commit `e3c3a2b`, readability fix `e5bb57a`, validated 2026-06-07)
    - 归属：Prompt / 提示词分组（PencilLine 图标），位于提示词增强器下方
    - 选择多个 text/image/video 节点 → 选维度 → 输入追加内容 → 生成预览 → 用户确认后批量 patch prompt
    - 支持维度：风格统一 / 质感/画质 / 负向约束 / 画幅/构图 / 镜头语言 / 自定义
    - 重复检测：已存在类似片段的节点自动跳过
    - 只追加，不替换（replace mode: future）
    - 追加内容 textarea 修复可读性（深底浅字 + colorScheme:dark + 显式 placeholder + caret 可见）
    - 不自动生成，不消耗 credits，不新增 API，不改 schema/generate/billing/cn-executor
    - 27 条验收全部通过

23. **Canvas Smart Tools Tool 11 — Look Package Applier / 视觉风格包应用器**
    - 状态：🔄 IMPLEMENTED / browser validation pending
    - Prompt 分组第三子工具（PencilLine 图标，🎨 视觉风格包）
    - 10 个风格包，6 分类（导演风格/胶片模拟/LUT调色/品牌商业/建筑空间/社交摄影）
    - CSS 渐变色块替代图片，无额外资源依赖
    - 两步确认：生成预览 → 确认应用
    - hasSimilarLook 重复检测（前40字 case-insensitive）
    - 只追加不替换；不自动生成；不消耗 credits；不新增 API
    - 追加格式：`[Look Package - {name}]\n{fragment}\n\n[Look Negative Constraints]\n{negativeConstraints}`

23. **错误提示产品化（P2）**
    - 去除剩余 `errorCode:`/`provider_*:` 前缀（OSS/media 类还有残留）

21. **NEXT_PUBLIC_API_URL / billing webhook（P2，单独排期）**
   - 确认 CN 部署是否启用支付链路
   - 如启用：配置 `NEXT_PUBLIC_API_URL` 或将 billing webhook 改为直接 DB 调用

---

## Canvas Smart Tools Tool 4 — Character Lock Basic — CLOSED / validated

**功能 commit:** `201c795`  
**验收日期:** 2026-06-06  
**状态:** ✅ CLOSED / validated

### 功能说明

在左侧 `CanvasToolDock`（Layers 变体规划器按钮下方）新增 `UserRound` 图标入口，点击展开 `CharacterLockPanel`。纯前端、不自动生成、不消耗 credits、不调 API、不改 schema。底层复用现有 `@/lib/characters` 系统（localStorage 持久化，key: `creator-city:character-bible:{projectId}`）。

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/character-lock.ts` | 纯函数：`generateCharacterDescription` / `buildCharacterPromptAppend` |
| `apps/web/src/components/create/CharacterLockPanel.tsx` | 角色锁定面板 UI |

### 修改文件

| 文件 | 变更 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | 新增 `UserRound` 按钮 + `characterLockOpen`/`onCharacterLockToggle` props |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | 新增 `isCharacterLockOpen` state + `handleCharacterLockInsert` + 面板渲染 + 互斥逻辑 |

### 功能完整性

| 功能 | 实现 |
|---|---|
| 左侧工具导航入口（UserRound 图标） | ✅ |
| 未选节点时友好提示 | ✅ |
| 文本节点友好提示 | ✅ |
| 图片节点注册为角色卡 | ✅ |
| 注册表单：角色名 / 描述词 / tags | ✅ |
| 描述词预填（prompt + assetIntelligence 提取） | ✅ |
| 描述词可编辑 | ✅ |
| 保存后角色卡出现在列表 | ✅ |
| 角色卡缩略图（hero reference 图片） | ✅ |
| 追加角色描述到 Prompt | ✅ |
| 复制角色描述 | ✅ |
| 删除角色卡（不删除资产） | ✅ |
| 资产保护文案 | ✅ |
| 与 Lexicon / Variant Planner 互斥关闭 | ✅ |
| 右侧主工具栏不新增图标 | ✅ |
| 不自动生成 / 不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不改 schema / generate routes / billing | ✅ |
| type-check / lint / build 通过 | ✅ |

### 浏览器验收重点

1. 左侧工具导航（CanvasToolDock）Layers 按钮下方出现 UserRound 图标。
2. 右侧主工具栏（CanvasSmartToolbar）没有新增图标。
3. 未选中节点时，面板显示"请先选择一个节点"。
4. 选中文字节点时，显示 amber 提示。
5. 选中已生成图片节点，面板底部显示"注册当前图片为角色卡"按钮。
6. 点击注册 → 注册表单展开，角色名 + 描述词（已预填）+ 标签。
7. 编辑后保存，角色卡出现在列表，显示缩略图/名/描述预览。
8. 选中 image/video 节点，找到已有角色卡，点击"追加到 Prompt"（需先打开节点对话框）。
9. 验证追加不覆盖原 Prompt，而是追加多行角色一致性描述。
10. 点击"复制描述"，粘贴确认内容正确。
11. 删除角色卡后列表移除，原图片节点和资产完全不受影响。
12. 打开镜头词典 / 变体规划器时，角色锁定面板自动关闭（互斥）。

### 验收结论

| 验收项 | 结论 |
|---|---|
| 左侧工具栏 UserRound 图标入口 | ✅ |
| 右侧主工具栏无新图标 | ✅ |
| 未选节点友好提示 | ✅ |
| 文本节点 amber 提示 | ✅ |
| image 节点注册角色卡 | ✅ |
| 注册表单（角色名 / 描述词 / tags）| ✅ |
| 描述词预填 + 可编辑 | ✅ |
| 保存后角色卡出现在列表 | ✅ |
| 追加到 Prompt（不覆盖原 prompt）| ✅ |
| 复制描述 | ✅ |
| 删除角色卡不删除资产 | ✅ |
| 互斥关闭 Lexicon / Variant Planner | ✅ |
| 不自动生成 / 不消耗 credits / 不新增 API / 不改 schema | ✅ |
| 不影响 Tool 1 / Tool 2 / Tool 3A / Media Preview Fallback / Text / Image / Video 生成 | ✅ |

存储方式：localStorage，key `creator-city:character-bible:{projectId}`，基础版不跨设备同步。

---

## Canvas Tool Dock Grouping — CLOSED / validated

**Feature commit:** `b1831dd` | **Docs commit:** `daa6811` | **Date:** 2026-06-06  
**File changed:** `apps/web/src/components/create/CanvasToolDock.tsx` only  
**Workspace wiring:** zero changes (same props interface preserved)

### Group Structure

| 组 | 一级图标 | 英文 | 子工具（已实现） |
|---|---|---|---|
| Director（导演）| Clapperboard | Director | 镜头词典（Camera Lexicon）|
| Asset（资产）| Layers | Asset | 变体规划器（Asset Variant Planner）|
| Character（角色）| UserRound | Character | 角色锁定（Character Lock）|

### Future Tools Routing（只能归组，不得新增一级图标）

| 未来工具 | 归属组 |
|---|---|
| Shot Doctor | Director |
| Motion Director | Director |
| A/B Compare | Asset |
| Keyframe Extractor | Asset |
| Consistency Checker | Character |
| Multi-character Binding | Character |

### Validation Result (19 / 19 ✅)

| # | 验收项 | 结论 |
|---|---|---|
| 1 | 左侧工具栏只有3个分组图标：Clapperboard / Layers / UserRound | ✅ |
| 2 | 不再有独立的一级 Camera Lexicon / Variant Planner / Character Lock 图标 | ✅ |
| 3 | 点击 Clapperboard → 弹出 Director 子导航，含"镜头词典"条目 | ✅ |
| 4 | 点击 Layers → 弹出 Asset 子导航，含"变体规划器"条目 | ✅ |
| 5 | 点击 UserRound → 弹出 Character 子导航，含"角色锁定"条目 | ✅ |
| 6 | 子导航面板 Framer Motion 动画进入（opacity+x） | ✅ |
| 7 | 再次点击同一组图标 → 子导航关闭 | ✅ |
| 8 | 点击子导航中工具条目 → 对应面板打开，子导航关闭 | ✅ |
| 9 | 面板已打开时，对应条目显示"已打开"badge（蓝色） | ✅ |
| 10 | 一级分组图标在面板打开时高亮（is-active） | ✅ |
| 11 | 子导航底部显示未来工具预告文本（不可点击） | ✅ |
| 12 | 打开 Director 子导航时，Add 菜单自动关闭 | ✅ |
| 13 | 镜头词典/变体规划器/角色锁定面板功能保持不变 | ✅ |
| 14 | 面板互斥逻辑保持（由 workspace 管理，与 Task 4 一致） | ✅ |
| 15 | User 菜单正常（打开子导航时 user 菜单关闭） | ✅ |
| 16 | Add 节点菜单正常（+ 按钮）| ✅ |
| 17 | Stop All Generations 按钮逻辑不变 | ✅ |
| 18 | 右侧工具栏仍只保留 Generate Readiness Check（Settings 不变） | ✅ |
| 19 | 图片/视频/文字生成链路无回归 | ✅ |

### Safety Boundary

- 不新增工具功能 ✅
- 不自动触发生成 ✅
- 不消耗 credits ✅
- 不新增 API ✅
- 不改 schema ✅
- 不改 generate routes ✅
- 不改 provider adapter ✅
- 不改 billing / credits / payment ✅
- 不影响 Tool 1 / Tool 2 / Tool 3A / Tool 4 / Media Preview Fallback ✅
- 不影响 Text / Image / Video 生成链路 ✅
- cn-executor 未改动 ✅
- 仅 `CanvasToolDock.tsx` 内部重构

---

## Workflow Connection Context Tools + Stronger Edges — IMPLEMENTED / browser validation pending

**Commits:** `94db55e` (initial) → `a195f41` (fix: position:fixed) | **Date:** 2026-06-06  
**Files changed:** `CanvasFlowEdge.tsx`, `VisualCanvasWorkspace.tsx`, `canvas.module.css`, `edge-director.ts`  
**New API / schema / billing / generate routes:** 无

**首轮验收问题：** Stronger Edges ✅ 通过；Context Tools ❌ 未出现  
**根因：** 上下文 UI 渲染在 canvas 坐标空间内，35% zoom 时 10px 文字变为 3.5px，视觉不可见  
**修复 (`a195f41`)：** 改为 `position: fixed` 渲染（同 AssetAgentToolbar 模式），`upstreamContextFixedStyles` useMemo 将 canvas 坐标转换为屏幕坐标，pan/zoom 变化时自动重算

### 连接线视觉增强（✅ 浏览器验收通过）

| 方面 | 改动前 | 改动后 |
|---|---|---|
| 默认颜色 | 白色渐变（几乎不可见）| 蓝色渐变 `rgba(130,160,255,0.62)`（清晰可见）|
| 默认 stroke-width | 1.0 | 1.8 |
| 默认 opacity | 0.56 | 0.76 |
| Hover | 无 | stroke-width 2.8 + glow filter |
| Active | 细线 + 虚线 | 同色 + drop-shadow + 动画 |
| 方向感 | 无 | arrowhead marker（SVG marker，orient=auto）|

### 上下文工具入口（fix 后待复验）

触发条件（同时满足）：
- target node 是 image 或 video
- 存在 edge 从某个 source 连到 target
- source.kind 是 image 或 video
- source 有任意之一：`resultImageUrl` / `resultVideoUrl` / `assetId` / `prompt`（放宽，新建任务框也触发）

触发后：在 target 节点卡片正下方显示 `position: fixed` pill 行（不受 canvas zoom 影响）。  
工具路由：角色/变体 → focusPromptForNode(source)；镜头 → focusPromptForNode(target)

人物检测关键词（source.prompt）：`人|人物|角色|女孩|男孩|女|男|girl|boy|man|woman|person|portrait|face|character|child`

| 状态 | 标签 | 按钮样式 |
|---|---|---|
| 人物上游 | `↑ 角色参考可用` | 角色锁定（amber）+ 资产变体 + 镜头语言 |
| 普通上游 | `↑ 基于上一节点` | 资产变体 + 镜头语言 |

点击行为：
- 角色锁定 → `focusPromptForNode(target)` + `setIsCharacterLockOpen(true)` 
- 资产变体 → `focusPromptForNode(target)` + `setIsVariantPlannerOpen(true)`
- 镜头语言 → `focusPromptForNode(target)` + `setIsLexiconOpen(true)`

严格约束：
- 不自动注册角色卡 ✅
- 不自动追加 prompt ✅
- 不自动触发生成 ✅
- 不消耗 credits ✅
- 不新增 API / 不改 schema ✅
- 不改 generate routes / provider adapter / billing ✅

### Validation Checklist (22 criteria)

| # | 验收项 | 状态 |
|---|---|---|
| 1 | 连接线比之前更明显（蓝色 + 更粗）| pending |
| 2 | 连接线 hover 时高亮变粗 | pending |
| 3 | 连接线有方向感（箭头指向目标节点）| pending |
| 4 | 左侧工具仍按 Director / Asset / Character 分组 | pending |
| 5 | 右侧工具栏仍只保留生成前体检 | pending |
| 6 | 有资产的 image/video 上游连到 image/video 下游时出现工具入口 | pending |
| 7 | 入口包含角色锁定 / 资产变体 / 镜头语言 | pending |
| 8 | 点击角色锁定打开 Character Lock panel | pending |
| 9 | 点击资产变体打开 Asset Variant Planner panel | pending |
| 10 | 点击镜头语言打开 Camera Lexicon panel | pending |
| 11 | 人物上游连接到下游时显示"↑ 角色参考可用"+ amber 样式按钮 | pending |
| 12 | 不自动注册角色 | pending |
| 13 | 不自动追加 prompt | pending |
| 14 | 不自动触发生成 | pending |
| 15 | 不消耗 credits | pending |
| 16 | 不新增 API | pending |
| 17 | 不改 schema | pending |
| 18 | 不改 generate routes | pending |
| 19 | 不改 provider adapter | pending |
| 20 | 不改 billing/credits/payment/schema | pending |
| 21 | Tool 1/2/3A/4 / Tool Dock Grouping / Media Preview Fallback 无回归 | pending |
| 22 | Text/Image/Video 生成无回归 | pending |

---

## Workflow Continue Options in Source Menu — CLOSED / validated

**Commit:** `f607a53`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-06
**Date validated:** 2026-06-06

### 问题背景

旧方案（`1133c2b`）把"继续创作"按钮放在已有 target 节点卡片内部。但用户从 source 拖线时，target 尚未创建，因此入口完全不可见——浏览器验收发现用户只能看到普通的"文本生成 / 图片生成 / 视频生成 / 音频 / 3D 世界"五个选项，看不到任何工作流继续创作入口。

### 修复方案

将"继续创作"三个选项直接接入"引用该节点生成"菜单顶部（`nodeAddMenu`）。用户从 source 节点拖出连线时即可选择，不依赖 target 节点已经存在。

新增 `handleWorkflowCreateAndOpen` callback：
- 创建下游 target 节点（image 或 video，根据工具类型）
- 通过 `parentNodeId` 自动建立 source → target edge
- 设置 `workflowContext = { sourceNodeId, targetNodeId: newNode.id }`
- 打开对应 tool panel（CharacterLockPanel / AssetVariantPlannerPanel / CameraLexiconPanel）
- 清除 `nodeAddMenu` 状态

菜单结构改为两段：
1. **来源摘要**：显示 source 节点标题 + prompt 前 24 字
2. **继续创作**（source 有 prompt/resultImageUrl/resultVideoUrl/assetId 时出现）：角色参考生成 / 资产变体生成 / 镜头语言生成
3. **新建任务**：文本生成 / 图片生成 / 视频生成 / 音频 / 3D 世界（原有，保留不变）

### 验收结果

| 验收项 | 结果 |
|---|---|
| 从 source image 节点拖线后菜单顶部出现"继续创作"区 | ✅ |
| 继续创作区包含：角色参考生成 / 资产变体生成 / 镜头语言生成 | ✅ |
| 原"新建任务"区保留：文本生成 / 图片生成 / 视频生成 / 音频 / 3D 世界 | ✅ |
| 点击"角色参考生成"→ 创建 image target 节点 + 建立 edge + 打开 CharacterLockPanel | ✅ |
| CharacterLockPanel 顶部显示 source→target workflow 上下文 banner | ✅ |
| 点击"资产变体生成"→ 创建 target 节点 + 建立 edge + 打开 AssetVariantPlannerPanel | ✅ |
| AssetVariantPlannerPanel 追加 Prompt 写入 target，不写入 source | ✅ |
| 点击"镜头语言生成"→ 创建 video target 节点 + 建立 edge + 打开 CameraLexiconPanel | ✅ |
| CameraLexiconPanel 插入词条写入 target，不写入 source | ✅ |
| 不自动注册角色 | ✅ |
| 不自动追加 prompt（用户在 panel 内点击才写入） | ✅ |
| 不自动触发生成 | ✅ |
| 不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不改 schema | ✅ |
| 不改 generate routes | ✅ |
| 不改 provider adapter | ✅ |
| 不改 billing / credits / payment / schema | ✅ |
| 左侧工具仍分组，不新增一级图标 | ✅ |
| 右侧仍只保留生成前体检 | ✅ |
| type-check / lint / build 全部通过 | ✅ |

### 安全边界确认

- 未修改 `/api/generate/*`（text / image / video）
- 未修改 cn-executor
- 未修改 billing / credits / reserve / finalize / refund
- 未修改 provider adapter 真实调用逻辑
- 未修改 payment / Stripe / 支付宝 / 微信
- 未新增 Prisma 表或字段
- 未新增 API 路由
- 工具写入由 `workflowContext.targetNodeId` 路由到下游 target，不写入 source

### 修改文件（共 1 个）

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | `handleWorkflowCreateAndOpen` callback + 菜单两段重构（+77/-3 行） |

---

## Next Phase Tasks

### ~~Tool 5 — A/B Compare / Version Compare Panel~~ — ✅ CLOSED / validated (commit `66da5b5`)

### ~~Tool 6 — Keyframe Extractor / 关键帧提取器~~ — ✅ CLOSED / validated (commit `ccb5f42`, build fix `9e9b340`)

### ~~Tool 7 — Shot List Builder / 分镜清单生成器~~ — ✅ CLOSED / validated (commits `26f8d16` · `5cfb912` · `97ff477`)

### ~~Tool 8 — Continuity Checker / 连贯性检查器~~ — ✅ CLOSED / validated (commit `1e9b737`)

### ~~Tool 9 — Prompt Booster / 提示词增强器~~ — ✅ CLOSED / validated (commit `6e1a24f`, validated 2026-06-07)

### ~~Tool 10 — Sequence Board / 镜头序列编排器~~ — ❌ REMOVED / not validated (commit `37a43da`, 2026-06-07)

原因：产品评审后判断为冗余（与 Shot List Builder + Continuity Checker + 画布连线顺序重叠），已从 UI 完全撤下。

### ~~Tool 10 — Batch Prompt Rewriter / 批量 Prompt 重写器~~ — ✅ CLOSED / validated (commit `e3c3a2b`, readability fix `e5bb57a`, validated 2026-06-07)

- Prompt 分组（PencilLine 图标），提示词增强器下方第二项
- 支持 text / image / video 节点批量 append prompt
- 支持 6 维度：风格统一 / 质感画质 / 负向约束 / 画幅构图 / 镜头语言 / 自定义
- 两步确认：生成预览 → 应用到 X 个节点
- 重复检测：alreadyContains 节点自动跳过
- 追加格式：`[Batch Prompt Rewriter - 维度]\n内容`
- 可复制批量修改报告
- Replace mode：not implemented / future
- 修复追加内容 textarea 可读性（深底浅字 + colorScheme:dark）
- 不自动生成，不消耗 credits，不新增 API，不改 schema/generate/provider/billing/cn-executor
- 27 条验收全部通过

### Tool 11 — Look Package Applier / 视觉风格包应用器 — IMPLEMENTED / browser validation pending

- Prompt 分组第三子工具（批量 Prompt 重写器下方，🎨 视觉风格包）
- 10 个风格包覆盖 6 个分类（导演风格 · 胶片模拟 · LUT调色 · 品牌商业 · 建筑空间 · 社交摄影）
- 分类过滤 tab，风格包卡片网格（CSS渐变色块色板 + 名称 + 标签）
- 风格包详情（描述 · 对比度 · 饱和度 · 适用/不适用）
- 节点勾选（默认只勾 image/video，text 默认不勾）
- 两步确认：「生成预览」→ 预览结果 →「确认应用」
- hasSimilarLook 重复检测（image prompt fragment 前40字 case-insensitive）
- 追加格式：`[Look Package - {name}]\n{imageOrVideoFragment}\n\n[Look Negative Constraints]\n{negativeConstraints}`
- 可复制应用报告
- 不自动生成，不消耗 credits，不新增 API，不改 schema/generate/provider/billing/cn-executor

**文件变动：**

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/look-packages.ts` | 新建：LookPackage 类型 + 10个风格包数据 + 辅助函数 |
| `apps/web/src/components/create/LookPackagePanel.tsx` | 新建：完整 Panel 组件 |
| `apps/web/src/components/create/CanvasToolDock.tsx` | Prompt 分组新增「视觉风格包」第三项；onOpenPromptTool 类型加 look-package |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | 导入 LookPackagePanel；isLookPackageOpen state；handler；render block |

**Prompt 分组当前子工具：**
1. ✨ 提示词增强器（Prompt Booster）
2. ⚡ 批量 Prompt 重写器（Batch Prompt Rewriter）
3. 🎨 视觉风格包（Look Package Applier）← 新增

---

## Canvas Smart Tools Tool 6 — Keyframe Extractor — CLOSED / validated

**功能 commit:** `ccb5f42`
**Build fix commit:** `9e9b340` (react/no-unescaped-entities — 弯引号导致 Vercel build 失败，改为「」)
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-06
**Date validated:** 2026-06-06

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/components/create/KeyframeExtractorPanel.tsx` | 关键帧提取器面板 |

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | Asset 分组新增"关键帧提取"子菜单项 |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | `isKeyframeExtractorOpen` state、panel render、onCreateNode 回调 |

### 功能说明

- 从 Asset 分组（Layers 图标）子菜单选择"关键帧提取"打开面板
- 只列出 video 节点（有 resultVideoUrl / assetId / prompt）
- 非 video 节点时显示"请选择视频节点"空状态
- video 预览：无自动播放，显示 controls，`crossOrigin="anonymous"`
- CORS 失败时显示 fallback，不 crash
- 快捷时间点：起始帧（0s）/ 中间帧（50%）/ 结尾帧（95%）/ 当前帧
- 预览当前帧：canvas.drawImage → toDataURL('image/jpeg', 0.88)
- 复制时间点 / 复制关键帧说明到剪贴板
- 创建图片草案节点：`createNode('image', { prompt, title, parentNodeId })`，自动建 edge，状态 idle
- 创建视频续作草案节点：`createNode('video', { prompt, title, parentNodeId })`，自动建 edge，状态 idle
- 定位视频节点：setActiveNodeId + canvasPan 平移
- 不自动生成，不消耗 credits，不上传 OSS，不新增 API

### 差异化说明

| 工具 | 作用对象 | 目的 |
|---|---|---|
| A/B Compare | 已有 image/video 节点 | 比较两版生成结果，分析 prompt 差异 |
| Keyframe Extractor | 已有 video 节点 | 从视频中提取某帧，作为下一步图片/视频参考 |
| Asset Variant Planner | 已有 image/video 节点 | 规划未来变体方向 |

### 安全边界确认

- 不改 cn-executor / generate routes / billing / credits / schema / provider adapter
- 不上传 OSS，不新增后端 API，不改 Prisma 表
- 不伪造 assetId，不自动生成，不消耗 credits

### 浏览器验收重点

| # | 步骤 | 预期结果 |
|---|---|---|
| 1 | 点击左侧 Layers 图标 | 展开 Asset 子菜单，包含 资产变体规划器/版本对比/关键帧提取 |
| 2 | 点击"关键帧提取" | KeyframeExtractorPanel 打开 |
| 3 | 无 video 节点 | 显示"请选择视频节点"空状态 |
| 4 | 有 video 节点，且当前节点是 video | 默认选中当前 video 节点 |
| 5 | 视频预览 | 不自动播放，显示 controls |
| 6 | 点击"起始帧/中间帧/结尾帧/当前帧" | 视频跳到对应时间，当前时间标签更新 |
| 7 | 点击"预览当前帧"（视频加载成功） | 显示帧截图 |
| 8 | CORS 阻止截帧 | 显示 amber fallback 文字，不 crash |
| 9 | 点击"复制时间点" | 剪贴板含时间字符串 |
| 10 | 点击"创建图片节点草案" | 画布新增 image 节点，prompt 含关键帧参考，状态 idle，建 edge |
| 11 | 点击"创建视频续作节点草案" | 画布新增 video 节点，prompt 含续作说明，状态 idle，建 edge |
| 12 | 新节点不自动生成 | 状态保持 idle，无生成请求 |
| 13 | 点击"定位到视频节点" | 画布平移到选中视频节点 |
| 14 | 关闭面板（× 按钮或背景遮罩） | 面板关闭 |
| 15 | Tool 1/2/3A/4/5 及生成链路 | 无回归 |

### 问题背景

专业 AI 视频工作流中，用户经常需要从已生成视频中截取一帧，作为下一镜头图片参考或视频续作起点。旧流程需要下载视频、手动截图、再上传，摩擦大。Keyframe Extractor 让用户在画布内完成这件事，不产生额外 API 调用或费用。

### 验收结果（2026-06-06）

| 验收项 | 结果 |
|---|---|
| Asset 分组出现"关键帧提取"入口 | ✅ |
| 不新增左侧一级图标 | ✅ |
| 右侧工具栏仍只保留生成前体检 | ✅ |
| 非 video 节点时显示空状态，不报错 | ✅ |
| video 预览不自动播放，含 controls | ✅ |
| 快捷时间点（0s / 50% / 95% / 当前帧）可用 | ✅ |
| 浏览器端当前帧预览（drawImage）可用 | ✅ |
| CORS 截帧失败显示 fallback，不 crash | ✅ |
| 可复制当前帧时间点 | ✅ |
| 可复制关键帧说明 | ✅ |
| 可创建 image 草案节点，prompt 写入关键帧参考 | ✅ |
| source video → image edge 自动建立 | ✅ |
| 可创建 video 续作草案节点 | ✅ |
| source video → video edge 自动建立 | ✅ |
| 新草案节点状态 idle，不自动生成 | ✅ |
| 不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不上传 OSS | ✅ |
| 不改 schema / generate routes / provider adapter / billing | ✅ |
| 不改 cn-executor | ✅ |
| Tool 1/2/3A/4/5 及生成链路无回归 | ✅ |

### 安全边界（完整）

- 不自动生成
- 不消耗 credits
- 不新增 API
- 不上传 OSS
- 不伪造 assetId
- 不删除或覆盖原视频节点
- 不改原视频 prompt
- 不自动注册角色
- 不改 schema / generate routes / provider adapter / billing / cn-executor

### Asset 分组当前已包含工具

| 工具 | 状态 |
|---|---|
| 资产变体规划器（Asset Variant Planner） | ✅ validated |
| 版本对比（A/B Compare） | ✅ validated |
| 关键帧提取（Keyframe Extractor） | ✅ validated |

### Director 分组当前已包含工具

| 工具 | 状态 |
|---|---|
| 镜头词典（Camera Lexicon） | ✅ validated |
| 分镜清单生成器（Shot List Builder） | ✅ validated |
| 连贯性检查器（Continuity Checker） | ✅ validated |

---

## Canvas Smart Tools Tool 8 — Continuity Checker — CLOSED / validated

**Commit:** `1e9b737`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-06
**Date validated:** 2026-06-06

### 功能说明

纯规则引擎连贯性分析，无 API 调用，无生成，不消耗 credits。从 6 个维度检查画布中 image/video/text 节点的连续性问题：

| 维度 | 检查内容 |
|---|---|
| 角色一致性（characters） | 角色词汇前后节点消失、角色性别前后不一致 |
| 场景/地点（location） | 室内/户外/宇宙等场景类型跳变（无转场说明） |
| 时间线（timeline） | 昼夜时段切换（白天→夜晚，无说明） |
| 风格/色调（style） | 3+ 种不同视觉风格分散在各节点 |
| 镜头语言（shotLanguage） | 连续 3+ 个节点同一景别（全景/中景/近景/特写） |
| 资产状态（assetHealth） | 节点 error/failed、done 无输出、image/video 无 assetId |

### 评分机制

`score = 100 - risk×20 - warn×10 - info×3`，最低 0。

| 分段 | 文案 |
|---|---|
| ≥85 | 连贯性良好，未发现明显冲突 |
| ≥70 | 整体连贯，有少量需关注的地方 |
| ≥50 | 存在一些连贯性问题，建议检查标注节点 |
| <50 | 连贯性风险较高，建议仔细检查各分类问题 |

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/continuity-check.ts` | 纯规则引擎（类型 + 6 维检查函数 + analyzeContinuity + buildContinuityReportText） |
| `apps/web/src/components/create/ContinuityCheckerPanel.tsx` | 固定左侧面板：评分环 + 6-section 2列网格 + issue列表 + 定位节点按钮 + 复制报告 |

### 修改文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | Director 分组新增「连贯性检查器」菜单项 |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | import + isContinuityCheckerOpen state + handler + render block |

### 安全边界确认

- 未修改任何生成路由（text/image/video）
- 未修改 billing / credits / payment / cn-executor / schema
- 纯前端只读分析，无网络请求
- type-check / lint / build 全部通过（commit `1e9b737`）

### 问题背景

用户在多节点画布中需要检查角色、地点、时间、风格、镜头语言是否前后连贯。这是导演工作流中"多镜头一致性检查"的核心能力，不是自动生成工具。

### 实现方案

- 在 Director 分组（Clapperboard 图标）子菜单加入「连贯性检查器」
- 新增本地规则引擎 `continuity-check.ts`，分析 text/image/video 节点和 edges
- 新增 `ContinuityCheckerPanel`，输出 overallScore、6 维分类网格、issue 列表、定位节点和复制报告
- 不接入任何 AI API，无生成，无网络请求，不消耗 credits

### 浏览器验收结果（2026-06-06 通过）

| 验收项 | 结果 |
|---|---|
| Director 分组出现连贯性检查器 | ✅ |
| 不新增一级图标 | ✅ |
| 右侧仍只保留生成前体检 | ✅ |
| 少于 2 个可检查节点时显示空状态 | ✅ |
| 多节点时显示 overallScore | ✅ |
| 显示角色一致性分类 | ✅ |
| 显示场景/地点分类 | ✅ |
| 显示时间线分类 | ✅ |
| 显示风格/色调分类 | ✅ |
| 显示镜头语言分类 | ✅ |
| 显示资产状态分类 | ✅ |
| issue 显示 RISK / WARN / INFO badge | ✅ |
| 定位节点可平移到问题节点 | ✅ |
| 重新检查可刷新结果 | ✅ |
| 复制检查报告可复制中文报告 | ✅ |
| 不自动修改 prompt | ✅ |
| 不自动创建节点 | ✅ |
| 不自动生成 | ✅ |
| 不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不上传 OSS | ✅ |
| 不改 schema / generate routes / provider adapter / billing | ✅ |

---

## Canvas Smart Tools Tool 7 — Shot List Builder — CLOSED / validated

**功能 commit:** `26f8d16`
**UX controls fix commit:** `5cfb912` (textarea 可读性修复 + 分镜拆分要求控制区)
**Editable source text fix commit:** `97ff477` (来源文本框改为可编辑，字数不限)
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-06
**Date validated:** 2026-06-06

### 问题背景

用户需要把剧本、Text 节点内容或自定义故事文本拆成可执行镜头任务。初始版本存在两个问题：
1. 来源文本框只读，不能粘贴或编辑自定义内容
2. 分镜拆分像固定卡片，没有让用户指定数量/类型/节奏/景别的入口

### 最终方案

- 在 Director 分组（Clapperboard 图标）子菜单加入 Shot List Builder
- 来源文本框改为完全可编辑 textarea（无字数限制），支持用户粘贴任意剧本/文案
- 切换来源节点时更新文本框内容，但不自动重新拆分
- 用户可通过「使用来源节点文本」恢复，或「清空」清空，均不影响原节点
- 分镜拆分要求控制区：数量 3/5/8/自定义、输出类型、节奏、景别策略、补充要求
- 点击「按要求重新拆分」后，以用户编辑后的文本 + 当前设置为准生成分镜
- 文本为空时显示 amber 错误提示，不生成假分镜
- 点击「创建草案节点」后才创建 idle image/video 节点 + source edge

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/components/create/ShotListBuilderPanel.tsx` | 分镜清单生成器面板（含可编辑来源文本区 + 分镜拆分控制） |
| `apps/web/src/lib/canvas/shot-list.ts` | 纯函数：parseShotList(options) / buildShotListReport / SHOT_SIZE_LABELS 等 |

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | 新增 Director 分组（Clapperboard 图标）+ 子菜单：镜头词典 + 分镜清单生成器 |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | `isShotListBuilderOpen` state、`onOpenDirectorTool` prop、`ShotListBuilderPanel` render |

### 功能说明（最终版）

- Director 分组 → 分镜清单生成器打开面板
- A. 来源节点选择：下拉选择画布内有文本内容的任意节点
- B. 分镜文本输入：可编辑 textarea，初始值来自选中节点，支持用户任意修改/粘贴，字数不限
  - 「使用来源节点文本」：恢复为节点原始文本
  - 「清空」：清空输入框，不影响原节点
  - 修改来源文本框不会写回原节点
- 分镜拆分要求控制区：
  - 分镜数量：3 / 5 / 8 / 自定义（1–12）
  - 输出类型：图片分镜 / 视频分镜 / 图片+视频混合
  - 节奏：慢节奏电影感 / 标准叙事 / 短视频快节奏
  - 景别策略：自动 / 全景→特写 / 多特写 / 多全景
  - 补充要求：自由文字（支持"6个镜头"/"快节奏"/"多特写"等关键词自动解析）
- 点击「按要求重新拆分」：以当前 sourceDraftText + options 生成分镜清单
- 分镜卡片可编辑：kind toggle / shotSize / description / cinematicNote / duration（视频）
- 全选/全不选/单独 checkbox 选择
- 点击「创建 N 个草案节点」：仅 selected 镜头创建 idle 节点 + source edge，显示创建数反馈
- 复制分镜清单：报告含拆分设置 + 来源文本摘要（前 200 字）+ 补充要求 + 每镜内容
- 不自动生成，不消耗 credits，不上传 OSS，不新增 API

### 验收结果（2026-06-06）

| 验收项 | 结果 |
|---|---|
| Director 分组出现分镜清单生成器入口 | ✅ |
| 不新增左侧一级图标 | ✅ |
| 右侧仍只保留生成前体检 | ✅ |
| 来源节点选择器正常 | ✅ |
| 来源文本框可编辑（textarea，字数不限） | ✅ |
| 支持粘贴任意长度自定义剧本/文案 | ✅ |
| 编辑来源文本不修改原节点 | ✅ |
| 「使用来源节点文本」可恢复原节点文本 | ✅ |
| 「清空」只清空输入框，不改原节点 | ✅ |
| 文本为空时点击重新拆分显示提示，不生成假分镜 | ✅ |
| 分镜数量 3/5/8/自定义（1–12）可选 | ✅ |
| 输出类型（图片/视频/混合）可选 | ✅ |
| 节奏（慢节奏/标准/快节奏）可选 | ✅ |
| 景别策略（自动/全景→特写/多特写/多全景）可选 | ✅ |
| 用户补充要求进入分镜备注及复制报告 | ✅ |
| 点击「按要求重新拆分」后分镜清单更新 | ✅ |
| 分镜卡片 kind/shotSize/description/cinematicNote 可编辑 | ✅ |
| 视频镜头显示 duration 选择，图片不显示 | ✅ |
| 可创建 image/video 草案节点，建 source edge | ✅ |
| 新节点状态 idle，不自动生成 | ✅ |
| 不消耗 credits | ✅ |
| 复制报告含拆分设置 + 来源文本摘要 + 补充要求 | ✅ |
| 镜头词典菜单项正常打开 Camera Lexicon | ✅ |
| 不新增 API | ✅ |
| 不上传 OSS | ✅ |
| 不改 schema / generate routes / provider adapter / billing | ✅ |
| 不改 cn-executor | ✅ |
| Tool 1/2/3A/4/5/6 及生成链路无回归 | ✅ |

### 安全边界

- 不自动生成
- 不消耗 credits
- 不新增 API
- 不上传 OSS
- 不删除或覆盖原节点
- 不改原节点 prompt
- 不改 schema / generate routes / provider adapter / billing / cn-executor

---

## Canvas Smart Tools Tool 5 — A/B Compare Panel — CLOSED / validated

**Commit:** `66da5b5`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-06
**Date validated:** 2026-06-06

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/components/create/ABComparePanel.tsx` | 版本对比面板 |
| `apps/web/src/lib/canvas/compare-utils.ts` | 纯函数：analyzePromptDiff / buildCompareReport / isComparableNode |

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | Asset 分组新增"版本对比"子菜单项 |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | `isABCompareOpen` state、`onOpenAssetTool` prop、`ABComparePanel` render |

### 功能说明

- 从 Asset 分组（Layers 图标）子菜单选择"版本对比"打开面板
- 选择两个 image/video 节点，并排展示：缩略图 / 元数据 / prompt 预览
- Prompt 差异分析：A/B 独有关键词 + 人物/镜头/光线/情绪词 DiffBadge
- 标记胜出版本（本地 state，不写 DB）
- 复制对比报告到剪贴板
- 定位节点（setActiveNodeId + canvasPan）
- 不自动生成，不消耗 credits，不新增 API，不改 generate/billing/schema

### 安全边界确认

- 不改 cn-executor / generate routes / billing / credits / schema / provider adapter
- 不上传 OSS，不新增后端 API，不改 Prisma 表

### 浏览器验收重点

| # | 步骤 | 预期结果 |
|---|---|---|
| 1 | 点击左侧 Layers 图标 | 展开 Asset 子菜单 |
| 2 | 点击"版本对比" | ABComparePanel 打开，`left-[80px] top-1/2` |
| 3 | 下拉选择器 | 只列出 image/video 有内容节点 |
| 4 | 选择两节点 | 并排显示缩略图 + prompt 差异 |
| 5 | 点击"⭐ 选为胜出" | 页脚显示推荐版本 |
| 6 | 点击"复制对比报告" | 剪贴板含格式化报告文本 |
| 7 | 点击"定位节点" | 画布平移并激活该节点 |
| 8 | 点击背景遮罩 | 面板关闭 |
| 9 | 视频节点 | 显示 video 元素，无自动播放 |
| 10 | 其他工具（Tool 1/2/3A/4）| 无回归 |

---

## Forbidden Areas (do not touch)

- `apps/cn-executor` — China executor, separate deploy
- `/api/generate/image`, `/api/generate/video` — generation routes
- `apps/web/src/lib/billing/` — billing, reserve, settle logic
- `apps/web/src/lib/credits/` — credit deduction
- Payment / Stripe / Alipay / WeChat
- Prisma schema / migrations
- `package.json` / `pnpm-lock.yaml`
- `.env` files
- Provider adapter real call logic
- Adding new providers
- Changing `providerId` / `modelId` / credit amounts

---

## Stable Baseline (do not regress)

Modules confirmed working as of `8119eb0`:

- Canvas node CRUD (add / edit / delete / drag / connect)
- Image generation chain (prompt → POST → poll → display)
- Video generation chain (prompt → POST → poll → display)
- Text generation chain (DeepSeek default, Kimi, OpenAI fallback)
- Text generation — platform credits mode (unchanged, original logic)
- Text generation — BYOK mode (DeepSeek / OpenAI / Kimi via user's own API Key)
- Image generation — BYOK mode (Seedream via user's Volcengine Ark API Key + Endpoint ID) [✅ browser validated 2026-06-03]
- UsageLog Phase S1 — BYOK + platform_credits usage recording (Text + Image, no fee deduction)
- Admin Usage Dashboard — `/admin/usage` read-only view (total, byok, platform_credits, success rate, provider distribution, top users, recent logs) [✅ browser validated 2026-06-03]
- Canvas save / load (PUT/GET with localStorage draft fallback)
- Canvas save 503 backoff (10s, no cascade)
- Media proxy (`/api/media/proxy`) for cross-region OSS display
- Session auth (Supabase + Prisma, with pgBouncer pool guard)
- Session persistence on transient DB error (no spurious logout)
- Provider quota error → friendly Chinese message + DeepSeek CTA
- Asset failure panel → friendly titles + `/assets` recovery link
- DeepSeek as default text provider for new nodes
- `/assets` page listing all generated assets with recovery status
- Customer delivery share URL follows `NEXT_PUBLIC_APP_URL` (CN-safe)
- `/account/providers` — 模型账户中心：CRUD + test connection + BYOK management + capability matrix + 3-mode billing explanation [✅ browser validated 2026-06-03]
- `/account/providers` auth guard — Zustand session shown immediately; server check async; unknown+no-session shows retry UI [✅ browser validated 2026-06-04]
- `/account/providers/[id]` — Provider Account Detail: identity + health status + masked credentials (last4 / fieldMeta) + 90-day usage summary + recent 20 call log; userId+providerAccountId double-scope; no key/prompt exposure; UsageLog graceful degradation [✅ browser validated 2026-06-04]
- `/api/provider-accounts/[id]/summary` — read-only summary API; safe fields only; ownership enforced; UsageLog failure returns usageSummaryUnavailable:true [✅ browser validated 2026-06-04]
- `/account/usage` — User Usage History: time/billing/type filters, summary cards, distribution panels, recent log table; userId-scoped; no prompt/key exposure [✅ browser validated 2026-06-04]
- User avatar dropdown → "生成用量" direct entry [✅ browser validated 2026-06-04]
- Provider API Key guide in canvas help panel (4-tab, 18 providers)
- AI Agent floating button — API Key keyword replies + quick actions
- `/account` — 3-mode billing legend (平台额度 / 我的 API / 平台服务费) below quick-links grid [✅ validated 2026-06-04]
- `/account/credits` — clarification box above WalletBalanceCard: platform credits only; BYOK Provider fees paid direct to vendor; service fee = 0/未启用 [✅ validated 2026-06-04]
- `/account/providers/[id]` — Health Guidance: getHealthExplanation (secondary text below health.message) + getRepairTips 建议操作 section (auth/quota/endpoint/timeout/unsupported/high-fail coverage; links to /help/api-keys and /projects) [✅ validated 2026-06-04]
- `/account/providers` — Health hint chips on abnormal accounts (auth_failed→请检查 API Key, quota→请检查 Provider 余额, missing endpointId→请补充接入点 ID, high fail rate→最近有失败记录); normal accounts show no chip [✅ validated 2026-06-04]
- `/help/api-keys` — FAQ section renamed "出错了怎么办？"; 3 new entries (Seedream unsupported test, timeout, BYOK service fee clarification) [✅ validated 2026-06-04]
- cn-executor video logs — sanitized via `safeLogVideoJob`; no signed URL slices, no responseBody; `hasByokCredential: false` in start log [✅ validated 2026-06-04]
- Video BYOK feature flag — `ENABLE_SEEDANCE_VIDEO_BYOK` (defaults false when env var absent); requests with `billingMode=user_provider_account` rejected with 403 `VIDEO_BYOK_NOT_ENABLED` [✅ validated 2026-06-04]

---

## Canvas Smart Tools Tool 9 — Prompt Booster — CLOSED / validated

**功能 commit:** `6e1a24f`
**docs commit:** `2752e50`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-06
**Date validated:** 2026-06-07

### 问题背景

- 用户经常不知道当前 prompt 差在哪里——生成结果平庸但不知从何改起。
- 镜头词典（Camera Lexicon）是用户主动选词插入，而 Prompt Booster 是诊断当前 prompt 的结构完整度，两者定位不重复。

### 实现方案

- 新增 Prompt / 提示词分组（PencilLine 图标），独立于 Asset / Director 分组
- 在 Prompt 分组下加入 Prompt Booster 作为唯一子工具
- 新增本地规则引擎 `apps/web/src/lib/canvas/prompt-booster.ts`（纯函数，无 API 调用）
- 新增 `apps/web/src/components/create/PromptBoosterPanel.tsx`
- 支持 text / image / video 节点，分别检查不同维度
- 输出评分（0-100）、PASS/WARN/MISSING 检查清单、增强建议卡片、可复制中文报告
- 评分公式：`score = 100 - 15×missing - 8×warn`，最低 0
- 用户点击「追加到 Prompt」追加，重复片段检测防二次追加，不自动覆盖
- 不自动生成，不消耗 credits，不新增 API，不上传 OSS，不改 schema / generate / provider / billing / cn-executor

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/prompt-booster.ts` | 纯规则引擎（analyzePromptBoost / buildPromptBoostReportText / textAlreadyContains） |
| `apps/web/src/components/create/PromptBoosterPanel.tsx` | 提示词增强器面板 |

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | 新增 Prompt 分组（PencilLine 图标 + 提示词增强器子菜单项） |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | import + state + handler + render block |

### 检查维度

**image（7 维）：** 主体 / 场景 / 构图景别 / 光线 / 色调风格 / 质量质感 / 负向约束

**video（7 维）：** 主体 / 场景 / 动作 / 运镜 / 时长节奏 / 连续性 / 负向约束

**text（6 维）：** 主题 / 目标格式 / 受众平台 / 语气风格 / 输出结构 / 长度约束

### Prompt 分组当前子工具

| 工具 | 状态 |
|---|---|
| 提示词增强器（Prompt Booster） | ✅ validated |

### 验收表（2026-06-07 浏览器验收通过）

| 验收项 | 结果 |
|---|---|
| 左侧出现 Prompt 分组（PencilLine 图标） | ✅ |
| Prompt 分组下出现「提示词增强器」 | ✅ |
| 不放到 Asset / Director 分组 | ✅ |
| 右侧仍只保留生成前体检 | ✅ |
| image 节点显示 image 专属 7 维检查 | ✅ |
| video 节点显示 video 专属 7 维检查 | ✅ |
| text 节点显示 text 专属 6 维检查 | ✅ |
| 显示 Prompt 完整度评分 | ✅ |
| 分数颜色区分（≥80 emerald / ≥50 amber / <50 red） | ✅ |
| 显示 PASS/WARN/MISSING 检查清单 | ✅ |
| 显示增强建议卡片 | ✅ |
| 可复制建议片段 | ✅ |
| 点击后才追加到 prompt | ✅ |
| 追加不覆盖原 prompt（末尾追加 + 分隔标记） | ✅ |
| 重复建议不重复追加（textAlreadyContains 检测） | ✅ |
| 可忽略建议（本会话 dismissed Set） | ✅ |
| 可重新分析（dismissed 重置，report 更新） | ✅ |
| 可复制中文检查报告 | ✅ |
| 不自动生成 | ✅ |
| 不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不上传 OSS | ✅ |
| 不改 schema / generate routes / provider adapter / billing / cn-executor | ✅ |

### 安全边界确认

- 不自动生成
- 不消耗 credits
- 不新增 API
- 不上传 OSS
- 不删除或覆盖原节点
- 不自动修改 prompt，除非用户点击「追加到 Prompt」
- 不自动创建节点
- 不自动注册角色
- 不改 schema / generate routes / provider adapter / billing / cn-executor

---

## Canvas Smart Tools Tool 10 — Sequence Board — REMOVED / not validated

**Implement commit:** `6d5e44c`
**Remove commit:** `37a43da`
**Status:** ❌ REMOVED / not validated / removed from UI after product review
**Date implemented:** 2026-06-07
**Date removed:** 2026-06-07

**移除原因：** 用户产品评审后判断为冗余。Sequence Board 的顺序管理功能与以下已有工具重叠：
- Shot List Builder（分镜清单，创建草案顺序）
- Continuity Checker（连续性审查）
- 画布连线本身（连线即表示节点顺序关系）

**处置：** Director 子菜单入口已删除，SequenceBoardPanel.tsx 和 sequence-board.ts 源文件已删除，VisualCanvasWorkspace 中的 import / state / handler / render 均已清除。

### 差异化说明

| 工具 | 作用 |
|---|---|
| Shot List Builder | 从文字描述拆出草案镜头（创建新内容） |
| Sequence Board | 把已存在的真实节点/资产编排成最终顺序（序列化已有资产） |
| A/B Compare | 两节点资产优劣对比 |
| Continuity Checker | 多节点一致性审查 |

### 功能说明

把画布中已有的 text/image/video 节点整理成一个作品镜头序列。不自动生成，不导出真实视频，不消耗 credits。

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/sequence-board.ts` | 纯函数助手（buildDefaultSequence / topologicalSort / totalDurationSeconds / formatDuration / buildSequenceReportText） |
| `apps/web/src/components/create/SequenceBoardPanel.tsx` | 镜头序列编排器面板 |

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | Director 分组新增「镜头序列编排器」子菜单项；onOpenDirectorTool 类型加 sequence-board |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | import + state + handler + render block |

### 默认序列生成规则

1. 只含 `status === 'done'` 的 image/video 节点
2. 若存在连接线（edges），按 Kahn 拓扑排序确定顺序
3. 孤立节点（无连线）按插入顺序附加
4. text 节点默认不加入，可手动从节点池加入

### Director 分组当前子工具

| 工具 | 状态 |
|---|---|
| 镜头词典（Camera Lexicon） | ✅ validated |
| 分镜清单生成器（Shot List Builder） | ✅ validated |
| 连贯性检查器（Continuity Checker） | ✅ validated |
| 镜头序列编排器（Sequence Board） | ✅ IMPLEMENTED / browser validation pending |

### 浏览器验收重点

| # | 步骤 | 预期结果 |
|---|---|---|
| 1 | Director 分组子菜单 | 出现「镜头序列编排器」第四项 |
| 2 | 不在 Asset / Prompt 分组 | 确认 |
| 3 | 右侧工具栏 | 仍只保留生成前体检 |
| 4 | 打开面板 | 显示序列总览（镜头数/正片/备选/待重做/总时长） |
| 5 | 可加入节点池 | 显示未入序列的 text/image/video 节点 |
| 6 | 加入 image/video 节点 | 节点进入序列列表，从池移除 |
| 7 | 加入 text 节点 | 节点进入序列列表 |
| 8 | 序列项显示缩略图 | image 显示缩略图，video 显示播放占位，text 显示文本图标 |
| 9 | video 不自动播放 | 确认 autoPlay=false |
| 10 | 上移/下移 | 序列顺序改变 |
| 11 | 移出序列 | 节点回到节点池 |
| 12 | role 切换 | 正片/备选/待重做/参考 正确显示 |
| 13 | 时长修改 | 总时长随之更新 |
| 14 | 填写备注 | 备注保存在该镜头 |
| 15 | 定位节点 | 画布平移到对应节点并高亮 |
| 16 | 复制镜头清单 | 剪贴板含中文 Markdown 清单 |
| 17 | 重新从画布生成序列 | 序列重置为当前画布 done 节点 |
| 18 | 不自动修改 prompt | 确认 |
| 19 | 不自动创建节点 | 确认 |
| 20 | 不自动删除节点 | 确认 |
| 21 | 不自动生成 | 确认 |
| 22 | 不消耗 credits | 确认 |
| 23 | 不新增 API | 确认 |
| 24 | 不上传 OSS | 确认 |
| 25 | 不改 schema | 确认 |
| 26 | 不改 generate routes | 确认 |
| 27 | 不改 provider adapter / billing | 确认 |
| 28 | Tool 1/2/3A/4/5/6/7/8/9 无回归 | 确认 |
| 29 | Text/Image/Video 生成无回归 | 确认 |
| 30 | type-check / lint / build 通过 | ✅ 已确认 |

### 安全边界确认

- 不自动生成
- 不消耗 credits
- 不新增 API
- 不上传 OSS
- 不删除或覆盖原节点
- 不自动修改 prompt
- 不自动创建节点
- 不改 schema / generate routes / provider adapter / billing / cn-executor

---

## Canvas Smart Tools Tool 10 — Batch Prompt Rewriter — CLOSED / validated

**功能 commit:** `e3c3a2b`
**Textarea readability fix commit:** `e5bb57a`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-07
**Date validated:** 2026-06-07

### 问题背景

- 用户需要对多个已有节点批量追加统一风格、质感、负向约束、画幅或镜头语言。
- 单节点 Prompt Booster 只能诊断一个 prompt，不能跨画布执行批量修改。
- Prompt Templates 已明确不需要；本工具不是静态模板库。

### 实现方案

- 在 Prompt 分组（PencilLine 图标）加入 Batch Prompt Rewriter，位于提示词增强器下方。
- 新增 `batch-prompt-rewriter.ts` 纯函数 helper（previewBatchAppend / hasSimilarAppend / buildBatchAppendText / buildBatchRewriteReportText / DIMENSION_LABELS / QUICK_CHIPS）。
- 新增 `BatchPromptRewriterPanel.tsx`。
- 支持 text / image / video 节点选择（running/pending 节点默认不勾选并显示警告）。
- 支持维度选择（6 个）、追加内容输入、生成预览（before/after）、重复检测（hasSimilarAppend 前 40 字符检测）、确认应用、复制报告。
- MVP 只追加，不替换（replace mode: future）。
- 追加格式：`[Batch Prompt Rewriter - 维度]\n内容`。
- 修复追加内容 textarea 可读性：`bg-white/4`（透明白底被浏览器覆盖为白色）→ `bg-[#10131a]` + `text-slate-100` + `colorScheme:dark` + 显式 placeholder/caret。

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/batch-prompt-rewriter.ts` | 纯函数 helper |
| `apps/web/src/components/create/BatchPromptRewriterPanel.tsx` | 批量 Prompt 重写器面板 |

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | Prompt 分组新增「批量 Prompt 重写器」子菜单项；onOpenPromptTool 类型加 batch-rewriter |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | import + isBatchRewriterOpen state + handler + render block |

### Prompt 分组当前子工具

| 工具 | 状态 |
|---|---|
| 提示词增强器（Prompt Booster） | ✅ validated |
| 批量 Prompt 重写器（Batch Prompt Rewriter） | ✅ validated |

### 差异化说明

| 工具 | 作用对象 | 目的 |
|---|---|---|
| Prompt Booster | 单节点 | 诊断 prompt 缺失维度，用户点击追加建议 |
| Batch Prompt Rewriter | 多节点批量 | 把同一风格/质感/负向词批量追加到多个节点 |
| Camera Lexicon | 单节点 | 插入专业镜头词汇 |

### 验收记录

| # | 验收项 | 结果 |
|---|---|---|
| 1 | Prompt 分组出现批量 Prompt 重写器 | ✅ |
| 2 | 不出现在 Asset / Director 分组 | ✅ |
| 3 | 右侧仍只保留生成前体检 | ✅ |
| 4 | 显示"只追加，不替换"安全提示 | ✅ |
| 5 | text/image/video 节点可选择 | ✅ |
| 6 | 可按类型筛选 | ✅ |
| 7 | 可全选 / 只选 Image / 只选 Video / 清空选择 | ✅ |
| 8 | 支持风格、质感、负向、画幅、镜头、自定义维度 | ✅ |
| 9 | 追加内容 textarea 字体清晰可见 | ✅ |
| 10 | placeholder 和光标清晰可见 | ✅ |
| 11 | 快捷 chip 内容进入 textarea 后可见 | ✅ |
| 12 | 未生成预览不能应用 | ✅ |
| 13 | 预览显示 before / after | ✅ |
| 14 | 已存在类似片段显示跳过 | ✅ |
| 15 | 应用后批量 patch prompt | ✅ |
| 16 | 追加不覆盖原 prompt | ✅ |
| 17 | 重复内容不重复追加 | ✅ |
| 18 | 显示更新 X / 跳过 Y | ✅ |
| 19 | 可复制批量修改报告 | ✅ |
| 20 | 不支持 replace | ✅ |
| 21 | 不自动创建节点 | ✅ |
| 22 | 不自动删除节点 | ✅ |
| 23 | 不自动生成 | ✅ |
| 24 | 不消耗 credits | ✅ |
| 25 | 不新增 API | ✅ |
| 26 | 不上传 OSS | ✅ |
| 27 | 不改 schema/generate/provider/billing | ✅ |

### 安全边界确认

- 不自动生成
- 不消耗 credits
- 不新增 API
- 不上传 OSS
- 不删除或覆盖原节点
- 不覆盖原 prompt，只追加
- 不支持 replace
- 不自动创建节点
- 不自动注册角色
- 不改 schema / generate routes / provider adapter / billing / cn-executor

---

## Canvas Smart Tools Tool 11 — Look Package Applier — CLOSED / validated

**功能 commit:** `a8d6c10`
**节点对话框顶部入口 commit:** `888d9dd`
**Preserve Original Subject / Asset 修复 commit:** `55aebc9`
**应用反馈/重新生成说明修复 commit:** `0610a1e`
**Token overflow 修复（紧凑中文格式）commit:** `75a1771`
**中文关键词 + 分类维度选择 commit:** `27552ca`
**空 Prompt 节点警告 commit:** `2ee0a67`
**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-07
**Date validated:** 2026-06-07

### 问题背景

- 用户希望升级调色/视觉风格能力，不能只是静态模板或简单套色。
- 需要可作用于 image/video 节点的专业 Look Package，风格词必须对模型有实际影响。
- 初版验收发现仅追加风格词会导致主体漂移（人物/道具被替换）；补充主体保护约束后解决。
- 用户后续反馈"应用后没有反应"：Look Package 只改 prompt，需要重新生成才生效；修复为明确 UI 提示。
- Token overflow：verbose 5段英文格式 (~120词) + Character Lock 注入超出 Seedream Image 有效 prompt 限制；修复为紧凑中文4行格式 (~50词)。
- 用户要求风格词用中文，且可按维度（调色/光线/质感/氛围）选择只追加部分。

### 实现方案

- 在 Prompt 分组（PencilLine 图标）加入 Look Package Applier，位于 Batch Prompt Rewriter 下方。
- 在 image/video 节点编辑框顶部导航加入渐变色点"视觉风格"快捷入口，点击预选当前节点。
- 新增 `apps/web/src/lib/canvas/look-packages.ts`（纯函数数据层，无 API 调用）。
- 新增 `apps/web/src/components/create/LookPackagePanel.tsx`。
- MVP 内置 10 个高辨识度 Look 共 6 分类：
  - 导演风格：库布里克冷峻对称 / 王家卫霓虹怀旧
  - 胶片模拟：Kodak Vision3 胶片模拟 / 富士 Velvia 风光
  - LUT调色：青橙好莱坞 / 褪色独立电影
  - 品牌商业：苹果极简白 / 奢华暗金
  - 建筑空间：北欧混凝土极简
  - 社交摄影：黄金时刻生活流
- 每个 Look 包含：中文名/英文名/分类/标签/适用类型/视觉描述/对比度/饱和度/调色/光线/质感/氛围中文关键词/CSS渐变色块/image prompt fragment/video prompt fragment/negative constraints/适用场景/不适用场景/风险/用户预期。
- 4 维度中文关键词（调色/光线/质感/氛围）可独立勾选，只追加选中的维度。
- 追加格式（紧凑中文）：`[视觉风格: nameZh]\n{选中维度中文关键词}\n保留原始人物身份、面部、服装、姿势和构图不变。\n禁止替换主体，禁止改变构图，禁止改变人物身份。`
- 应用前必须生成预览（两步确认）；应用后只追加 prompt，不覆盖原 prompt。
- 重复 Look 检测（`hasSimilarLook`：`[视觉风格: nameZh]` 头 / `[Look: name]` 旧格式头 / 前40字符三路检测）；已含类似片段自动跳过。
- 空 Prompt 节点警告：检测只有风格词无主体描述的节点，显示 amber 警告提示写主体描述。
- 支持复制应用报告。

### 新增文件

| 文件 | 说明 |
|---|---|
| `apps/web/src/lib/canvas/look-packages.ts` | Look Package 纯数据 + 纯函数（类型 / 10个 Look 数据 / filterLookPackages / buildLookAppendText / hasSimilarLook / previewLookApply / buildLookApplyReportText） |
| `apps/web/src/components/create/LookPackagePanel.tsx` | 视觉风格包面板 |

### 修改文件

| 文件 | 改动说明 |
|---|---|
| `apps/web/src/components/create/CanvasToolDock.tsx` | Prompt 分组新增「视觉风格包」子菜单项；onOpenPromptTool 类型加 look-package |
| `apps/web/src/components/create/CanvasPromptBox.tsx` | 节点对话框顶部导航新增渐变色"视觉风格"按钮（image/video 节点显示） |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | import + state + handler + onApplyLook + render block |

### Prompt 分组当前子工具

| 工具 | 状态 |
|---|---|
| 提示词增强器（Prompt Booster） | ✅ validated |
| 批量 Prompt 重写器（Batch Prompt Rewriter） | ✅ validated |
| 视觉风格包（Look Package Applier） | ✅ validated |

### 验收表（2026-06-07 浏览器验收通过）

| 验收项 | 结果 |
|---|---|
| Prompt 分组出现视觉风格包 | ✅ |
| 不出现在 Asset / Director 分组 | ✅ |
| image/video 节点顶部出现渐变色"视觉风格"入口 | ✅ |
| text 节点不显示 | ✅ |
| 右侧仍只保留生成前体检 | ✅ |
| MVP 只显示 10 个精选 Look | ✅ |
| Look 卡片显示中文名、英文名、类别、色彩条、描述、对比度、饱和度 | ✅ |
| 可按分类筛选 | ✅ |
| 点击 Look 后显示详情 | ✅ |
| 详情含 4 维度切换 chip（调色/光线/质感/氛围） | ✅ |
| 取消所有维度 → 生成预览按钮 disabled | ✅ |
| 可选择 image/video 节点 | ✅ |
| 当前节点快捷入口默认选中当前节点 | ✅ |
| 未生成预览不能应用 | ✅ |
| 预览显示 before / after | ✅ |
| 追加格式为紧凑中文（[视觉风格: nameZh] + 选中维度 + 保留主体 + 禁止替换） | ✅ |
| 已存在类似 Look 显示跳过 | ✅ |
| 应用后批量 patch prompt | ✅ |
| 追加不覆盖原 prompt | ✅ |
| 重复内容不重复追加 | ✅ |
| 空 Prompt 节点显示 amber 警告（提示补充主体描述） | ✅ |
| UI 明确说明需要重新生成才会看到效果 | ✅ |
| UI 不承诺 100% 保持原图不变 | ✅ |
| 可复制应用报告 | ✅ |
| 不支持 replace | ✅ |
| 不自动创建节点 | ✅ |
| 不自动删除节点 | ✅ |
| 不自动生成 | ✅ |
| 不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不上传 OSS | ✅ |
| 不调用 vision AI | ✅ |
| 不改 schema/generate/provider/billing | ✅ |
| type-check 通过 | ✅ |

### 安全边界确认

- 不自动生成
- 不消耗 credits
- 不新增 API
- 不上传 OSS
- 不调用 vision AI
- 不删除或覆盖原节点
- 不覆盖原 prompt，只追加
- 不支持 replace
- 不自动创建节点
- 不自动注册角色
- 不承诺 100% 保持原图，仅通过 prompt 约束降低主体漂移
- 不改 schema / generate routes / provider adapter / billing / cn-executor

### 已知限制（non-blocking，已在 UI 中说明）

- 真正"原图只改色不换主体"需要图生图/参考图/vision/provider 能力，不能只靠 prompt 保证。
- Look Package 只改 prompt；当前已生成图片不会自动变化；用户必须点击重新生成。
- 若节点 Prompt 为空（无主体描述），只有风格词无法驱动模型生成有效图片；UI 显示 amber 警告。
- Look Package V2 可扩展到 30+ Look，但必须在 MVP 稳定后，且高级风格迁移须先评估 vision 能力。

### Next Phase — Tool 12 — Look Strength Control / 视觉风格强度控制

不继续堆静态 Look 数量，下一步在现有 Look 框架内增加强度控制：

| 强度级别 | 说明 | 实现方式 |
|---|---|---|
| 轻度调色 | 只改 color grade / contrast / saturation / black levels / highlight roll-off | 只追加 colorGrade 维度关键词 + 轻量约束 |
| 中度风格 | 调色 + 光线氛围 + 胶片质感 | 追加 colorGrade + lighting + texture 三维度 |
| 强风格化 | 允许更明显导演风格，但仍加入主体保护 | 四维度全追加 + 较宽泛主体保护约束 |

实现约束：不新增 API / schema / provider capability；不自动生成；不消耗 credits；只改 prompt 追加逻辑。

**评估后高级版方向（Tool 12+ 之后，需单独确认）：**

| 高级版方向 | 前提 |
|---|---|
| Reference-preserving Style Transfer / 参考保护式风格迁移 | 需要图生图/参考图/vision provider 能力 |
| Style Bible Extract & Apply / 风格圣经提取与应用 | 需要 vision model 接入，单独评估 |
| Vision-based Color Analysis / 视觉色彩分析 | 需要 vision model 接入，单独评估 |
| Product/Character Consistency Guard / 主体一致性保护 | 需要 vision 或参考图能力 |
| Look Package V2（30+ Look） | MVP 稳定后 |

---

## Shot List Builder 批量草案节点布局修复 — CLOSED / validated

**Commit:** `2cf744a`
**Status:** ✅ CLOSED / validated
**Date validated:** 2026-06-07

### 问题背景

Shot List Builder 批量创建草案节点（`onCreateNode` 多次调用）时，所有新节点堆叠在画布同一位置，用户无法分辨各节点，需手动拖开。

### 根因分析

`resolveNonOverlappingPosition` 读取的是 React `nodes` 状态（渲染周期快照），而 `commitNodes` 用 `latestNodesRef.current` 做函数式更新（同步）。批量创建时，第 N 次调用 `createNode` 时 `nodes` 状态尚未反映第 1...N-1 个刚创建的节点，所有调用都算出相同的 `basePosition`，最终所有节点落在同一坐标。

### 修复方案

在 `ShotListBuilderPanel.tsx` 中为每次 `onCreateNode` 调用传入 `index` 和 `total`；在 `VisualCanvasWorkspace.tsx` 的 `onCreateNode` handler 里，**提前用 index 计算各节点独立坐标**，绕过 `resolveNonOverlappingPosition` 的过时状态问题：

- 父节点存在时：从父节点右侧 240px 展开，以父节点 y 为中心纵向排列，每节点间距 340px
- 无父节点时：从视口中心计算基准点，纵向排列（最多 5 行后换列，列间距 460px）
- 节点间距（340px 垂直 / 460px 水平）均大于最大节点尺寸（320px 高 / 380px 宽），不重叠

### 修改文件

| 文件 | 改动 |
|---|---|
| `apps/web/src/components/create/ShotListBuilderPanel.tsx` | `onCreateNode` 调用传入 `index` 和 `total` |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | `onCreateNode` handler 计算每节点独立 `position` |

### 验收结果

| 验收项 | 结果 |
|---|---|
| 批量创建 3 个节点，3 个节点各自独立，不重叠 | ✅ |
| 批量创建 5 个节点，纵向整齐排列 | ✅ |
| 超过 5 个节点，自动换列 | ✅ |
| 有父节点时，新节点从父节点右侧排列 | ✅ |
| 无父节点时，新节点从视口中心区域排列 | ✅ |
| 单个节点创建行为不变 | ✅ |
| type-check 通过 | ✅ |

---

## Canvas Smart Tools Tool 12 — Color Grade Palette / 调色盘 — CLOSED / validated

**Status:** ✅ CLOSED / validated
**Date implemented:** 2026-06-07
**Date validated:** 2026-06-08
**Key commits:** `a8753b4` · `46831e3` · `c5cefed` · `7a26d8d` · `d221df6` · `e08a09f` · `65a4152` · `c74e7e9` · `2c4fd15`

### 问题背景

- 用户要求调色不要混在视觉风格包（Look Package）里。视觉风格包负责风格化；调色盘负责曝光、影调、色彩、曲线、质感等后期调色控制。
- 用户要求参考 DaVinci Resolve Color Page 的专业调色逻辑，但不能做像素级复制或商标/UI 复制。
- 初版（`a8753b4`）UI 像参数表，不像专业 Color Page，浏览器验收失败。
- 改为 Post Suite 入口（`46831e3`）+ Color Page 工作台（Wheels/Curves/Qualifier/Texture/Output）。
- 用户反馈预览太小、拖动控件视觉变化不明显（`c5cefed` `7a26d8d` 修复）。
- Preview Monitor 直接用 OSS URL 导致黑屏，加 getProxiedMediaUrl 修复（`c74e7e9`）。
- fixed 容器无 height 导致 flex-1 媒体区高度解析为 0，图片回退 auto 缩略图（`2c4fd15` 修复）。
- 左侧 Clip Strip 移除（`e08a09f`），单节点模式，调色仅针对打开面板的当前节点。
- "创建调色节点"改为"应用调色到画布"，新节点继承原资产 URL + status=done + CSS filter 存 metadataJson（`65a4152`）。

### 实现方案

- image/video 节点顶部 AssetAgentToolbar"剪辑 → Post Suite → 调色盘"入口打开面板。
- 不新增左侧 Editing 一级入口（已移除）。
- 自定义 pointer-event 色轮，未使用 @uiw/react-color-wheel。
- 数据结构 ASC CDL-aligned：temperature/tint/luminance: -1..+1；saturation: 0..4 (1=neutral)。
- `buildPreviewCssFilter` 从平均值改为加权求和，避免单 wheel 操作被稀释（offset weight 1.2x）。
- Preview Monitor 通过 `/api/media/proxy` 代理 OSS URL，inline CSS filter 绑定到 img/video。
- Preview Monitor 可 resize（position: fixed + resize: both），设置 height: 520 初始值防止 flex 高度坍塌。
- "应用调色到画布"：新节点继承 resultImageUrl / resultVideoUrl（status=done），colorGradeCssFilter 存 metadataJson，CanvasNodeCard 读取后 apply 到 img/video。
- 未来路线：Tool 12.5 WebGL LUT preview → Tool 13 FFmpeg worker + LUT3D → 长期 OpenColorIO / AI LUT。

### 未来专业调色引擎路线

| 阶段 | 技术 | 状态 |
|------|------|------|
| Tool 12 (当前) | Prompt-level grading only | ✅ 在做 |
| Tool 12.5 | WebGL LUT preview (glsl-lut / glfx.js) | 📋 规划 |
| Tool 13 | FFmpeg worker + lut3d (.cube export) | 📋 规划 |
| 长期 | OpenColorIO + IA-NILUT AI LUT | 📋 远期 |

### 定位

Color Grade Palette 是 image/video 节点后期套件（Post Suite）下的专业调色工具，通过 AssetAgentToolbar "剪辑" 入口访问。

- **不是 Look Package**（Look Package 是导演风格包）
- **不是 Prompt Booster**（Prompt Booster 是提示词增强）
- **不是 Batch Prompt Rewriter**（批量改写工具）
- **不是风格化工具**
- 是把 DaVinci Resolve Color Page 工作流转译成 Creator City 可用的 **Prompt 级调色控制**

### 研究基础

基于 DaVinci Resolve Color Page 深度研究报告（官方手册 + 专业教程，本机未安装 DaVinci），覆盖：
- Primary Wheels（Lift/Gamma/Gain/Offset/Temp/Tint/Contrast/Pivot/Saturation/Color Boost/Midtone Detail）
- HDR Wheels（6个分区）
- Curves（S-Curve / Hue vs Hue / Hue vs Sat / Luma vs Sat）
- Qualifier / HSL 选择器
- Power Windows / Scopes / Gallery / Stills / LUTs
- 5 条专业调色工作流（Neutral Rec709 / Soft Cinematic / Low Key Night / High Key Commercial / Skin Tone Protection）

### 已验收能力矩阵

| 能力 | 状态 |
|------|------|
| image/video 节点顶部"剪辑 → Post Suite → 调色盘"入口 | ✅ validated |
| 当前节点默认选中，无需再在面板里选 | ✅ validated |
| 左侧无独立 Editing / 调色盘入口 | ✅ validated |
| Color Page 工作台结构（Wheels/Curves/Qualifier/Texture/Output 标签） | ✅ validated |
| Primary Wheels：Lift / Gamma / Gain / Offset 色轮 | ✅ validated |
| 每 wheel：visual puck + Temp / Tint / Lum / Sat slider | ✅ validated |
| Curves 标签：曲线 SVG 图 + Contrast Curve 5 选项 + RGB Bias | ✅ validated |
| Qualifier 标签：HSL 色彩范围参考条 + 皮肤保护 toggle + Greens/Blues | ✅ validated |
| Texture 标签：sharpness / midtone detail / grain / halation / glow / vignette / clean shadows | ✅ validated |
| Output 标签：locked subject/face/product/composition protection | ✅ validated |
| Intent Monitor（waveform/vectorscope/saturation bar，明确 no pixel analysis） | ✅ validated |
| Preview Monitor 显示当前 image/video（OSS URL 通过 /api/media/proxy 代理） | ✅ validated |
| Preview Monitor CSS filter approximation 实时跟随色轮拖动 | ✅ validated |
| Preview Monitor 可拖拽调整大小（position: fixed, resize: both, height: 520 初始） | ✅ validated |
| Preview Monitor 高度修复（不再缩成缩略图） | ✅ validated |
| filter string 实时显示 / neutral 时显示 neutral (no filter) | ✅ validated |
| Preview filter only / 非最终输出 safety label | ✅ validated |
| 拖动 OFFSET / LIFT / GAMMA / GAIN Temp/Lum/Sat 有明显视觉变化 | ✅ validated |
| 应用调色到画布（新节点继承原资产 URL，status=done，CSS filter 存 metadataJson） | ✅ validated |
| CanvasNodeCard 读取 colorGradeCssFilter 并 apply 到 img/video | ✅ validated |
| Prompt Preview 包含 7 段落（[Color Grade Palette] [Primary Wheels] [Curves] [Qualifier Intent] [Texture] [Output Protection] [Color Grade Negative Constraints]） | ✅ validated |
| [Primary Wheels] 替代旧 [Primary / Tone Intent] | ✅ validated |
| 追加到 Prompt 只追加不覆盖原 prompt | ✅ validated |
| 已有 [Color Grade Palette] 段落跳过，不自动替换 | ✅ validated |
| 不自动生成 / 不消耗 credits / 不新增 API / 不调用 vision AI | ✅ validated |
| 不接 WebGL/glfx/FFmpeg/OCIO / 不做真实像素级输出 | ✅ validated |
| 不改 schema / generate routes / provider adapter / billing / cn-executor | ✅ validated |
| Tool 1–11 无回归 | ✅ validated |

**Future（不在 Tool 12 内）：** Tool 12.5 WebGL/LUT Preview · Tool 13 FFmpeg worker + LUT3D · 长期 OpenColorIO / IA-NILUT AI LUT

### 6 个调色预设

| 预设 ID | 中文名 | 调色风格 |
|---------|--------|---------|
| `neutral-rec709-clean` | 中性广播级 | 自然准确，皮肤色调正确，纪录片/企业视频 |
| `soft-cinematic-s-curve` | 柔和电影感 | 暖高光冷阴影，低饱和胶片感，叙事短片/MV |
| `low-key-night-film` | 夜景低调电影 | 深黑高对比重饱和冷色，惊悚/黑色电影 |
| `high-key-commercial` | 高调商业广告 | 明亮开放高饱和，美妆/科技产品广告 |
| `warm-portrait-protection` | 暖调人像保护 | 肤色隔离保护，暖调细腻，人像/美妆 |
| `teal-orange-classic` | 青橙好莱坞经典 | 阴影青蓝高光暖橙，动作/商业片 |

预设不包含导演名（王家卫/库布里克）或胶片品牌（Kodak）等 Look Package 风格名。

### Prompt 输出格式

```
[Color Grade Palette]

[Primary / Tone Intent]
...

[Saturation]
...

[Curve Intent]
...

[HSL Intent]
...

[Output Protection]
preserve original subject, composition, and characters unchanged,
adjust only color grading and tonal quality,
no changes to scene content or layout

[Color Grade Negative Constraints]
do not alter subject identity, facial features, body proportions, or scene objects,
do not change lighting direction or shadow placement from original composition,
do not introduce new colors unrelated to the selected grade,
no subject replacement, no face change, no product redesign, no composition change
```

### 安全边界

| 安全项 | 状态 |
|--------|------|
| prompt-level only，不直接改像素 | ✅ |
| 不自动生成，不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不调用 vision AI | ✅ |
| 不改 schema / generate routes / provider / billing | ✅ |
| 不改 cn-executor | ✅ |
| Output Protection 始终追加，不可关闭 | ✅ |
| 只追加 prompt，不覆盖原 prompt | ✅ |
| 已有 [Color Grade Palette] 段落 → MVP 跳过，不自动替换 | ✅ |
| 应用后需重新生成才生效 | ✅ UI 明确说明 |

### 修改文件

| 文件 | 说明 |
|------|------|
| `apps/web/src/lib/canvas/color-grade-palette.ts` | 新增：类型定义 / 6个预设数据 / prompt builder / 预览逻辑 |
| `apps/web/src/components/create/ColorGradePalettePanel.tsx` | 新增：完整调色盘 UI 面板 |
| `apps/web/src/components/create/CanvasToolDock.tsx` | 新增：Editing 剪辑分组 + SlidersHorizontal 图标 + 调色盘入口 |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | 新增：isColorGradePaletteOpen state + render + onOpenEditingTool handler |

### 安全边界（已验收）

| 安全项 | 状态 |
|--------|------|
| prompt-level only，不直接改像素 | ✅ |
| 不自动生成，不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不调用 vision AI | ✅ |
| 不改 schema / generate routes / provider / billing | ✅ |
| 不改 cn-executor | ✅ |
| Output Protection 始终追加，不可关闭 | ✅ |
| 只追加 prompt，不覆盖原 prompt | ✅ |
| 已有 [Color Grade Palette] 段落 → MVP 跳过，不自动替换 | ✅ |
| 应用后需重新生成才生效 | ✅ UI 明确说明 |
| Preview Monitor：CSS filter approximation only，不保存为资产，不 OSS upload | ✅ |
| 不伪造 assetId | ✅ |
| 不接 WebGL / glfx / FFmpeg / OpenColorIO | ✅ |

### Next Phase

当前 Color Suite / Tool 12 / Look Package Applier 归位 / 调色草案节点 / 预览即时生效文案均已 CLOSED / validated。不继续打磨 Tool 12 / Color Suite UI。用户明确要求避免提示词方向，推荐进入以下非提示词方向二选一：

| 工具 | 状态 | 说明 |
|------|------|------|
| Tool 12.5 — WebGL / LUT Preview（glsl-lut / glfx.js 近似预览） | 📋 待单独评估 | 需评估许可证/OSS/队列；不应塞进当前 Tool 12 |
| Tool 13 — FFmpeg worker + LUT3D 媒体处理 | 📋 待单独评估 | 需评估部署/许可证/成本；不应塞进当前 Tool 12 |
| OpenColorIO color pipeline | 📋 远期 | 长期规划 |
| IA-NILUT / VideoColorGrading AI LUT | 📋 远期 | 长期 AI 调色规划 |
| Reference-preserving Style Transfer | 📋 远期 | 需图生图/vision provider |

> **注意：** FFmpeg / OpenColorIO / IA-NILUT / VideoColorGrading 不应塞进当前 Tool 12 / Color Suite。Tool 12.5 / Tool 13 必须单独评估部署、许可证、成本、OSS、队列后再立项。

---

## Color Suite / 调色入口 — CLOSED / validated

**Date validated:** 2026-06-08
**Status:** ✅ CLOSED / validated

### 关键 commits

| commit | 描述 |
|--------|------|
| `a8753b4` | Tool 12 Phase 1 初版（Color Grade Palette · Editing 分组入口） |
| `5c9e6ef` | Preview section / 成功提示修复（7 个 prompt 段落始终输出） |
| `46831e3` | Color Page 工作台重构 / 节点顶部后期入口（从左侧 Dock 移至节点对话框） |
| `c5cefed` | Preview Monitor 初版 + CSS filter 反馈 |
| `7a26d8d` | Preview filter 显著化 + 可调整大小浮动预览窗 |
| `2c4fd15` | Preview Monitor 高度修复，解决图片缩成缩略图问题（fixed 容器需要显式 height） |
| `e08a09f` | 移除 Clip Strip，Color Grade Palette 改为单节点模式 |
| `d221df6` | 创建调色草案节点（create color grade draft nodes · idle · 不自动生成） |
| `65a4152` | 调色输出资产直接到画布（done-status 节点继承 resultImageUrl/resultVideoUrl + metadataJson.colorGradeCssFilter · "创建调色节点保存到画布"工作流完整） |
| `c74e7e9` | Preview Monitor OSS CORS 修复（getProxiedMediaUrl） |
| `b053a84` | 视觉风格包归入节点顶部"调色 / Color Suite"入口；Prompt 分组移除视觉风格包；LookPackagePanel 改为单节点模式；"剪辑"定位确立为"调色" |

### 问题背景

- 用户认为节点顶部"剪辑"入口命名不准确，当前开放的是调色盘和视觉风格包，而非剪辑。
- 用户要求将入口改名为"调色"，定位为 Color Suite / 调色套件。
- 用户要求视觉风格包从 Prompt 分组迁入该入口，只服务当前单选 image/video 节点。
- Prompt 分组只保留真正的 Prompt 工具（Prompt Booster / Batch Prompt Rewriter）。
- 用户要求调色盘不要只停留在预览/Prompt，而是能创建独立调色节点保存到画布，供下游节点使用。
- 用户指出 Preview Monitor 已经即时生效（CSS filter approximation 实时渲染），因此 Tool 12 不应继续写"调色需要重新生成后才生效"作为主语义。正确语义：调色预览立即生效；创建调色节点将方案保存到画布；正式模型结果由用户在新调色节点中手动生成。

### 当前 Color Suite 入口结构

- image/video 节点顶部工具栏（AssetAgentToolbar）→ 点击"调色"→ 弹出 Color Suite 菜单
- 菜单包含：
  - **🎛 调色盘**（Color Grade Palette）— 参数调色（曝光/影调/色轮/曲线/质感/输出保护）
  - **🎨 视觉风格包**（Look Package Applier）— 电影/胶片/广告/空间 Look
- 两者均为当前节点单选工作流，不批量操作
- **调色盘（Color Grade Palette）语义：**
  - Preview Monitor CSS filter 即时生效（浏览器近似效果，实时渲染）
  - "创建调色节点"将方案保存为画布中的独立草案节点（idle · 不自动生成 · 不消耗 credits）
  - 如需正式模型图片/视频结果，用户在新调色节点中手动生成
  - 不再将"需要重新生成后才生效"作为主语义
- **视觉风格包（Look Package Applier）语义：**
  - prompt-level Look 追加，应用后用户需手动生成查看正式模型结果
- 不自动生成，不消耗 credits，不新增 API，不调用 vision AI
- 不接 WebGL / glfx / FFmpeg / OpenColorIO
- 不改 schema / generate routes / provider adapter / billing

### Tool 12 — Color Grade Palette 已验收能力

| 能力 | 状态 |
|------|------|
| 从 image/video 节点顶部"调色 → 调色盘"打开 | ✅ |
| 当前节点默认选中（单节点模式，无多选） | ✅ |
| Primary Wheels：Lift / Gamma / Gain / Offset（visual puck + Temp/Tint/Lum/Sat） | ✅ |
| Curves 标签（简化曲线图） | ✅ |
| Qualifier 标签（HSL 色彩范围条） | ✅ |
| Texture 标签（sharpness / midtone detail / grain / halation / glow / vignette / clean shadows） | ✅ |
| Output 标签（locked subject / face / product / composition protection） | ✅ |
| Intent Monitor（明确 no pixel analysis） | ✅ |
| Preview Monitor（显示当前 image/video，支持 CSS filter approximation） | ✅ |
| Preview Monitor 可调整大小 | ✅ |
| Preview Monitor fixed 容器高度修复（explicit height，解决图片缩成缩略图） | ✅ |
| filter string 实时显示；neutral 时显示 neutral (no filter) | ✅ |
| Preview filter only / 非最终输出标签可见 | ✅ |
| 拖动参数后预览图片/视频有明显 CSS filter 变化（即时生效） | ✅ |
| Preview Monitor CSS filter 即时生效，不需要重新生成才能看到预览变化 | ✅ |
| 可创建调色草案节点保存到画布（"创建调色节点"按钮） | ✅ |
| 调色草案节点出现在画布中，状态 idle | ✅ |
| 原节点与调色草案节点建立 edge | ✅ |
| 调色草案节点不伪造 assetId | ✅ |
| 调色草案节点不自动生成，不消耗 credits | ✅ |
| 用户可在新调色节点中手动生成正式模型图片/视频结果 | ✅ |
| done-status 调色节点继承 resultImageUrl/resultVideoUrl（CSS filter 覆盖原素材预览） | ✅ |
| CSS filter 存储在 metadataJson.colorGradeCssFilter，CanvasNodeCard 渲染时应用 | ✅ |
| Prompt 包含全部 7 段：[Color Grade Palette] / [Primary Wheels] / [Curves] / [Qualifier Intent] / [Texture] / [Output Protection] / [Color Grade Negative Constraints] | ✅ |
| 已有 [Color Grade Palette] 段落 → 跳过，不自动替换 | ✅ |
| 只追加 prompt，不覆盖原 prompt | ✅ |
| 不自动生成，不消耗 credits，不新增 API，不调用 vision AI | ✅ |
| 不接 WebGL / glfx / FFmpeg / OpenColorIO | ✅ |
| 不改 schema / generate routes / provider / billing | ✅ |

### Tool 11 — Look Package Applier 归位已验收能力

| 能力 | 状态 |
|------|------|
| 视觉风格包已从 Prompt 分组迁入节点顶部"调色 / Color Suite"入口 | ✅ |
| Prompt 分组不再显示视觉风格包，避免与 Prompt Booster / Batch Rewriter 混淆 | ✅ |
| image/video 节点顶部"调色"菜单显示"🎨 视觉风格包" | ✅ |
| 从当前 image/video 节点打开后，LookPackagePanel 绑定当前节点（单节点模式） | ✅ |
| 不显示多节点选择 UI，不显示批量应用控件 | ✅ |
| 显示当前节点目标 banner（节点名 + 关系说明） | ✅ |
| 关系说明：视觉风格包改 Prompt 风格词 · 调色盘改色彩参数，两者互补可叠加 | ✅ |
| 选择 Look 后 Prompt Preview 保留 Preserve Original Subject / Asset | ✅ |
| 保留 Look Negative Constraints | ✅ |
| 点击"追加到当前 Prompt"只追加当前节点 prompt | ✅ |
| 不覆盖原 prompt | ✅ |
| 已有类似 Look 时提示 / 跳过，不自动替换 | ✅ |
| 应用后提示需重新生成查看效果 | ✅ |
| Prompt Booster 不受影响 | ✅ |
| Batch Prompt Rewriter 不受影响 | ✅ |
| 不自动生成，不消耗 credits，不新增 API，不调用 vision AI | ✅ |
| 不做真实像素级输出 | ✅ |
| 不改 schema / generate routes / provider / billing | ✅ |

### 浏览器验收结论（2026-06-08）

| 验收项 | 结果 |
|--------|------|
| image/video 节点顶部"剪辑"已改为"调色" | ✅ |
| 点击"调色"后菜单显示"🎛 调色盘" | ✅ |
| 点击"调色"后菜单显示"🎨 视觉风格包" | ✅ |
| 调色盘可正常打开，单节点工作流 | ✅ |
| 视觉风格包可正常打开，单节点工作流 | ✅ |
| 调色盘只作用当前节点 | ✅ |
| 视觉风格包只作用当前节点 | ✅ |
| Prompt 分组不再显示视觉风格包 | ✅ |
| Prompt Booster 不受影响 | ✅ |
| Batch Prompt Rewriter 不受影响 | ✅ |
| Color Grade Palette 功能无回归 | ✅ |
| Look Package Applier 功能无回归 | ✅ |
| Preview Monitor 即时显示调色变化（CSS filter 实时渲染） | ✅ |
| 调色预览不再被描述为"必须重新生成才生效" | ✅ |
| 可创建独立调色草案节点到画布 | ✅ |
| 调色草案节点状态 idle | ✅ |
| 调色草案节点不自动生成 | ✅ |
| 调色草案节点不消耗 credits | ✅ |
| Text / Image / Video 生成链路无回归 | ✅ |
| 不自动生成 | ✅ |
| 不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不调用 vision AI | ✅ |
| 不改 schema / generate / provider / billing | ✅ |

### 能力矩阵（截至 2026-06-08）

| 工具 | 状态 | 入口 |
|------|------|------|
| Color Suite / 节点顶部调色入口 | ✅ validated | image/video 节点顶部工具栏 |
| Color Grade Palette / 调色盘 | ✅ validated | 节点顶部"调色"菜单 |
| Color Grade draft node workflow / 调色草案节点 | ✅ validated | 调色盘"创建调色节点"按钮 |
| Color Grade preview copy / 预览即时生效文案 | ✅ validated | Preview Monitor CSS filter 即时渲染 |
| Look Package Applier / 视觉风格包 | ✅ validated | 节点顶部"调色"菜单 |
| Prompt Booster / 提示词增强器 | ✅ validated | Prompt 分组 |
| Batch Prompt Rewriter / 批量重写器 | ✅ validated | Prompt 分组 |
| Look Strength Control | ❌ cancelled | 被 Color Grade Palette 分离取代 |
| Pixel-level Color Grading | 📋 not implemented | future |
| WebGL / LUT Preview | 📋 not implemented | future Tool 12.5 |
| FFmpeg worker + LUT3D | 📋 not implemented | future Tool 13 |
| OpenColorIO color pipeline | 📋 not implemented | 远期 |
| IA-NILUT / VideoColorGrading | 📋 not implemented | 远期 AI 调色 |
| Reference-preserving Style Transfer | 📋 not implemented | 远期（需 vision provider） |

### 安全边界确认

| 安全项 | 状态 |
|--------|------|
| prompt-level only，不直接改像素 | ✅ |
| 不自动生成，不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不调用 vision AI | ✅ |
| 不接 WebGL / glfx / FFmpeg / OpenColorIO | ✅ |
| 不改 schema / generate routes / provider / billing | ✅ |
| 不改 cn-executor | ✅ |
| 不伪造 assetId | ✅ |
| 只追加 prompt，不覆盖原 prompt | ✅ |
| 已有同类段落 → 跳过，不自动替换 | ✅ |
| 调色 Preview Monitor 即时生效（CSS filter approximation，非最终模型输出） | ✅ |
| 调色草案节点 idle，不自动生成（正式结果需用户手动生成） | ✅ |
| 视觉风格包 prompt 追加后，正式结果需用户手动生成 | ✅ |

---

## Tool 13 — Character Reference Skill Agent / 人物参考板 — PAUSED / worker required

**Commits:** `1ec9ec6` (initial) → `7f21acf` (multi-node) → `20279ad` (visual board rework) → `3fc5d84` (route DB error handling) → `e4cb867` (per-slot requests + maxDuration)
**Status:** ⏸ PAUSED — Seedream character-reference route suspended — Character Skill Worker required
**Date paused:** 2026-06-09

### 暂停原因

多轮实测结论：Seedream `/images/generations` 无法满足专业四视图/九宫格需求：
- `body.image` 是 img2img 模式，复制源图构图，无法生成中性站姿四视图
- Seedream 没有 Face Identity Lock（人脸跨视角一致性）
- Seedream 没有 ControlNet / OpenPose 姿态控制
- Vercel Serverless 不适合运行多张串行长图生成
- prompt 优化/Negative prompts 均无法弥补能力边界缺失

### 正式方向

**Character Reference Skill Agent** 需要：
1. **人物主体提取** — SAM / BiRefNet / RMBG
2. **人脸/身份锁定** — InstantID / PuLID / IP-Adapter FaceID
3. **姿态控制** — ControlNet OpenPose（正面 / 四分之三 / 侧面 / 背面）
4. **生成** — SDXL / Flux（白底输出）
5. **OSS 持久化** — 输出真实资产
6. **回写 canvas done 节点** — source → generated reference nodes edge

### 下一阶段路线

- **Phase 1 POC**：Hosted Face-ID API（fal.ai InstantID / Replicate InstantID）验证人脸身份一致性
- **Phase 2**：四视图 POC（front / 3q / side / back）+ ControlNet 姿态控制
- **Phase 3**：Creator City Character Skill Worker（独立服务 / BullMQ 队列 / OSS 上传 / canvas 回写）

### 当前 UI 状态（Phase 0 暂停处理）

- 生成按钮已替换为 amber disabled "专用 Worker 接入中 · 暂不可用"
- 面板顶部显示 amber warning banner 说明路线暂停原因
- 槽位预览保留，显示"等待 Worker 接入"
- cropBox / 角色描述 / 一致性锁定 UI 保留，将作为未来 Worker 输入参数
- `/api/generate/character-reference` route 保留为实验存档，不暴露

### 已暂停的路线（不再投入）

- Seedream prompt-only / CHARACTER_CONSTRAINT 优化
- idle 草稿槽位节点
- cropBox-only metadata 方案
- Seedream route debugging（503 / ERR_CONNECTION_CLOSED）

### 新增 / 修改文件（截至 20279ad）

| 文件 | 说明 |
|------|------|
| `apps/web/src/lib/canvas/character-reference-grid.ts` | 类型定义 / buildTurnaroundPrompts / buildGrid5Prompts / buildCharacterReferencePrompts |
| `apps/web/src/components/create/CharacterReferenceGridPanel.tsx` | 视觉参考板 UI（槽位卡 / 角色描述 / 一致性锁 / 高级选项折叠区） |
| `apps/web/src/components/create/AssetAgentToolbar.tsx` | "资产"下拉菜单，含"👤 人物参考"入口 |
| `apps/web/src/components/create/CanvasToolDock.tsx` | 资产工具菜单新增"👤 人物参考 / 四视图"入口 |
| `apps/web/src/components/create/VisualCanvasWorkspace.tsx` | isCharacterReferenceOpen state + N 节点创建 handler（2×2 / 3+2 grid 布局） |
| `apps/web/src/components/create/CanvasNodeCard.tsx` | charRefMeta 检测：idle 参考节点显示槽位 badge UI |

### 入口位置

| 入口 | 适用节点 | 触发条件 |
|------|----------|----------|
| 节点顶部 AssetAgentToolbar → "资产" → "👤 人物参考" | image/video（有媒体结果） | 有 resultImageUrl 或 resultVideoUrl |
| 左侧 CanvasToolDock 资产工具菜单 → "👤 人物参考 / 四视图" | image / video / text（所有节点） | 任意时刻 |

### 支持模式（7f21acf 修复后）

| 模式 | 创建节点数 | 节点视图 | 布局 |
|------|-----------|---------|------|
| 人物四视图（turnaround4） | **4 个独立 image 节点** | 正面 / 四分之三 / 侧面 / 背面 | 2×2 grid（source.x+460/780, y+0/280） |
| 人物九宫格 MVP（grid5） | **5 个核心 image 节点** | 全身正面 / 全身四分之三 / 表情 / 服装细节 / 动作姿态 | 3+2（source.x+460/780/1100, y+0/280） |

研究结论：单节点混合多视图 prompt 在 AI 模型（Seedream/SDXL）中成功率仅 50–70%，且结果不可控。拆分为独立节点后每个 prompt 只描述一个视角，稳定性和可控性均提升。

### Prompt 结构

**四视图包含：** `character design turnaround reference sheet` + 角色描述 + 四角度说明 + 一致性约束 + `[Character Reference Consistency]` + `[Character Reference Negative Constraints]`

**九宫格包含：** `character reference grid sheet` + 角色描述 + 九格说明 + 一致性约束 + `[Character Reference Consistency]` + `[Character Reference Negative Constraints]`

**一致性约束选项（用户可勾选）：**
- 保持同一脸型（same facial features and face shape）
- 保持同一发型（same hairstyle and hair color）
- 保持同一服装（same outfit and costume throughout）
- 保持同一体型（same body proportions and height）
- 保持同一色彩（same overall color scheme）

**负向约束（始终追加）：**
`no different characters, no inconsistent facial features, no outfit changes between views, no random accessories, no identity drift, no scene background clutter, no cropped limbs`

### 创建节点行为（20279ad 重构后）

| 行为 | 说明 |
|------|------|
| 新节点类型 | `image` |
| 新节点 title | `人物四视图 · 正面 · {source title}`（每个视图独立标题） |
| 新节点 status | `idle` |
| 节点卡片空态 | 显示"人物参考"badge + 槽位标签 + "待生成参考图"（区别于普通 prompt 草稿） |
| 自动生成 | 否 |
| 消耗 credits | 否 |
| 伪造 assetId | 否 |
| source → 每个新节点 | 是（parentNodeId） |
| metadataJson | `{ sourceNodeId, characterReference: { type, source, groupId, viewKey, viewLabel, consistencyOptions, style, layout, nodeCount } }` |
| 位置 | 四视图 2×2 grid；九宫格 3+2 grid（见上） |
| 创建后 toast | "已创建人物参考板 — N 个槽位节点，请进入各槽位手动生成参考图。" |

### 安全边界确认

| 安全项 | 状态 |
|--------|------|
| 不自动生成，不消耗 credits | ✅ |
| 不新增 API | ✅ |
| 不调用 vision AI | ✅ |
| 不上传 OSS | ✅ |
| 不伪造 assetId | ✅ |
| 不改 generate routes / provider adapter / billing | ✅ |
| 不改 Prisma schema / migrations / cn-executor | ✅ |
| 不改 Tool 1–12 核心逻辑 | ✅ |
| 不改右侧工具栏 | ✅ |
| 不做真实图像处理 | ✅ |
| 不读取图像内容（无 vision AI） | ✅ |
| 新节点 idle，用户手动生成正式结果 | ✅ |

### 浏览器验收步骤

1. 打开有生成结果的 image 节点 → 顶部工具栏出现"资产"按钮（替换原"入库 soon"）
2. 点击"资产" → 菜单显示"👤 人物参考"、"⊕ 入库 soon"、"⊞ 版本管理 soon"
3. 点击"👤 人物参考" → CharacterReferenceGridPanel 打开
4. Panel 显示当前节点标题 / kind / 图片预览（如有）/ prompt 摘要
5. 可选择"人物四视图"或"人物九宫格"
6. 角色来源摘要 textarea 默认填入节点 prompt，字体清晰可见（白字深底）
7. 可修改 textarea 补充年龄/发型/服装等
8. 可开关脸型/发型/服装/体型/色彩一致性 toggle
9. 可选择参考稿风格（5 种）
10. 可选择构图要求（4 种）
11. Prompt 预览区显示完整 Prompt（只读）
12. 点击"创建人物参考节点" → 画布出现新 image 节点，title 含"人物四视图"或"人物九宫格"
13. 新节点 status = idle，不自动生成
14. source → new node edge 可见
15. 新节点位置不与 source 重叠
16. 左下 toast 显示"已创建人物参考草案节点，请在新节点中手动生成。"
17. 左侧 CanvasToolDock 资产工具菜单也出现"👤 人物参考 / 四视图"入口（适用所有节点）
18. Tool 1–12 不回归，生成链路不回归

---

## P1-4B-4-QA — Membership Gating QA — VALIDATED / CLOSED

**Date:** 2026-06-15  
**Scope:** POST /api/marketplace/listings · PATCH→ACTIVE · ADMIN bypass · GET unaffected  
**Status:** VALIDATED / CLOSED

| Criterion | Result | Evidence |
|---|---|---|
| POST /api/marketplace/listings 非会员 → 403 MEMBERSHIP_REQUIRED | ✅ PASS | Live: `{"errorCode":"MEMBERSHIP_REQUIRED"}` |
| PATCH listing → status:ACTIVE 须会员 | ✅ PASS (code) | `listings/[id]/route.ts:89-91`：`if (next==='ACTIVE') membershipGateResponse(user)` |
| ADMIN bypass | ✅ PASS (code) | `lib/membership/server.ts`：`if (user.role==='ADMIN') return null` |
| GET /api/marketplace/listings 不受影响 | ✅ PASS | 已登录用户正常返回 listing 数据 |
| BYOK 生成不受影响 | ✅ PASS | 门控仅在 POST create + PATCH→ACTIVE，generate routes 不受影响 |
| Side-effect clean | ✅ PASS | qa-nonmember orders=[] licenses=[] inquiries=[] credits balance=0 |

---

## P1-4E — Unified Launch QA — PARTIAL / BLOCKED_ON_ADMIN_MEMBER_SELLER_SESSION

**Date:** 2026-06-15  
**Scope:** Membership + BYOK + Canvas save + Marketplace inquiry + Disabled credits/payment  
**Status:** VALIDATED / CLOSED — 2026-06-16 全部 phases PASS

### 已验证项（PASS）

| Phase | 检查项 | 结果 | Evidence |
|---|---|---|---|
| A | /pricing：¥100/月、BYOK 模型说明、无充值 CTA、平台服务费免责声明 | ✅ PASS | Live HTML confirmed |
| A | /api/me/membership plan：pro_monthly_cny100 / ¥100 | ✅ PASS | `{"plan":{"code":"pro_monthly_cny100","amountCny":10000}}` |
| B | 非会员 session 有效（membershipActive=false） | ✅ PASS | /api/auth/me live |
| B | POST /api/me/membership/orders 创建 PENDING 订单 | ✅ PASS | Order `134a62b8` PENDING |
| B | GET /api/me/membership/orders 返回正确状态 | ✅ PASS | `{"orders":[{"status":"PENDING"}]}` |
| C | GET /api/provider-accounts 返回空列表（非会员无绑定） | ✅ PASS | `{"accounts":[]}` |
| D | scheduleCanvasSave 只写 localStorage，无自动 PUT | ✅ PASS (code) | commit `fe72f63`：pendingSaveRef=false，无 reschedule |
| D | saveCanvas 仅由手动按钮触发 | ✅ PASS (code) | `handleManualSave` 为唯一调用方 |
| D | 20s hard deadline + 15s fetch abort | ✅ PASS (code) | canvas route + VisualCanvasWorkspace.tsx |
| E | 未登录 POST inquiry → 401 UNAUTHORIZED | ✅ PASS | Live: `{"errorCode":"UNAUTHORIZED"}` |
| E | 非会员 POST inquiry → 403 MEMBERSHIP_REQUIRED | ✅ PASS | Live: `{"errorCode":"MEMBERSHIP_REQUIRED"}` |
| E | 待审核会员（membershipActive=false）POST inquiry → 403 | ✅ PASS | Live confirmed |
| G | POST /api/me/marketplace-orders → 405（无 POST handler） | ✅ PASS | HTTP 405 |
| G | POST /api/me/credits/recharge → 404（路由不存在） | ✅ PASS | HTTP 404 |
| G | POST /api/marketplace/listings 非会员 → 403 | ✅ PASS | Live: MEMBERSHIP_REQUIRED |
| I | qa-nonmember 全局副作用干净 | ✅ PASS | orders=[] licenses=[] inquiries=[] balance=0 |

### BLOCKED 项

| Phase | 检查项 | 原因 |
|---|---|---|
| B | 会员审批（approve order → membershipActive=true） | 无 ADMIN session |
| E | 已批准会员 submit inquiry → 201 | 无已批准会员 session |
| F | Seller respond/reject/close inquiry | 无 seller/ADMIN session |
| H | Admin pages smoke（/admin/membership · /admin/marketplace） | 无 ADMIN session |

### P1-4E-FOLLOWUP 补测结果（2026-06-16）

| Phase | 状态 | 证据 |
|---|---|---|
| Phase 1 — Admin membership approval | ✅ PASS (live) | membershipActive=true, membershipStatus=ACTIVE, expiresAt=2026-07-15（两 QA 账号 live 确认）|
| Phase 2 — Member inquiry submit | ✅ PASS (live) | inquiryId `b4ee0386`, status=PENDING, disclaimer present, idempotent |
| Phase 3 — Seller respond | ✅ PASS (user-certified) | Aaron seller 浏览器确认 respond 成功 |
| Phase 4 — Buyer close + resubmit | ✅ PASS (live) | CLOSED live; resubmit→PENDING reset live |
| Phase 5 — Admin pages smoke | ✅ PASS (user-certified) | /admin /admin/membership /admin/marketplace /admin/providers /admin/credits 全部可加载 |
| Phase 6 — Final side-effect | ✅ PASS (live) | 0 MarketplaceOrder, 0 LicenseGrant, 0 CreditLedger; payment routes 405/404 |

**First launch path VALIDATED / CLOSED:**
会员订阅 ✅ · BYOK-first ✅ · Canvas local draft + manual cloud save ✅ · Marketplace inquiry/contact mode ✅ · No platform credit payment ✅ · No automatic refund ✅ · No wallet/ledger side effects ✅ · Admin gates ✅ · No NFT/on-chain ✅
