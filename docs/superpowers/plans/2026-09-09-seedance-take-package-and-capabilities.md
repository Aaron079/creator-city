# P0-B Seedance Take Package and Capability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a saved spatial master take into an explicit, capability-aware Seedance direct-take or user-confirmed 30-second continuity-chain request without silently reducing duration or discarding unsupported controls.

**Architecture:** Keep spatial scene data provider-neutral, resolve a Seedance capability snapshot from provider/model/entry point/account entitlement, then build an immutable package and warnings from that snapshot. Extend the existing Seedance adapter through a dedicated package route, preserving current canvas video requests and keeping every paid decision explicit.

**Tech Stack:** Next.js App Router, TypeScript, existing Volcengine Seedance adapter, node:test, Playwright request interception.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| apps/web/src/lib/seedance-previs/capabilities.ts | Profile registry and entitlement-aware capability resolver. |
| apps/web/src/lib/seedance-previs/package.ts | Canonical package, prompt/action direction, reference ranking, and unsupported-control findings. |
| apps/web/src/lib/seedance-previs/partition.ts | Direct-take eligibility, 30-second segmentation, and exact handoff packets. |
| apps/web/src/lib/seedance-previs/advisory.ts | Non-blocking risk, cost, queue, and continuation recommendation. |
| apps/web/src/lib/seedance-previs/deliveryPersistence.ts | Versioned workflow-metadata records for package IDs, capability snapshots, acknowledgements, and segment receipts. |
| apps/web/src/lib/seedance-previs/*.test.ts | Capability, package, partition, handoff, and acknowledgement tests. |
| apps/web/src/app/api/generate/seedance-previs/route.ts | Authenticated package validation and adapter dispatch endpoint. |
| apps/web/src/lib/providers/china/volcengine.ts | Add a normalized multi-reference Seedance request without changing current single-node calls. |
| apps/web/src/components/create/spatial-previs/SeedanceDeliveryPanel.tsx | Explicit profile, warning acknowledgement, direct/chain choice, and submit UI. |
| apps/web/tests/e2e/seedance-previs-delivery.spec.ts | Browser proof that direct and chain requests remain distinguishable. |

### Task 1: Resolve capabilities from a snapshot rather than hard-coded UI limits

**Files:**
- Create: apps/web/src/lib/seedance-previs/capabilities.ts
- Test: apps/web/src/lib/seedance-previs/capabilities.test.ts

- [ ] **Step 1: Write the failing resolver test**

    test('exposes 180 seconds only for an entitled Seedance 2.5 long-take profile', () => {
      assert.equal(
        resolveSeedanceCapability({
          model: 'seedance-2.5',
          entryPoint: 'ark',
          entitlement: 'standard',
        }).maxSingleDurationSec,
        30,
      )
      assert.equal(
        resolveSeedanceCapability({
          model: 'seedance-2.5',
          entryPoint: 'ark',
          entitlement: 'long-take-beta',
        }).maxContinuousDurationSec,
        180,
      )
    })

- [ ] **Step 2: Run the test to verify it fails**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/capabilities.test.ts

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the profile contract**

    export type SeedanceEntitlement = 'standard' | 'long-take-beta'

    export type SeedanceCapability = {
      providerId: 'volcengine-seedance-video'
      model: string
      entryPoint: 'ark'
      entitlement: SeedanceEntitlement
      maxSingleDurationSec: 30
      maxContinuousDurationSec: 30 | 180
      supports: {
        firstFrame: boolean
        finalFrame: boolean
        imageReferences: boolean
        videoReferences: boolean
        audioReferences: boolean
        continuation: boolean
        depth: boolean
        segmentation: boolean
        layout: boolean
      }
    }

    export function resolveSeedanceCapability(input: {
      model: string
      entryPoint: 'ark'
      entitlement: SeedanceEntitlement
    }): SeedanceCapability {
      return {
        providerId: 'volcengine-seedance-video',
        model: input.model,
        entryPoint: input.entryPoint,
        entitlement: input.entitlement,
        maxSingleDurationSec: 30,
        maxContinuousDurationSec: input.entitlement === 'long-take-beta' ? 180 : 30,
        supports: {
          firstFrame: true,
          finalFrame: false,
          imageReferences: true,
          videoReferences: true,
          audioReferences: true,
          continuation: true,
          depth: false,
          segmentation: false,
          layout: false,
        },
      }
    }

Use an injected entitlement resolver at the route boundary. Never infer capability access from a client-side toggle.

- [ ] **Step 4: Run the resolver test**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/capabilities.test.ts

Expected: PASS.

- [ ] **Step 5: Commit the capability registry**

    git add apps/web/src/lib/seedance-previs/capabilities.ts apps/web/src/lib/seedance-previs/capabilities.test.ts
    git commit -m "feat: resolve Seedance previs capabilities"

### Task 2: Build direct-take packages and explicit chain handoffs

**Files:**
- Create: apps/web/src/lib/seedance-previs/package.ts
- Create: apps/web/src/lib/seedance-previs/partition.ts
- Test: apps/web/src/lib/seedance-previs/package.test.ts
- Test: apps/web/src/lib/seedance-previs/partition.test.ts

- [ ] **Step 1: Write failing package and chain tests**

    test('builds a provider-neutral package from the canonical master take', () => {
      const output = buildSeedanceTakePackage({
        previs: fixture,
        capability: standardCapability,
        deliveryMode: 'direct',
      })
      assert.equal(output.durationSec, 30)
      assert.match(output.direction, /camera/)
      assert.equal(output.capability.maxSingleDurationSec, 30)
    })

    test('does not create a chain without explicit confirmation', () => {
      assert.throws(
        () => partitionMasterTake(fixture180, { maxSegmentSec: 30, userConfirmed: false }),
        /CHAIN_CONFIRMATION_REQUIRED/,
      )
    })

    test('includes exact camera and actor states at every confirmed handoff', () => {
      const chain = partitionMasterTake(fixture180, { maxSegmentSec: 30, userConfirmed: true })
      assert.equal(chain.segments.length, 6)
      assert.deepEqual(
        chain.segments[1]?.handoff?.camera.position,
        sampleCamera(fixture180.masterTake.cameraTrack.keyframes, 30).position,
      )
    })

- [ ] **Step 2: Run tests to verify they fail**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/package.test.ts src/lib/seedance-previs/partition.test.ts

Expected: FAIL because package and partition modules do not exist.

- [ ] **Step 3: Implement package and partition functions**

    export type DeliveryMode = 'direct' | 'continuity-chain'

    export function partitionMasterTake(
      previs: SpatialPrevisState,
      input: { maxSegmentSec: number; userConfirmed: boolean },
    ) {
      if (!input.userConfirmed) throw new Error('CHAIN_CONFIRMATION_REQUIRED')
      const boundaries = Array.from(
        { length: Math.ceil(previs.masterTake.durationSec / input.maxSegmentSec) - 1 },
        (_, index) => (index + 1) * input.maxSegmentSec,
      )
      return { segments: buildSegments(previs, input.maxSegmentSec, boundaries) }
    }

For each boundary, build a handoff containing camera position, target, focalLengthMm, velocity, actor anchorId/position/action/velocity, requiredAnchors, previousLastFrameRef, and nextFirstComposition. BuildSeedanceTakePackage must retain unsupported requested derivatives in unsupportedControls and emit one warning for each; it must never silently omit requested control data.

- [ ] **Step 4: Run the package and partition tests**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/package.test.ts src/lib/seedance-previs/partition.test.ts

Expected: PASS.

- [ ] **Step 5: Commit package construction**

    git add apps/web/src/lib/seedance-previs/package.ts apps/web/src/lib/seedance-previs/partition.ts apps/web/src/lib/seedance-previs/package.test.ts apps/web/src/lib/seedance-previs/partition.test.ts
    git commit -m "feat: package Seedance previs takes and handoffs"

### Task 3: Add a non-blocking advisory and explicit delivery confirmation

**Files:**
- Create: apps/web/src/lib/seedance-previs/advisory.ts
- Test: apps/web/src/lib/seedance-previs/advisory.test.ts
- Create: apps/web/src/components/create/spatial-previs/SeedanceDeliveryPanel.tsx
- Test: apps/web/src/components/create/spatial-previs/SeedanceDeliveryPanel.test.tsx

- [ ] **Step 1: Write failing decision tests**

    test('recommends a chain for 180 seconds without long-take access but keeps direct generation selectable', () => {
      const advice = adviseSeedanceDelivery({
        requestedDurationSec: 180,
        capability: standardCapability,
        coverageFindings: [],
      })
      assert.equal(advice.recommendedMode, 'continuity-chain')
      assert.equal(advice.findings[0]?.blocking, false)
    })

    test('requires acknowledgement only for the selected chain, not as a silent fallback', () => {
      const html = renderToStaticMarkup(
        <SeedanceDeliveryPanel capability={standardCapability} package={fixturePackage} onSubmit={() => {}} />,
      )
      assert.match(html, /继续直接生成/)
      assert.match(html, /确认使用 30 秒连续组接/)
    })

- [ ] **Step 2: Run tests to verify they fail**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/advisory.test.ts src/components/create/spatial-previs/SeedanceDeliveryPanel.test.tsx

Expected: FAIL because advisory and delivery panel do not exist.

- [ ] **Step 3: Implement the warning and confirmation model**

Use id, code, severity, blocking: false, message, and remedy for every advisory. The panel must display active model and entitlement, direct duration, estimated segment count, accepted-warning checkboxes, and two independent actions: 继续直接生成 and 确认使用 30 秒连续组接. The submit payload contains requestedMode, confirmedMode, and acknowledgedFindingIds; do not mutate them after the user chooses.

- [ ] **Step 4: Run advisory and panel tests**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/advisory.test.ts src/components/create/spatial-previs/SeedanceDeliveryPanel.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit explicit delivery UI**

    git add apps/web/src/lib/seedance-previs/advisory.ts apps/web/src/lib/seedance-previs/advisory.test.ts apps/web/src/components/create/spatial-previs/SeedanceDeliveryPanel.tsx apps/web/src/components/create/spatial-previs/SeedanceDeliveryPanel.test.tsx
    git commit -m "feat: require explicit Seedance continuity choice"

### Task 4: Dispatch package data to Seedance without changing current node requests

**Files:**
- Create: apps/web/src/app/api/generate/seedance-previs/route.ts
- Modify: apps/web/src/lib/providers/china/volcengine.ts
- Create: apps/web/src/lib/seedance-previs/deliveryPersistence.ts
- Test: apps/web/src/app/api/generate/seedance-previs/route.test.ts
- Test: apps/web/src/lib/seedance-previs/deliveryPersistence.test.ts
- Test: apps/web/src/lib/providers/china/volcengine.test.ts

- [ ] **Step 1: Write failing route contract tests**

    test('rejects an unacknowledged continuity chain before adapter dispatch', async () => {
      const response = await POST(request({
        requestedMode: 'continuity-chain',
        confirmedMode: null,
        acknowledgedFindingIds: [],
      }))
      assert.equal(response.status, 400)
      assert.equal((await response.json()).errorCode, 'CHAIN_CONFIRMATION_REQUIRED')
    })

    test('keeps current Seedance imageUrl calls valid while accepting previs references', async () => {
      const request = buildSeedanceRequest({
        prompt: 'x',
        imageUrl: 'https://example.com/first.jpg',
        referenceImages: ['https://example.com/building.jpg'],
      })
      assert.equal(request.image_url, 'https://example.com/first.jpg')
      assert.deepEqual(request.reference_images, ['https://example.com/building.jpg'])
    })

- [ ] **Step 2: Run tests to verify they fail**

Run: cd apps/web && node_modules/.bin/tsx --test src/app/api/generate/seedance-previs/route.test.ts src/lib/providers/china/volcengine.test.ts

Expected: FAIL because the dedicated route and normalized request builder do not exist.

- [ ] **Step 3: Implement the safe route and adapter extension**

Implement appendSeedancePrevisDeliveryMetadata(existing, delivery) in deliveryPersistence.ts. It stores a versioned seedancePrevisDeliveries array under CanvasWorkflow.metadataJson and preserves every unrelated metadata key. The route authenticates with getCurrentUser, re-resolves capability, rebuilds package server-side, validates direct/chain choice, writes the delivery ID, package, capability snapshot, acknowledgements, and initial segment receipts through db.canvasWorkflow.update, then calls generateSeedancePrevisVideo. Preserve generateSeedanceVideo(input) and current callers. The new adapter input supports prompt, imageUrl, referenceImages, referenceVideos, audioReferences, duration, aspectRatio, resolution, and continuation; translate only fields active capability supports.

    test('keeps delivery metadata isolated from the spatial previs snapshot', () => {
      const next = appendSeedancePrevisDeliveryMetadata(
        { spatialPrevis: { version: 1 }, existing: 'keep' },
        { deliveryId: 'delivery-1', masterTakeId: 'take-1', segmentResults: [] },
      )
      assert.equal(next.existing, 'keep')
      assert.equal((next.spatialPrevis as { version: number }).version, 1)
      assert.equal(parseSeedancePrevisDeliveries(next).items[0]?.deliveryId, 'delivery-1')
    })

- [ ] **Step 4: Run route and adapter tests**

Run: cd apps/web && node_modules/.bin/tsx --test src/app/api/generate/seedance-previs/route.test.ts src/lib/providers/china/volcengine.test.ts src/lib/seedance-previs/deliveryPersistence.test.ts && pnpm type-check

Expected: PASS and TypeScript exits 0.

- [ ] **Step 5: Commit dispatch integration**

    git add apps/web/src/app/api/generate/seedance-previs/route.ts apps/web/src/app/api/generate/seedance-previs/route.test.ts apps/web/src/lib/providers/china/volcengine.ts apps/web/src/lib/providers/china/volcengine.test.ts apps/web/src/lib/seedance-previs/deliveryPersistence.ts apps/web/src/lib/seedance-previs/deliveryPersistence.test.ts
    git commit -m "feat: dispatch capability-aware Seedance previs takes"

### Task 5: Verify the delivery boundary

**Files:**
- Create: apps/web/tests/e2e/seedance-previs-delivery.spec.ts

- [ ] **Step 1: Add browser contract coverage**

    test('does not silently switch a requested long take to a continuity chain', async ({ page }) => {
      await page.route(
        '**/api/generate/seedance-previs',
        async (route) => route.fulfill({ json: { success: true, taskId: 'task-1' } }),
      )
      await page.getByRole('button', { name: '生成到 Seedance' }).click()
      await expect(page.getByText('确认使用 30 秒连续组接')).toBeVisible()
      await expect(page.getByRole('button', { name: '继续直接生成' })).toBeVisible()
    })

- [ ] **Step 2: Run delivery verification**

Run: cd apps/web && pnpm exec playwright test tests/e2e/seedance-previs-delivery.spec.ts && pnpm type-check && pnpm experience:check

Expected: all commands exit 0.

- [ ] **Step 3: Commit verification**

    git add apps/web/tests/e2e/seedance-previs-delivery.spec.ts
    git commit -m "test: cover explicit Seedance previs delivery choice"

## Self-Review

- Spec coverage: capability contract, 30/180 duration, direct versus explicit chain, no-block warnings, reference package, handoff packets, and Seedance-only P0 are covered by Tasks 1-4.
- Boundary: current video-node requests remain untouched; P0-B uses a dedicated route and additive UI.
- Type consistency: all delivery construction consumes SpatialPrevisState from P0-A and creates SeedanceTakePackage; provider fields are never written back into the canonical scene.
- Placeholder scan: every task names exact files, observable contracts, and commands.
