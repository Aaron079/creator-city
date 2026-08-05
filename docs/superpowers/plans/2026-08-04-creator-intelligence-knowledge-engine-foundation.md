# Creator Intelligence Knowledge Engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a deterministic, versioned local knowledge foundation so existing Creator City Skills can use approved cinematography and storytelling knowledge without a crawler, model, Provider, or prompt-first flow.

**Architecture:** A pure creative-knowledge domain lives beside the existing Creator Skill runtime. It validates human-reviewed local records, selects compatible records by domain and allowed use, and creates a stable selection receipt for later Skill artifact payloads. A pure capability map assigns each existing Canvas tool and Creator Skill to a knowledge domain and owner; it creates neither an additional UI nor a second runtime.

**Tech Stack:** TypeScript, Node built-in test runner through tsx, existing Creator Skill fingerprint/artifact runtime, Next.js monorepo.

---

## Scope Lock

This plan implements Phase 0 and the smallest Phase 1 slice:

- versioned Creator City-owned local knowledge;
- strict provenance, license, review, revocation, and deterministic selection rules;
- stable selection receipts suitable for later Skill artifact payloads;
- a capability map for existing Creator Skills and Canvas tools;
- unit tests and static forbidden-boundary coverage.

It does not change output behavior in current Script Segmentation, Narrative Beat Analysis, Shot Planning, Storyboard Director, Camera, Lighting, Continuity, Image, or Video tools. It does not create a crawler, network request, model, worker, API route, database change, user-project write, Provider/BYOK/generate change, payment/billing/credits change, package change, environment change, or Production DB action.

## File Structure

### Create

- apps/web/src/lib/creative-knowledge/types.ts: canonical contracts.
- apps/web/src/lib/creative-knowledge/validation.ts: strict clone and validation.
- apps/web/src/lib/creative-knowledge/local-cinematic-pack.ts: Creator City-owned local rules.
- apps/web/src/lib/creative-knowledge/resolver.ts: deterministic selection and receipts.
- apps/web/src/lib/creative-knowledge/capability-map.ts: immutable owner/domain map.
- apps/web/src/lib/creative-knowledge/index.ts: narrow public API.
- apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts: public contract suite.
- scripts/creator-intelligence-knowledge-boundary.test.mjs: static no-network/no-forbidden-import guard.

### Modify

- apps/web/src/lib/skills/index.ts: re-export only the pure knowledge API.
- docs/CURRENT_STATUS.md: close only after verified implementation.
- docs/NEXT_TASKS.md: list exactly one integration follow-up without starting it.

### Preserve

Do not modify apps/web/src/lib/skills/types.ts, runtime.ts, fingerprint.ts, artifacts.ts, executable-registry.ts, any current executable Skill implementation, Canvas UI, routes, Prisma, Provider/BYOK, generation, payment/billing/credits, cn-executor, packages, environment, or Production DB.

