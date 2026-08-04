# Creator Intelligence Knowledge Engine Design

**Task:** `P0-CREATOR-INTELLIGENCE-KNOWLEDGE-ENGINE-FOUNDATION`

**Status:** Founder-approved architecture; awaiting written-spec review

**Date:** 2026-08-04

## 1. Objective

Evolve Creator City from a canvas that mainly collects tool settings into a creator-owned intelligence system. The system must produce professional, reviewable creative work from a script, image, video, and approved project context without requiring the user to write prompts and without making an external generation provider the source of its reasoning.

The intended visible outcomes are:

- script input becomes a scene breakdown, beat map, shot plan, and deterministic black-and-white storyboard plan;
- image input becomes an evidence-backed composition, camera, lighting, subject/action, and usable-reference analysis;
- video input becomes shot boundaries, key moments, motion, pacing, and continuity findings;
- approved analysis becomes editable, source-linked Canvas artifacts and optional derived nodes;
- a future knowledge acquisition service improves recommendations without exposing a crawler or an unreviewed corpus in the user interface.

This is an architecture and staged-delivery design. It does not authorize scraping, model training, database changes, or a background worker deployment by itself.

## 2. Product Decisions

1. **Direct creative actions, not prompt-first UX.** The product verbs are `分析剧本`, `分析画面`, `分析镜头`, `创建镜头表`, `生成草图分镜`, and `检查连续性`. Prompt input remains an optional downstream media-generation feature, not the primary interface for this system.
2. **Strengthen in place.** The existing Creator Skill runtime, Storyboard Director Recipe, NodeToolCenter, Camera, Lighting, Continuity, Reference Extractor, and Keyframe Extractor are strengthened. No duplicate director, duplicate analysis workspace, or parallel tool catalog is created.
3. **Deterministic, explainable core.** Rules, parsing, retrieval, validation, and layout are Creator City-owned and deterministic for the same input, knowledge-pack revision, and skill version. A future self-hosted model may rank, classify, or extract candidates, but cannot silently replace source evidence or rule checks.
4. **Human approval before project mutation.** Analysis can draft results; users explicitly approve the results that materialize nodes, edges, or Canvas metadata. Sources remain immutable.
5. **Authorized knowledge only.** The system may use user-authorized material, Creator City-owned material, explicitly licensed/purchased datasets, and policy-approved public metadata. It must not indiscriminately copy, display, train on, or redistribute third-party original media.
6. **No hidden dependence on external generation APIs.** The local intelligence path must still work when Provider, BYOK, billing, and generation are unavailable. Provider use remains an explicitly initiated, separately governed media-generation action.

## 3. Existing Foundation and Gap

Creator City already has the right local primitives:

- `apps/web/src/lib/skills` owns a versioned, deterministic Creator Skill runtime, fingerprints, artifacts, evidence, reviews, and executable registry.
- `apps/web/src/lib/skills/script-segmentation`, `narrative-beat-analysis`, and `shot-planning` implement local script analysis and shot planning.
- `apps/web/src/lib/storyboard/recipe` owns the reviewed Storyboard Director state machine, persistence, identity, and deterministic intelligence checks.
- `apps/web/src/lib/storyboard/sketch` renders a deterministic local black-and-white storyboard board.
- `apps/web/src/lib/canvas` contains existing camera, lighting, continuity, reference extraction, keyframe provenance, local import, and result-quality contracts.
- `apps/web/src/components/create/canvas/node-tools/NodeToolCenter.tsx` and the existing Director panels are the canonical Canvas entry surfaces.

The missing layer is a shared knowledge contract that allows those tools to use approved creative knowledge and content analysis consistently, preserve provenance, and later accept reviewed corpus updates without becoming unrelated ad hoc implementations.

## 4. Architecture

