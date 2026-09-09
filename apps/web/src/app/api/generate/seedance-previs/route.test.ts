import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SeedancePrevisVideoInput, SeedanceVideoResult } from '@/lib/providers/china/volcengine'
import { spatialPrevisMetadata } from '@/lib/spatial-previs/persistence'
import { normalizeSpatialPrevis } from '@/lib/spatial-previs/normalize'
import { createSeedancePrevisPostHandler } from './route'

type Harness = {
  post: ReturnType<typeof createSeedancePrevisPostHandler>
  calls: SeedancePrevisVideoInput[]
  metadata: Record<string, unknown>
  persisted: Record<string, unknown> | null
}

function request(body: Record<string, unknown>) {
  return new Request('http://creator-city.test/api/generate/seedance-previs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createHarness(input: { durationSec?: number; entitlement?: 'standard' | 'long-take-beta' } = {}): Harness {
  const previs = normalizeSpatialPrevis({
    projectId: 'project-1',
    durationSec: input.durationSec ?? 60,
    sourceMode: 'multi-view',
    updatedAt: '2026-09-09T00:00:00.000Z',
  })
  const metadata = spatialPrevisMetadata({ unrelated: 'keep' }, previs)
  const calls: SeedancePrevisVideoInput[] = []
  let persisted: Record<string, unknown> | null = null
  const result: SeedanceVideoResult = {
    success: true,
    async: true,
    providerId: 'volcengine-seedance-video',
    model: 'seedance-2.5',
    taskId: 'task-1',
    status: 'running',
    message: 'submitted',
  }

  return {
    post: createSeedancePrevisPostHandler({
      getCurrentUser: async () => ({ id: 'user-1' }),
      findWorkflow: async () => ({ id: 'workflow-1', projectId: 'project-1', metadataJson: metadata }),
      updateWorkflowMetadata: async (_workflowId, nextMetadata) => { persisted = nextMetadata },
      resolveEntitlement: () => input.entitlement ?? 'standard',
      generate: async (generationInput) => {
        calls.push(generationInput)
        return result
      },
      createDeliveryId: () => 'delivery-1',
    }),
    calls,
    metadata,
    get persisted() { return persisted },
  }
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'project-1',
    workflowId: 'workflow-1',
    model: 'seedance-2.5',
    requestedMode: 'direct',
    confirmedMode: 'direct',
    acknowledgedFindingIds: [],
    ...overrides,
  }
}

test('rejects an unacknowledged continuity chain before persistence or adapter dispatch', async () => {
  const harness = createHarness()
  const response = await harness.post(request(body({
    requestedMode: 'continuity-chain',
    confirmedMode: null,
  })))

  assert.equal(response.status, 400)
  assert.equal((await response.json()).errorCode, 'CHAIN_CONFIRMATION_REQUIRED')
  assert.equal(harness.persisted, null)
  assert.equal(harness.calls.length, 0)
})

test('keeps a selected direct delivery direct and preserves unrelated workflow metadata', async () => {
  const harness = createHarness({ durationSec: 30 })
  const response = await harness.post(request(body({ prompt: 'Follow the actor through the entry.' })))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.deliveryMode, 'direct')
  assert.equal(harness.calls.length, 1)
  assert.equal(harness.calls[0]?.duration, 30)
  assert.equal(harness.calls[0]?.continuation, false)
  assert.equal(harness.persisted?.unrelated, 'keep')
  assert.deepEqual(harness.persisted?.spatialPrevis, harness.metadata.spatialPrevis)
  const deliveries = harness.persisted?.seedancePrevisDeliveries as { items: Array<{ package: { deliveryMode: string } }> }
  assert.equal(deliveries.items[0]?.package.deliveryMode, 'direct')
})

test('uses server entitlement and queues only the first confirmed continuity segment', async () => {
  const harness = createHarness({ durationSec: 60, entitlement: 'standard' })
  const response = await harness.post(request(body({
    requestedMode: 'continuity-chain',
    confirmedMode: 'continuity-chain',
    acknowledgedFindingIds: ['continuity-chain-recommended'],
    entitlement: 'long-take-beta',
  })))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.deliveryMode, 'continuity-chain')
  assert.equal(payload.segmentCount, 2)
  assert.equal(harness.calls.length, 1)
  assert.equal(harness.calls[0]?.duration, 30)
  assert.equal(harness.calls[0]?.continuation, true)
  assert.equal(harness.calls[0]?.capability.entitlement, 'standard')
  const deliveries = harness.persisted?.seedancePrevisDeliveries as {
    items: Array<{ segmentResults: Array<{ status: string }>; package: { chain: { segments: unknown[] } } }>
  }
  assert.deepEqual(deliveries.items[0]?.segmentResults.map((segment) => segment.status), ['submitting', 'queued'])
  assert.equal(deliveries.items[0]?.package.chain.segments.length, 2)
})