## Data Contract

    export type CreativeKnowledgeDomain =
      | 'script'
      | 'cinematography'
      | 'lighting'
      | 'composition'
      | 'editing'
      | 'continuity'

    export type CreativeKnowledgeRecord = {
      knowledgeId: string
      schemaVersion: 1
      domain: CreativeKnowledgeDomain
      kind: 'rule' | 'taxonomy' | 'template' | 'evaluation-case'
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

    export type CreativeKnowledgePack = {
      packId: string
      revision: string
      records: CreativeKnowledgeRecord[]
    }

    export type CreativeKnowledgeSelectionQuery = {
      domains: CreativeKnowledgeDomain[]
      allowedUse: 'retrieval' | 'rule-authoring' | 'evaluation' | 'training'
    }

    export type CreativeKnowledgeSelectionReceipt = {
      packId: string
      packRevision: string
      selectionFingerprint: string
      recordIds: string[]
      domains: CreativeKnowledgeDomain[]
      allowedUse: CreativeKnowledgeSelectionQuery['allowedUse']
    }

The first pack is only creator-owned, verified, and approved. It allows retrieval, rule-authoring, and evaluation, never training. Do not alter exact-key CreatorSkillArtifact; a later integration puts its receipt in the artifact payload.

## Task 1: Contract and Strict Validator

**Files:**
- Create: apps/web/src/lib/creative-knowledge/types.ts
- Create: apps/web/src/lib/creative-knowledge/validation.ts
- Create: apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts

- [ ] **Step 1: Write the failing validator test.**

    import assert from 'node:assert/strict'
    import { describe, test } from 'node:test'
    import {
      cloneCreativeKnowledgePack,
      isEligibleCreativeKnowledgeRecord,
      validateCreativeKnowledgeRecord,
    } from './validation'

    function validRecord() {
      return {
        knowledgeId: 'cinematic-axis-rule',
        schemaVersion: 1,
        domain: 'cinematography',
        kind: 'rule',
        title: '保持屏幕方向',
        content: { ruleId: 'screen-direction', guidance: '在同一动作段保持主体方向。' },
        evidence: [{ sourceRef: 'creator-city:cinematic-basics-v1' }],
        provenance: {
          sourceType: 'creator-owned',
          sourceId: 'creator-city:cinematic-basics-v1',
          collectedAt: '2026-08-04T00:00:00.000Z',
          licenseStatus: 'verified',
          allowedUses: ['retrieval', 'rule-authoring', 'evaluation'],
        },
        review: {
          status: 'approved',
          reviewedAt: '2026-08-04T00:00:00.000Z',
          reviewerId: 'creator-city-editorial',
        },
        revision: '1',
        contentHash: 'ckh1_axis_rule',
      }
    }

    describe('creative knowledge validation', () => {
      test('clones an approved record without retaining caller references', () => {
        const source = validRecord()
        const record = validateCreativeKnowledgeRecord(source)
        source.content.ruleId = 'mutated'
        assert.equal(record.content.ruleId, 'screen-direction')
      })

      test('keeps revoked and disabled lifecycle records but marks them ineligible', () => {
        const revoked = validateCreativeKnowledgeRecord({
          ...validRecord(),
          provenance: { ...validRecord().provenance, licenseStatus: 'revoked' },
        })
        const disabled = validateCreativeKnowledgeRecord({
          ...validRecord(),
          review: { ...validRecord().review, status: 'disabled' },
        })
        assert.equal(isEligibleCreativeKnowledgeRecord(revoked, 'retrieval'), false)
        assert.equal(isEligibleCreativeKnowledgeRecord(disabled, 'retrieval'), false)
      })

      test('rejects malformed records with no permitted use', () => {
        assert.throws(() => validateCreativeKnowledgeRecord({
          ...validRecord(),
          provenance: { ...validRecord().provenance, allowedUses: [] },
        }))
      })

      test('rejects duplicate ids in a pack', () => {
        assert.throws(() => cloneCreativeKnowledgePack({
          packId: 'creator-city-cinematic-core',
          revision: '1.0.0',
          records: [validRecord(), validRecord()],
        }))
      })
    })

- [ ] **Step 2: Verify RED.**

    pnpm --filter web exec tsx --test src/lib/creative-knowledge/creativeKnowledge.test.ts

Expected: FAIL because validation.ts does not exist.

- [ ] **Step 3: Implement types and validator.**

Create types.ts with the contract above and frozen constant arrays for valid domain, kind, source type, license status, review status, and allowed use.

Create validation.ts with:

    export function validateCreativeKnowledgeRecord(value: unknown): CreativeKnowledgeRecord
    export function cloneCreativeKnowledgePack(value: unknown): CreativeKnowledgePack
    export function isEligibleCreativeKnowledgeRecord(
      value: unknown,
      allowedUse: CreativeKnowledgeAllowedUse,
    ): value is CreativeKnowledgeRecord

Follow the defensive patterns in apps/web/src/lib/skills/artifacts.ts: plain objects only, exact enumerable data keys, dense arrays without extra properties, no symbols/accessors, finite JSON data, unique arrays, and recursive frozen return values. validateCreativeKnowledgeRecord preserves every valid lifecycle state, including revoked and disabled, so history and revocation can be represented. isEligibleCreativeKnowledgeRecord returns false, not throw, for disabled/revoked/wrong-use records. Validate timestamps with Date.parse; require non-empty identifiers.

- [ ] **Step 4: Verify GREEN and commit.**

    pnpm --filter web exec tsx --test src/lib/creative-knowledge/creativeKnowledge.test.ts
    git add apps/web/src/lib/creative-knowledge/types.ts \
      apps/web/src/lib/creative-knowledge/validation.ts \
      apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts
    git commit -m "feat: add creative knowledge contract"

Expected: PASS.

## Task 2: Reviewed Local Cinematic Pack

**Files:**
- Create: apps/web/src/lib/creative-knowledge/local-cinematic-pack.ts
- Modify: apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts

- [ ] **Step 1: Write the failing pack test.**

    import { LOCAL_CINEMATIC_KNOWLEDGE_PACK } from './local-cinematic-pack'

    test('ships only Creator City-owned approved non-training records', () => {
      const pack = LOCAL_CINEMATIC_KNOWLEDGE_PACK
      assert.equal(pack.packId, 'creator-city-cinematic-core')
      assert.equal(pack.revision, '1.0.0')
      assert.ok(pack.records.length >= 6)
      for (const record of pack.records) {
        assert.equal(record.provenance.sourceType, 'creator-owned')
        assert.equal(record.provenance.licenseStatus, 'verified')
        assert.equal(record.review.status, 'approved')
        assert.equal(record.provenance.allowedUses.includes('training'), false)
      }
    })

- [ ] **Step 2: Verify RED.**

    pnpm --filter web exec tsx --test src/lib/creative-knowledge/creativeKnowledge.test.ts

Expected: FAIL because the local pack is absent.

- [ ] **Step 3: Implement the pack.**

Create local-cinematic-pack.ts through cloneCreativeKnowledgePack. Add exactly these records, each with content fields ruleId and guidance, one Creator City editorial evidence record, revision 1, and a stable contentHash:

    script-scene-objective: 每场明确目标、阻力与变化
    cinematic-screen-direction: 连续动作保持屏幕方向，换轴必须可见地建立。
    composition-subject-hierarchy: 一个镜头优先服务一个可读的视觉主体层级。
    lighting-motivation: 关键光源应有叙事或空间动机，无法确认时标记待审核。
    continuity-action-match: 跨镜头动作续接需要可验证的起止状态。
    continuity-eyeline: 对话镜头的视线方向应与空间关系一致。

Use only sourceType creator-owned, sourceId creator-city:cinematic-core-editorial-v1, licenseStatus verified, review approved, and allowed uses retrieval/rule-authoring/evaluation. No external URL, copied media, user content, or training permission.

- [ ] **Step 4: Verify GREEN and commit.**

    pnpm --filter web exec tsx --test src/lib/creative-knowledge/creativeKnowledge.test.ts
    git add apps/web/src/lib/creative-knowledge/local-cinematic-pack.ts \
      apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts
    git commit -m "feat: add local cinematic knowledge pack"

Expected: PASS.

## Task 3: Deterministic Resolver and Receipt

**Files:**
- Create: apps/web/src/lib/creative-knowledge/resolver.ts
- Create: apps/web/src/lib/creative-knowledge/index.ts
- Modify: apps/web/src/lib/creative-knowledge/types.ts
- Modify: apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts
- Modify: apps/web/src/lib/skills/index.ts

- [ ] **Step 1: Write failing resolver tests.**

    import {
      resolveCreativeKnowledge,
      resolveLocalCinematicKnowledge,
    } from './resolver'
    import { LOCAL_CINEMATIC_KNOWLEDGE_PACK } from './local-cinematic-pack'

    test('selects compatible records in declared-domain order', () => {
      const result = resolveLocalCinematicKnowledge({
        domains: ['continuity', 'cinematography'],
        allowedUse: 'retrieval',
      })
      assert.deepEqual(
        result.records.map((record) => record.knowledgeId),
        ['cinematic-screen-direction', 'continuity-action-match', 'continuity-eyeline'],
      )
      assert.equal(result.receipt.packRevision, '1.0.0')
      assert.deepEqual(result.receipt.domains, ['cinematography', 'continuity'])
    })

    test('changes a receipt when the pack revision changes', () => {
      const base = resolveLocalCinematicKnowledge({
        domains: ['lighting'], allowedUse: 'retrieval',
      })
      const revised = resolveCreativeKnowledge({
        pack: { ...LOCAL_CINEMATIC_KNOWLEDGE_PACK, revision: '1.0.1' },
        query: { domains: ['lighting'], allowedUse: 'retrieval' },
      })
      assert.notEqual(base.receipt.selectionFingerprint, revised.receipt.selectionFingerprint)
    })

    test('excludes disabled and revoked records', () => {
      const disabled = {
        ...validRecord(),
        knowledgeId: 'disabled',
        review: { ...validRecord().review, status: 'disabled' },
      }
      const revoked = {
        ...validRecord(),
        knowledgeId: 'revoked',
        provenance: { ...validRecord().provenance, licenseStatus: 'revoked' },
      }
      const result = resolveCreativeKnowledge({
        pack: {
          ...LOCAL_CINEMATIC_KNOWLEDGE_PACK,
          records: [...LOCAL_CINEMATIC_KNOWLEDGE_PACK.records, disabled, revoked],
        },
        query: { domains: ['cinematography'], allowedUse: 'retrieval' },
      })
      assert.equal(result.records.some((record) => record.knowledgeId === 'disabled'), false)
      assert.equal(result.records.some((record) => record.knowledgeId === 'revoked'), false)
    })

- [ ] **Step 2: Verify RED.**

    pnpm --filter web exec tsx --test src/lib/creative-knowledge/creativeKnowledge.test.ts

Expected: FAIL because resolver.ts does not exist.

- [ ] **Step 3: Implement resolver and exports.**

Add these contract types to types.ts before implementing the resolver:

    export type CreativeKnowledgeSelectionQuery = {
      domains: readonly CreativeKnowledgeDomain[]
      allowedUse: CreativeKnowledgeAllowedUse
    }

    export type CreativeKnowledgeSelectionReceipt = {
      readonly packId: string
      readonly packRevision: string
      readonly selectionFingerprint: string
      readonly recordIds: readonly string[]
      readonly domains: readonly CreativeKnowledgeDomain[]
      readonly allowedUse: CreativeKnowledgeAllowedUse
    }

Create resolver.ts with:

    export function resolveCreativeKnowledge(input: {
      pack: CreativeKnowledgePack
      query: CreativeKnowledgeSelectionQuery
    }): {
      records: readonly CreativeKnowledgeRecord[]
      receipt: CreativeKnowledgeSelectionReceipt
    }

    export function resolveLocalCinematicKnowledge(
      query: CreativeKnowledgeSelectionQuery,
    ): ReturnType<typeof resolveCreativeKnowledge>

Validate pack and query, reject empty/sparse/duplicate/invalid domains, order domains by declared domain order, filter with isEligibleCreativeKnowledgeRecord, sort records by knowledgeId, and freeze all output. Receipt fingerprint starts ckr1_ and is an FNV-1a hash over canonical JSON containing pack id/revision, domains, allowed use, record ids, record revisions, and record content hashes. Copy the private FNV-1a logic from the existing fingerprint module as a private local helper; do not import a network client or use time/randomness.

Create index.ts that re-exports types, validator exports, local pack, and resolver exports. Append only one line to apps/web/src/lib/skills/index.ts:

    export * from '../creative-knowledge'

Do not modify registry, manifests, fingerprints, or existing execution behavior.

- [ ] **Step 4: Verify GREEN and commit.**

    pnpm --filter web exec tsx --test \
      src/lib/creative-knowledge/creativeKnowledge.test.ts \
      src/lib/skills/runtime.test.ts \
      src/lib/skills/shot-planning/shotPlanning.test.ts
    git add apps/web/src/lib/creative-knowledge/resolver.ts \
      apps/web/src/lib/creative-knowledge/index.ts \
      apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts \
      apps/web/src/lib/skills/index.ts
    git commit -m "feat: resolve local creative knowledge"

Expected: PASS with unchanged current Skill results.

## Task 4: Existing Capability Map

**Files:**
- Create: apps/web/src/lib/creative-knowledge/capability-map.ts
- Modify: apps/web/src/lib/creative-knowledge/index.ts
- Modify: apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts

- [ ] **Step 1: Write failing capability-map tests.**

    import {
      CREATOR_INTELLIGENCE_CAPABILITY_MAP,
      getCreatorIntelligenceCapability,
    } from './capability-map'

    test('maps every initial capability once to one existing owner', () => {
      const ids = CREATOR_INTELLIGENCE_CAPABILITY_MAP.map((item) => item.id)
      assert.deepEqual(ids, [
        'script-segmentation',
        'narrative-beat-analysis',
        'shot-planning',
        'storyboard-director',
        'storyboard-reference-extractor',
        'draw-annotation',
        'camera-control',
        'scene-lighting',
        'continuity-checker',
        'keyframe-extractor',
      ])
      assert.equal(getCreatorIntelligenceCapability('storyboard-director')?.owner, 'Storyboard Director Recipe')
      assert.equal(getCreatorIntelligenceCapability('missing'), null)
      assert.equal(new Set(ids).size, ids.length)
    })

    test('keeps every initial item local and strengthen-in-place', () => {
      for (const item of CREATOR_INTELLIGENCE_CAPABILITY_MAP) {
        assert.equal(item.deliveryMode, 'strengthen-in-place')
        assert.equal(item.requiresExternalGeneration, false)
        assert.equal(item.acquisitionDependency, 'none')
      }
    })

- [ ] **Step 2: Verify RED.**

    pnpm --filter web exec tsx --test src/lib/creative-knowledge/creativeKnowledge.test.ts

Expected: FAIL because capability-map.ts does not exist.

- [ ] **Step 3: Implement immutable map.**

    export type CreatorIntelligenceCapability = {
      id: string
      owner: string
      source: 'creator-skill' | 'canvas-tool' | 'recipe'
      domains: readonly CreativeKnowledgeDomain[]
      deliveryMode: 'strengthen-in-place'
      requiresExternalGeneration: false
      acquisitionDependency: 'none'
    }

    export const CREATOR_INTELLIGENCE_CAPABILITY_MAP = Object.freeze([
      capability('script-segmentation', 'Script Segmentation Skill', 'creator-skill', ['script']),
      capability('narrative-beat-analysis', 'Narrative Beat Analysis Skill', 'creator-skill', ['script']),
      capability('shot-planning', 'Shot Planning Skill', 'creator-skill', ['script', 'cinematography', 'composition']),
      capability('storyboard-director', 'Storyboard Director Recipe', 'recipe', ['script', 'cinematography', 'lighting', 'continuity']),
      capability('storyboard-reference-extractor', 'Storyboard Reference Extractor', 'canvas-tool', ['composition']),
      capability('draw-annotation', 'Draw Annotation Tool', 'canvas-tool', ['composition']),
      capability('camera-control', 'Camera Control Tool', 'canvas-tool', ['cinematography', 'composition']),
      capability('scene-lighting', 'Scene Lighting Tool', 'canvas-tool', ['lighting']),
      capability('continuity-checker', 'Continuity Check Tool', 'canvas-tool', ['continuity']),
      capability('keyframe-extractor', 'Keyframe Extractor Tool', 'canvas-tool', ['editing', 'continuity']),
    ] as const)

    export function getCreatorIntelligenceCapability(id: string) {
      const normalized = typeof id === 'string' ? id.trim() : ''
      return CREATOR_INTELLIGENCE_CAPABILITY_MAP.find((item) => item.id === normalized) ?? null
    }

The private capability helper rejects empty id/owner and duplicate domains, orders domains by the declared list, and freezes each record/domain list. Do not import UI, routes, NodeToolCenter, or API code. Export the map and type from creative-knowledge/index.ts.

- [ ] **Step 4: Verify GREEN and commit.**

    pnpm --filter web exec tsx --test \
      src/lib/creative-knowledge/creativeKnowledge.test.ts \
      src/lib/skills/runtime.test.ts \
      src/lib/skills/shot-planning/shotPlanning.test.ts
    git add apps/web/src/lib/creative-knowledge/capability-map.ts \
      apps/web/src/lib/creative-knowledge/index.ts \
      apps/web/src/lib/creative-knowledge/creativeKnowledge.test.ts
    git commit -m "feat: map creator intelligence capabilities"

Expected: PASS.

## Task 5: Static Forbidden-Boundary Test

**Files:**
- Create: scripts/creator-intelligence-knowledge-boundary.test.mjs

- [ ] **Step 1: Write the static guard.**

    import assert from 'node:assert/strict'
    import { readdir, readFile } from 'node:fs/promises'
    import test from 'node:test'
    import { fileURLToPath } from 'node:url'

    const ROOT = new URL('../apps/web/src/lib/creative-knowledge/', import.meta.url)
    const FORBIDDEN = [
      '/api/generate/',
      'fetch(',
      'axios',
      'prisma',
      'billing',
      'payment',
      'credits',
      'wallet',
      'process.env',
    ]

    test('knowledge foundation has no network/provider/payment/database/env dependency', async () => {
      const names = (await readdir(ROOT, { recursive: true })).sort()
      for (const name of names.filter((item) => item.endsWith('.ts'))) {
        const source = await readFile(fileURLToPath(new URL(name, ROOT)), 'utf8')
        for (const token of FORBIDDEN) {
          assert.equal(source.includes(token), false, name + ' must not include ' + token)
        }
      }
    })

- [ ] **Step 2: Verify the guard passes against the pure foundation.**

    node --test scripts/creator-intelligence-knowledge-boundary.test.mjs

Expected: PASS. The behavior-changing tasks above use RED/GREEN TDD; this static guard verifies an already-implemented negative dependency boundary.

- [ ] **Step 3: Add the public-export test, verify GREEN, and commit.**

    test('knowledge is public without changing the executable registry', async () => {
      const source = await readFile(
        new URL('../apps/web/src/lib/skills/index.ts', import.meta.url),
        'utf8',
      )
      assert.match(source, /export \* from '\.\.\/creative-knowledge'/)
    })

Run:

    node --test scripts/creator-intelligence-knowledge-boundary.test.mjs
    pnpm --filter web exec tsx --test \
      src/lib/creative-knowledge/creativeKnowledge.test.ts \
      src/lib/skills/runtime.test.ts \
      src/lib/skills/shot-planning/shotPlanning.test.ts
    git add scripts/creator-intelligence-knowledge-boundary.test.mjs
    git commit -m "test: guard creative knowledge boundaries"

Expected: PASS. Registry preservation is also enforced by the final diff scope check.

## Task 6: Verification, Docs, Delivery

**Files:**
- Modify: docs/CURRENT_STATUS.md
- Modify: docs/NEXT_TASKS.md

- [ ] **Step 1: Check diff scope.**

    git diff --name-only origin/main...HEAD
    git diff --check

Expected implementation changes only under apps/web/src/lib/creative-knowledge, one re-export in apps/web/src/lib/skills/index.ts, and the static guard. Any Provider/generation/billing/payment/credits/schema/migration/env/executor/package/lockfile diff is a hard stop: SCOPE_EXPANSION_REQUIRED.

- [ ] **Step 2: Run full validation.**

    pnpm type-check
    pnpm lint
    pnpm build
    node --test scripts/creator-intelligence-knowledge-boundary.test.mjs
    pnpm agent:check || node scripts/agent-loop-check.mjs
    git diff --check

Expected: type-check/build/static/agent/diff PASS. Lint may retain only pre-existing warnings and must be reported as warnings.

- [ ] **Step 3: Run browser read-only Canvas regression QA.**

Open an existing Canvas project in Preview or Production without saving, creating nodes, uploading, generating, opening Provider, or payment. Confirm existing Storyboard Director, Script Segmentation, Narrative Beat Analysis, Shot Planning, Camera, Lighting, Continuity, Reference Extractor, and Keyframe tools remain discoverable when the selected node is eligible. Capture console/network: no new console error and no non-GET generate, Provider, billing, credit, wallet, payment, recharge, or checkout mutation.

Expected: no new UI means this is a regression check. If authenticated browser control is unavailable, record QA_HARNESS_LIMITATION, never Production pass.

- [ ] **Step 4: Update task docs after verification.**

Add P0-CREATOR-INTELLIGENCE-KNOWLEDGE-ENGINE-A to docs/CURRENT_STATUS.md as:

    VALIDATED / CLOSED_WITH_PRODUCTION_READ_ONLY_QA_LIMITATION

Name the local pack, resolver, capability map, static guard, and exact tests. State no crawler, model, Provider/BYOK, generate route, billing/payment/credits, schema/env/executor, or Production DB behavior changed.

Update docs/NEXT_TASKS.md to close the foundation and list exactly one next task:

    P0-CREATOR-INTELLIGENCE-SCRIPT-TO-STORYBOARD-ADVISORY-B

That task may integrate knowledge receipts into the existing Script/Shot/Storyboard flow only after a separate design and plan approval. Do not start it automatically.

- [ ] **Step 5: Commit, push, deploy, and stop.**

    git add docs/CURRENT_STATUS.md docs/NEXT_TASKS.md
    git diff --cached --check
    git commit -m "docs: close creative knowledge foundation"
    git push origin main

Wait for Vercel Production Ready. Report exact commits, Production SHA, deploy result, validation, browser QA classification, and boundaries. Stop; do not begin Advisory B.

## Plan Self-Review

### Spec Coverage

- Versioned Creator City-owned knowledge, provenance, license, review, revocation, and stable receipt: Tasks 1-3.
- Existing-tool ownership and strengthen-in-place policy: Task 4.
- No crawler/network/model/Provider/payment/schema scope: Scope Lock, Task 5, and Task 6.
- Current Skill behavior preservation: Tasks 3, 5, and 6.
- Browser no-regression QA, deployment, and truthful status: Task 6.

### Placeholder Scan

The plan contains no unresolved placeholders or unspecified implementation steps. Every task names files, test cases, commands, expected results, and commits.

### Type Consistency

All tasks use the single CreativeKnowledgeRecord, CreativeKnowledgePack, CreativeKnowledgeSelectionQuery, and CreativeKnowledgeSelectionReceipt contract. Receipts start ckr1_; canonical CreatorSkillArtifact remains unchanged.