```text
User-authorized project material      Approved knowledge sources
              |                                 |
              v                                 v
       Project analysis adapter       Knowledge acquisition and review
              |                                 |
              +------------+--------------------+
                           v
             Creator Knowledge Core (versioned)
     taxonomy | evidence | provenance | licensing | retrieval
                           v
            Deterministic Creator Skills and validators
 script | image | video | storyboard | camera | lighting | continuity
                           v
          reviewable Analysis Artifacts and quality findings
                           v
   existing Storyboard Director / NodeToolCenter / Canvas persistence
                           v
    explicit user approval -> derived nodes, edges, and project metadata
```

The knowledge acquisition service is independent from the web request path. Canvas requests read only an already approved, versioned knowledge-pack snapshot. A stalled or disabled acquisition service must never block a user from opening or saving a project.

## 5. Canonical Data Contracts

### 5.1 Knowledge Record

`CreativeKnowledgeRecord` is the canonical, versioned unit of reusable knowledge. It is not a raw media dump.

```ts
type CreativeKnowledgeRecord = {
  knowledgeId: string
  schemaVersion: 1
  domain: 'script' | 'cinematography' | 'lighting' | 'composition' | 'editing' | 'continuity'
  kind: 'rule' | 'taxonomy' | 'example-summary' | 'template' | 'evaluation-case'
  title: string
  content: Record<string, unknown>
  evidence: Array<{ sourceRef: string; excerpt?: string; locator?: string }>
  provenance: {
    sourceType: 'creator-owned' | 'user-authorized' | 'licensed' | 'open-license' | 'public-metadata'
    sourceId: string
    collectedAt: string
    licenseStatus: 'verified' | 'restricted' | 'metadata-only' | 'revoked'
    allowedUses: Array<'retrieval' | 'rule-authoring' | 'evaluation' | 'training'>
  }
  review: { status: 'approved' | 'disabled'; reviewedAt: string; reviewerId: string }
  revision: string
  contentHash: string
}
```

Only `review.status === 'approved'`, `licenseStatus !== 'revoked'`, and the requested allowed use can enter retrieval. The initial implementation may keep the first small knowledge pack in version-controlled source data, but it must use this semantic shape and revision identity. A later storage implementation is a separately approved schema/API task.

### 5.2 Analysis Artifact

Existing `CreatorSkillArtifact` remains the skills interchange shape. It gains no opaque free-text shortcut. New analysis artifacts carry a local analysis payload and an explicit knowledge snapshot reference:

```ts
type CreativeAnalysisArtifact<T> = CreatorSkillArtifact<T> & {
  analysis: {
    analyzerId: string
    analyzerVersion: string
    knowledgePackRevision: string
    sourceFingerprint: string
    evidenceRefs: string[]
    confidence: 'supported' | 'needs-review' | 'insufficient-evidence'
  }
}
```

`confidence` is a state of evidence sufficiency, never a fabricated numerical score. An `insufficient-evidence` result remains visible with its limitation but cannot claim a professional conclusion.

### 5.3 Source and Privacy Boundaries

- User assets and project metadata are project-owned. They cannot become corpus records or training data without a separate, explicit opt-in and durable consent record.
- Knowledge sources are not copied into user projects. The Canvas stores compact rule/evidence identifiers and a knowledge-pack revision, not a private corpus payload.
- A source revocation disables future retrieval. Existing project artifacts show that a source changed or is unavailable; they are not silently rewritten.
- Artifact fingerprints include canonical source content, approved artifacts, skill version, and knowledge-pack revision. They never include time, random IDs, session state, cookies, credentials, or network responses.

## 6. Runtime Behavior

### 6.1 Script Path

1. A user selects a script/text node and clicks `分析剧本` or opens the existing Storyboard Director.
2. Script Segmentation, Narrative Beat Analysis, and Shot Planning run through the existing local runtime.
3. A `CreativeKnowledgeResolver` selects only compatible approved script, cinematography, and continuity records from the current knowledge-pack revision.
4. Camera and Lighting guidance enrich the existing shot plan with evidence-backed heuristics.
5. Continuity validation flags gaps or conflicts rather than inventing story facts.
6. The user reviews each stage. Only approved artifacts may create a storyboard control node, shot cards, or a deterministic sketch board.

### 6.2 Image Path

