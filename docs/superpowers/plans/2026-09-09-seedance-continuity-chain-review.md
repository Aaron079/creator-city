# P0-C Seedance Continuity Chain Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users preview, review, and recover a direct Seedance take or a confirmed 30-second continuity chain as one master timeline, including targeted regeneration of only the failing segment.

**Architecture:** Persist per-segment task receipts separately from the canonical master take, normalize returned media into a chain-review model, and compare the returned sequence to authored anchors, actor/camera states, composition locks, and handoff boundaries. The review UI extends the new spatial director panel and never changes existing canvas result nodes.

**Tech Stack:** React, TypeScript, HTML video, existing Seedance task polling, node:test, Playwright.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| apps/web/src/lib/seedance-previs/receipts.ts | Immutable task receipt and segment result normalization. |
| apps/web/src/lib/seedance-previs/deliveryPersistence.ts | P0-B workflow-metadata storage updated with each immutable receipt. |
| apps/web/src/lib/seedance-previs/review.ts | Master timeline assembly and constraint-difference findings. |
| apps/web/src/lib/seedance-previs/retry.ts | Targeted retry eligibility and one-segment request construction. |
| apps/web/src/lib/seedance-previs/*.test.ts | Receipt, assembly, review, and retry tests. |
| apps/web/src/components/create/spatial-previs/SeedanceChainReviewPanel.tsx | Master preview, segment rail, boundary review, and targeted retry. |
| apps/web/src/components/create/spatial-previs/SeedanceChainReviewPanel.test.tsx | Render contract for assembled chain and segment-only recovery. |
| apps/web/src/app/api/generate/seedance-previs/[deliveryId]/retry/route.ts | Authenticated single-segment retry endpoint. |
| apps/web/tests/e2e/seedance-previs-chain-review.spec.ts | Browser acceptance of assembled review and targeted retry. |

### Task 1: Persist task receipts without mutating the authored take

**Files:**
- Create: apps/web/src/lib/seedance-previs/receipts.ts
- Modify: apps/web/src/lib/seedance-previs/deliveryPersistence.ts
- Test: apps/web/src/lib/seedance-previs/receipts.test.ts

- [ ] **Step 1: Write a failing immutable receipt test**

    test('records a returned segment without changing the authored master take', () => {
      const receipt = recordSegmentResult(fixturePackage, {
        segmentId: 'segment-2',
        taskId: 'task-2',
        videoUrl: 'https://example.com/2.mp4',
      })
      assert.equal(receipt.segmentResults[1]?.taskId, 'task-2')
      assert.equal(receipt.masterTakeId, fixturePackage.masterTakeId)
      assert.equal(fixturePackage.masterTakeId, 'take-1')
    })

- [ ] **Step 2: Run the test to verify it fails**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/receipts.test.ts

Expected: FAIL because receipts.ts does not exist.

- [ ] **Step 3: Implement receipt normalization**

Implement SeedanceDeliveryReceipt with deliveryId, masterTakeId, immutable capabilitySnapshot, acknowledgedFindingIds, segments, and segmentResults. Record a result's task ID, provider request ID, URL, timestamps, and error details. RecordSegmentResult returns a new receipt and rejects unknown segment IDs. Add replaceSeedancePrevisDeliveryMetadata(existing, receipt) to the P0-B metadata module, then use it at every task-status transition. It must not copy, mutate, or overwrite canonical scene, tracks, beats, or package inputs.

- [ ] **Step 4: Run the receipt test**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/receipts.test.ts

Expected: PASS.

- [ ] **Step 5: Commit receipts**

    git add apps/web/src/lib/seedance-previs/receipts.ts apps/web/src/lib/seedance-previs/receipts.test.ts apps/web/src/lib/seedance-previs/deliveryPersistence.ts
    git commit -m "feat: record Seedance previs delivery receipts"

### Task 2: Assemble one master review timeline and flag concrete drift

**Files:**
- Create: apps/web/src/lib/seedance-previs/review.ts
- Test: apps/web/src/lib/seedance-previs/review.test.ts

- [ ] **Step 1: Write failing assembly and boundary tests**

    test('assembles completed 30-second segments into one 90-second master timeline', () => {
      const timeline = assembleReviewTimeline(receiptWithThreeSegments)
      assert.equal(timeline.durationSec, 90)
      assert.equal(timeline.items[1]?.startSec, 30)
    })

    test('flags only the affected chain boundary when handoff camera position diverges', () => {
      const findings = compareChainBoundaries(receiptWithCameraDrift, fixturePrevis)
      assert.deepEqual(findings.map((finding) => finding.segmentId), ['segment-2'])
      assert.equal(findings[0]?.code, 'CAMERA_HANDOFF_DRIFT')
    })

- [ ] **Step 2: Run tests to verify they fail**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/review.test.ts

Expected: FAIL because review.ts does not exist.

- [ ] **Step 3: Implement master assembly and focused comparison**

Assemble the timeline from each package segment's authored startSec and endSec, not its nominal video-file duration. Implement findings with code, timeSec, segmentId, constraint, message, and recommendedAction. Start with deterministic checks based on required handoff state plus manual reviewable markers. Do not claim pixel-level computer-vision matching.

- [ ] **Step 4: Run the review tests**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/review.test.ts

Expected: PASS.

- [ ] **Step 5: Commit timeline review**

    git add apps/web/src/lib/seedance-previs/review.ts apps/web/src/lib/seedance-previs/review.test.ts
    git commit -m "feat: assemble and review Seedance continuity chains"

### Task 3: Permit only targeted segment retry

**Files:**
- Create: apps/web/src/lib/seedance-previs/retry.ts
- Test: apps/web/src/lib/seedance-previs/retry.test.ts
- Create: apps/web/src/app/api/generate/seedance-previs/[deliveryId]/retry/route.ts
- Test: apps/web/src/app/api/generate/seedance-previs/[deliveryId]/retry/route.test.ts

- [ ] **Step 1: Write failing retry tests**

    test('builds a retry request only for the failed segment and retains prior handoff', () => {
      const retry = buildSegmentRetry(receipt, 'segment-2')
      assert.equal(retry.segment.id, 'segment-2')
      assert.equal(retry.segment.handoff?.fromSegmentId, 'segment-1')
      assert.equal(retry.package.segments.length, 1)
    })

    test('rejects retry for a completed segment without a review finding', async () => {
      const response = await POST(requestFor('segment-1'))
      assert.equal(response.status, 409)
      assert.equal((await response.json()).errorCode, 'SEGMENT_RETRY_NOT_ELIGIBLE')
    })

- [ ] **Step 2: Run tests to verify they fail**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/retry.test.ts src/app/api/generate/seedance-previs/[deliveryId]/retry/route.test.ts

Expected: FAIL because retry modules do not exist.

- [ ] **Step 3: Implement retry eligibility and route**

Allow retry only when the segment failed, returned no usable media, or has a user-selected review finding. Build a one-segment package retaining original profile/capability snapshot, asset references, first composition, and prior handoff. The route authenticates, verifies delivery ownership, persists a new task receipt for that segment, and uses the P0-B Seedance adapter. It must never resend completed neighbouring segments.

- [ ] **Step 4: Run retry tests**

Run: cd apps/web && node_modules/.bin/tsx --test src/lib/seedance-previs/retry.test.ts src/app/api/generate/seedance-previs/[deliveryId]/retry/route.test.ts

Expected: PASS.

- [ ] **Step 5: Commit targeted retry**

    git add apps/web/src/lib/seedance-previs/retry.ts apps/web/src/lib/seedance-previs/retry.test.ts apps/web/src/app/api/generate/seedance-previs/[deliveryId]/retry/route.ts apps/web/src/app/api/generate/seedance-previs/[deliveryId]/retry/route.test.ts
    git commit -m "feat: retry failed Seedance continuity segments"

### Task 4: Present one continuous user-review surface

**Files:**
- Create: apps/web/src/components/create/spatial-previs/SeedanceChainReviewPanel.tsx
- Test: apps/web/src/components/create/spatial-previs/SeedanceChainReviewPanel.test.tsx
- Modify: apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx

- [ ] **Step 1: Write the failing review-panel test**

    test('renders one master playhead with a segment rail and a segment-only retry control', () => {
      const html = renderToStaticMarkup(
        <SeedanceChainReviewPanel receipt={fixtureReceipt} previs={fixturePrevis} onRetry={() => {}} />,
      )
      assert.match(html, /data-master-review-timeline="true"/)
      assert.match(html, /00:30/)
      assert.match(html, /仅重新生成此段/)
    })

- [ ] **Step 2: Run the panel test to verify it fails**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SeedanceChainReviewPanel.test.tsx

Expected: FAIL because the review panel does not exist.

- [ ] **Step 3: Implement synchronized review**

Render preview video surfaces from assembleReviewTimeline and use one shared current-time state for preview and segment rail. Render review markers at authored timeSec. Expose 仅重新生成此段 only for buildSegmentRetry-eligible segments. Mount the review as a tab in the spatial director panel; do not replace an existing canvas media review or result node.

- [ ] **Step 4: Run the review panel test**

Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SeedanceChainReviewPanel.test.tsx

Expected: PASS.

- [ ] **Step 5: Commit the review UI**

    git add apps/web/src/components/create/spatial-previs/SeedanceChainReviewPanel.tsx apps/web/src/components/create/spatial-previs/SeedanceChainReviewPanel.test.tsx apps/web/src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx
    git commit -m "feat: review Seedance previs master takes"

### Task 5: End-to-end QA, including a controlled BYOK run

**Files:**
- Create: apps/web/tests/e2e/seedance-previs-chain-review.spec.ts
- Modify: docs/superpowers/specs/2026-09-09-seedance-long-take-previs-design.md only for factual acceptance results discovered in QA.

- [ ] **Step 1: Add a no-provider browser acceptance test**

    test('shows the full 90-second preview and retries only the drifted segment', async ({ page }) => {
      await page.route(
        '**/api/generate/seedance-previs/**/retry',
        async (route) => route.fulfill({ json: { success: true, taskId: 'retry-2' } }),
      )
      await page.getByRole('tab', { name: '生成复核' }).click()
      await expect(page.locator('[data-master-review-timeline="true"]')).toBeVisible()
      await page.getByRole('button', { name: '仅重新生成此段' }).click()
      await expect(page.getByText('retry-2')).toBeVisible()
    })