1. A user selects an image asset node and clicks `分析画面`.
2. The initial local analyzer reads only user-provided metadata, annotations, crop/reference provenance, and explicit user selections. It must not falsely claim pixel-level vision until a separately evaluated local vision capability exists.
3. Composition, camera, lighting, and reference suggestions remain evidence-backed. Unknown content stays `needs-review`.
4. The user can approve a source-linked analysis artifact, then create existing camera/lighting drafts or reference extractions.

### 6.3 Video Path

1. A user selects a video node and clicks `分析镜头`.
2. Existing local Keyframe Extractor evidence, duration, time ranges, and user-selected key moments feed the analysis. V1 does not claim semantic video understanding beyond available evidence.
3. The output describes shot intervals, movement observations, editable pace notes, and continuity checks. It can create no media by itself.
4. The user approves any resulting shot/continuity artifacts before applying them to the board or Canvas.

### 6.4 Local Storyboard Path

The approved script path renders through the existing deterministic sketch grammar and renderer. It produces black-and-white compositional boards, camera labels, action lines, and unresolved markers. It does not pretend to be a generated film still or invoke a provider.

## 7. Knowledge Acquisition Agent

### 7.1 Scope

The background system is named `Knowledge Acquisition Agent`. It is an operations service, not a visible Canvas agent and not an autonomous open-web crawler.

It has five independent stages:

1. **Source policy:** source allowlist, terms/permission decision, robots or equivalent access policy, allowed fields, rate limit, retention, and permitted use.
2. **Acquisition:** bounded queue fetches only policy-allowed data. It cannot log in, bypass access controls, execute destructive actions, or access private user material.
3. **Normalization:** content hashing, duplicate detection, taxonomy mapping, metadata extraction, and quarantine of malformed or unsafe input.
4. **Review:** automated policy checks followed by a human approval queue for records proposed for a knowledge pack.
5. **Release and revocation:** immutable pack revision publication, audit log, source disablement, record revocation, and downstream compatibility report.

### 7.2 Allowed Initial Inputs

- Creator City-authored rules, taxonomy, templates, and evaluation cases.
- User material only for that user/project analysis, never corpus ingestion by default.
- Explicitly commercial/openly licensed datasets with verified terms and a stored acquisition manifest.
- Public web metadata only when the source policy allows indexing. This means minimal title, description, URL, license claim, creator/publisher field where available, and topic tags. It does not mean downloading, displaying, or training on the original media.

### 7.3 Prohibited Behavior

- No unbounded crawling or claim to collect "the whole internet".
- No credential use, paywall bypass, rate-limit evasion, CAPTCHA bypass, or private-content collection.
- No raw third-party media retention unless an explicit source policy and license allow it.
- No automatic training-data promotion.
- No direct writes to Canvas projects, Provider routes, payments, credits, wallets, or Production database records.
- No Vercel request-time crawling. Acquisition jobs run off the user request path in an isolated, observable environment.

## 8. Product Surface and UI Rules

- Existing Canvas tool entry points are retained. New actions appear only when their source node has sufficient eligible data.
- A single compact evidence strip identifies whether a result is based on user source, local rules, approved knowledge, or insufficient evidence.
- Source lock and immutable-source behavior remain visible and unchanged.
- Results use the current Creator City dark compact visual system, existing Director modal/frame patterns, and viewport constraints. There are no nested tool cards, no second Storyboard Director, and no dashboard for the hidden acquisition service.
- The UI never says "AI understood" without naming an actual analysis state, source, or review requirement.

## 9. Delivery Plan

### Phase 0: Capability Map and Contract Specification

Map every current local Creator Skill and Canvas tool to a knowledge domain, formalize the versioned knowledge and analysis contracts, and identify duplicate/legacy entry points.

**Exit criteria:** every initial capability has one owner, one Canvas entry surface, one artifact shape, and one set of source/evidence rules.

### Phase 1: Versioned Local Knowledge Pack

Add a small human-reviewed, Creator City-owned cinematography and storytelling knowledge pack; a deterministic resolver; and an artifact/evidence adapter that enriches existing local Skills without changing their established behavior when no pack applies.