- [ ] **Step 2: Run automated verification**

Run: cd apps/web && pnpm exec playwright test tests/e2e/seedance-previs-chain-review.spec.ts && pnpm type-check && pnpm experience:check && pnpm test:experience-locks

Expected: all commands exit 0.

- [ ] **Step 3: Run controlled manual Seedance BYOK QA**

Use a dedicated test account and a scene with named exterior anchors, one actor, a camera-follow path, and a 90-second chain. Record capability snapshot and warning acknowledgement before requests. Verify returned videos assemble into one master review timeline; select one boundary finding and retry only that segment. Record observed drift by anchor, actor, camera, composition, and boundary. Do not label the result pixel-perfect.

- [ ] **Step 4: Commit QA documentation only when the approved specification needs factual correction**

    git add docs/superpowers/specs/2026-09-09-seedance-long-take-previs-design.md
    git commit -m "docs: record Seedance previs QA findings"

Skip this commit if no specification correction is needed.

## Self-Review

- Spec coverage: receipt persistence, continuous chain playback, boundary comparison, non-pixel-perfect review, and targeted regeneration are covered by Tasks 1-4.
- User control: retry is opt-in and restricted to a failed or intentionally flagged segment.
- Provider boundary: all retry dispatch reuses P0-B's capability-aware Seedance adapter.
- Lock coverage: the review mounts only inside the new director tool and runs confirmed-experience checks.
- Placeholder scan: every task contains observable success conditions and exact command paths.