**Exit criteria:** the same source, skill version, and knowledge-pack revision yield the same result; disabled/revoked entries are excluded; no network, Provider, or payment request is needed.

### Phase 2: Professional Analysis Upgrades

Strengthen the existing Script, Storyboard, Camera, Lighting, Continuity, Image, and Video paths in separately approved batches. Every batch must use existing panels where possible and include clear unresolved states.

**Exit criteria:** users can produce, edit, save, and recover structured results and deterministic sketch boards without a text-prompt workflow or provider invocation.

### Phase 3: Acquisition Service and Operations Review

Build an isolated, policy-first acquisition service only after a separate data governance and deployment specification is approved. Start in dry-run/metadata-only mode with no automatic release.

**Exit criteria:** source-policy review, queue limits, provenance, duplicate handling, revocation, deletion, audit logs, and staged pack release are independently tested.

### Phase 4: Optional Self-Hosted Model Adapter

Introduce an optional self-hosted local model adapter only when an approved corpus and offline evaluation set show a measurable gain. The adapter is replaceable and must degrade to deterministic rules and user review.

**Exit criteria:** no model failure causes false completion, project data loss, hidden network calls, or inability to use existing Canvas tools.

## 10. Validation Strategy

Tests are written before each implementation batch and cover:

- deterministic fingerprints across knowledge-pack revisions and stable outcomes for same inputs;
- invalid, revoked, duplicate, cross-project, or license-incompatible knowledge records;
- source immutability, approval gating, cancellation, retry, node/edge deduplication, and persistence/recovery;
- evidence completeness and visible `needs-review`/`insufficient-evidence` states;
- script-to-shot-to-sketch, image analysis, and video analysis without Provider, generate, billing, credit, wallet, payment, or recharge mutations;
- 20/50/100 artifact and shot-board layout/save scheduling behavior;
- source-policy, rate-limit, audit, deletion, and revocation behavior before any acquisition service is enabled;
- browser QA for Canvas panel containment, tool discoverability, save/reload, independent browser context recovery, network boundaries, and console errors.

Each release runs targeted tests, type-check, lint, build, diff-check, forbidden-zone audit, safe Preview browser QA, and a Production read-only smoke check. Preview write success is never described as authenticated Production write validation.

## 11. Explicit Non-Goals and Boundaries

This task and the first implementation phase do not modify:

- Provider adapters, BYOK meaning, `/api/generate/image`, `/api/generate/video`, or automatic media generation;
- payment, credits, wallet, ledger, billing, recharge, checkout, or webhooks;
- Prisma schema/migrations, Production database records, environment variables, package files, lockfiles, Next config, or `cn-executor`;
- user passwords, cookies, tokens, API keys, or private content;
- historical project data except forward-compatible reads and explicitly approved local metadata additions.

Any requirement that needs one of these changes raises `SCOPE_EXPANSION_REQUIRED` and is handled by a separately reviewed task.

## 12. Success Metrics

The system is ready to progress only when all are true:

1. A user can obtain a reviewed script plan, shot plan, and black-and-white storyboard with no external generation call.
2. Image/video analysis never claims visual facts unavailable from the active local evidence.
3. Every reusable recommendation references a knowledge-pack revision and evidence source.
4. Every project mutation is explicit, idempotent, source-linked, and recoverable after refresh.
5. Disabled/revoked knowledge cannot influence future runs.
6. A disabled acquisition service and unavailable model adapter do not break Canvas creation, save, or existing local tools.
7. No unknown-license record enters a released knowledge pack or model-training dataset.

## 13. First Implementation Task

The first code task after this specification is:

`P0-CREATOR-INTELLIGENCE-KNOWLEDGE-ENGINE-A: Capability Map and Versioned Local Knowledge Pack`

It is deliberately limited to Phase 0 plus the smallest Phase 1 slice. It will audit and strengthen the existing local skill runtime and Canvas integration, add no crawler, add no external model, add no production data ingestion, and preserve every prohibited boundary in Section 11.
