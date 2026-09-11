import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SeedancePrevisVideoInput, SeedanceVideoResult } from '@/lib/providers/china/volcengine'
import { spatialPrevisMetadata } from '@/lib/spatial-previs/persistence'
import { normalizeSpatialPrevis } from '@/lib/spatial-previs/normalize'
import { createSeedancePrevisGetHandler, createSeedancePrevisPostHandler } from './handler'

type Harness = {
  post: ReturnType<typeof createSeedancePrevisPostHandler>
  calls: SeedancePrevisVideoInput[]
  metadata: Record<string, unknown>
  persisted: Record<string, unknown> | null
  createdJob: { nodeId?: string; masterTakeId: string } | null
  generationJobUpdates: Array<{ id: string; status: string; providerJobId?: string }>
  receiptUpdateAttempts: number
  validatedWorkflowIds: string[]
  validatedNodeIds: string[]
}

function request(body: Record<string, unknown>) {
  return new Request('http://creator-city.test/api/generate/seedance-previs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createHarness(input: {
  durationSec?: number
  entitlement?: 'standard' | 'long-take-beta'
  model?: string
  testNode?: { kind: string; status: string; metadataJson: unknown } | null
  claimTestReceipt?: (metadata: Record<string, unknown>) => Promise<boolean>
  concurrentMetadata?: Record<string, unknown>
  conflictFirstReceiptUpdate?: Record<string, unknown>
  alwaysConflictReceiptUpdate?: boolean
} = {}): Harness {
  const previs = normalizeSpatialPrevis({
    projectId: 'project-1',
    durationSec: input.durationSec ?? 60,
    sourceMode: 'multi-view',
    updatedAt: '2026-09-09T00:00:00.000Z',
  })
  let metadata = spatialPrevisMetadata({ unrelated: 'keep' }, previs)
  const calls: SeedancePrevisVideoInput[] = []
  const generationJobUpdates: Array<{ id: string; status: string; providerJobId?: string }> = []
  const validatedWorkflowIds: string[] = []
  const validatedNodeIds: string[] = []
  let persisted: Record<string, unknown> | null = null
  let createdJob: { nodeId?: string; masterTakeId: string } | null = null
  let updatedAt = new Date('2026-09-11T00:00:00.000Z')
  let receiptUpdateAttempts = 0
  let conflictedReceiptUpdate = false
  const advanceRevision = () => {
    updatedAt = new Date(updatedAt.getTime() + 1)
  }
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
      findWorkflow: async () => ({
        id: 'workflow-1',
        projectId: 'project-1',
        metadataJson: metadata,
        updatedAt,
      }),
      findCanvasNode: async (workflowId, nodeId) => {
        validatedWorkflowIds.push(workflowId)
        validatedNodeIds.push(nodeId)
        return input.testNode === undefined
          ? { kind: 'video', status: 'running', metadataJson: { spatialPrevisTest: true } }
          : input.testNode
      },
      reserveSpatialPrevisTestReceipt: async (_workflow, nextMetadata) => {
        const claimed = await (input.claimTestReceipt?.(nextMetadata) ?? Promise.resolve(true))
        if (claimed) {
          metadata = nextMetadata
          persisted = nextMetadata
          advanceRevision()
        }
        return claimed
      },
      updateWorkflowMetadata: async (_workflowId, nextMetadata) => {
        metadata = nextMetadata
        persisted = nextMetadata
        advanceRevision()
      },
      updateWorkflowMetadataIfCurrent: async (workflow, nextMetadata) => {
        receiptUpdateAttempts += 1
        if (input.alwaysConflictReceiptUpdate) return false
        if (!conflictedReceiptUpdate && input.conflictFirstReceiptUpdate) {
          conflictedReceiptUpdate = true
          metadata = { ...metadata, ...input.conflictFirstReceiptUpdate }
          persisted = metadata
          advanceRevision()
          return false
        }
        if (workflow.updatedAt.getTime() !== updatedAt.getTime()) return false
        metadata = nextMetadata
        persisted = nextMetadata
        advanceRevision()
        return true
      },
      resolveEntitlement: () => input.entitlement ?? 'standard',
      resolveModel: () => input.model ?? 'seedance-2.5',
      platformDispatchEnabled: () => true,
      createGenerationJob: async (generationJob) => {
        createdJob = generationJob
        return { id: 'generation-job-1' }
      },
      updateGenerationJob: async (id, update) => { generationJobUpdates.push({ id, status: update.status, providerJobId: update.providerJobId }) },
      generate: async (generationInput) => {
        calls.push(generationInput)
        if (input.concurrentMetadata) {
          metadata = { ...metadata, ...input.concurrentMetadata }
          persisted = metadata
          advanceRevision()
        }
        return result
      },
      createDeliveryId: () => 'delivery-1',
    }),
    calls,
    metadata,
    get persisted() { return persisted },
    get createdJob() { return createdJob },
    generationJobUpdates,
    get receiptUpdateAttempts() { return receiptUpdateAttempts },
    validatedWorkflowIds,
    validatedNodeIds,
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

test('keeps platform dispatch default-denied before any workflow or provider action', async () => {
  const post = createSeedancePrevisPostHandler({
    getCurrentUser: async () => ({ id: 'user-1' }),
    platformDispatchEnabled: () => false,
  })
  const response = await post(request(body()))

  assert.equal(response.status, 403)
  assert.equal((await response.json()).errorCode, 'VIDEO_GENERATION_NOT_READY')
})

test('uses the server-resolved model instead of the submitted model string', async () => {
  const harness = createHarness({ durationSec: 30, model: 'dreamina-seedance-2-0-260128' })
  const response = await harness.post(request(body({ model: 'seedance-2.5' })))

  assert.equal(response.status, 200)
  assert.equal(harness.calls[0]?.model, 'dreamina-seedance-2-0-260128')
  assert.equal(harness.calls[0]?.capability.model, 'dreamina-seedance-2-0-260128')
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
  assert.deepEqual(harness.generationJobUpdates, [{ id: 'generation-job-1', status: 'QUEUED', providerJobId: 'task-1' }])
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
    items: Array<{ segmentResults: Array<{ status: string; providerTaskId?: string }>; package: { chain: { segments: unknown[] } } }>
  }
  assert.deepEqual(deliveries.items[0]?.segmentResults.map((segment) => segment.status), ['submitted', 'queued'])
  assert.equal(deliveries.items[0]?.segmentResults[0]?.providerTaskId, 'task-1')
  assert.equal(deliveries.items[0]?.package.chain.segments.length, 2)
})

test('publishes the server-resolved capability without trusting a client entitlement', async () => {
  const get = createSeedancePrevisGetHandler({
    getCurrentUser: async () => ({ id: 'beta-user' }),
    resolveModel: () => 'dreamina-seedance-2-5-260826',
    resolveEntitlement: () => 'long-take-beta',
  })

  const response = await get(new Request('http://creator-city.test/api/generate/seedance-previs?model=seedance-2.0'))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.capability.model, 'dreamina-seedance-2-5-260826')
  assert.equal(payload.capability.entitlement, 'long-take-beta')
  assert.equal(payload.capability.maxContinuousDurationSec, 180)
})

test('uses an isolated 10 second take, persists the supplied node id, and returns the generation job id', async () => {
  const harness = createHarness({ durationSec: 60 })
  const response = await harness.post(request(body({
    nodeId: 'spatial-test-node-1',
    testDurationSec: 10,
    imageUrl: 'https://cdn.example/street.jpg',
    referenceImages: ['https://cdn.example/street.jpg'],
    referenceVideos: ['https://cdn.example/walkthrough.mp4'],
  })))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.generationJobId, 'generation-job-1')
  assert.equal(payload.testDurationSec, 10)
  assert.equal(harness.createdJob?.nodeId, 'spatial-test-node-1')
  assert.deepEqual(harness.validatedWorkflowIds, ['workflow-1'])
  assert.deepEqual(harness.validatedNodeIds, ['spatial-test-node-1'])
  assert.equal(harness.createdJob?.masterTakeId, 'master-take@test-10')
  assert.equal(harness.calls[0]?.duration, 10)
  assert.deepEqual(harness.persisted?.spatialPrevis, harness.metadata.spatialPrevis)
  const deliveries = harness.persisted?.seedancePrevisDeliveries as {
    items: Array<{ masterTakeId: string; package: { durationSec: number } }>
  }
  assert.equal(deliveries.items[0]?.masterTakeId, 'master-take@test-10')
  assert.equal(deliveries.items[0]?.package.durationSec, 10)
})

test('rejects an internal test duration outside the 5 or 10 second choices', async () => {
  const harness = createHarness()
  const response = await harness.post(request(body({ testDurationSec: 15 })))

  assert.equal(response.status, 400)
  assert.equal((await response.json()).errorCode, 'VALIDATION_FAILED')
  assert.equal(harness.calls.length, 0)
})

test('rejects an internal test without a canvas node id before persistence or dispatch', async () => {
  const harness = createHarness()
  const response = await harness.post(request(body({ testDurationSec: 5 })))

  assert.equal(response.status, 400)
  assert.equal((await response.json()).errorCode, 'VALIDATION_FAILED')
  assert.equal(harness.persisted, null)
  assert.equal(harness.createdJob, null)
  assert.equal(harness.calls.length, 0)
})

test('rejects an internal test unless its persisted owned node is a running spatial video test', async () => {
  const invalidNodes = [
    { kind: 'image', status: 'running', metadataJson: { spatialPrevisTest: true } },
    { kind: 'video', status: 'done', metadataJson: { spatialPrevisTest: true } },
    { kind: 'video', status: 'running', metadataJson: {} },
  ]

  for (const testNode of invalidNodes) {
    const harness = createHarness({ testNode })
    const response = await harness.post(request(body({ nodeId: 'spatial-test-node-1', testDurationSec: 5 })))

    assert.equal(response.status, 409)
    assert.equal((await response.json()).errorCode, 'SPATIAL_PREVIS_TEST_NODE_INVALID')
    assert.equal(harness.persisted, null)
    assert.equal(harness.createdJob, null)
    assert.equal(harness.calls.length, 0)
  }
})

test('atomically blocks a concurrent internal test before a second receipt or dispatch is created', async () => {
  let claimed = false
  const harness = createHarness({
    claimTestReceipt: async () => {
      if (claimed) return false
      claimed = true
      return true
    },
  })

  const responses = await Promise.all([
    harness.post(request(body({ nodeId: 'spatial-test-node-1', testDurationSec: 5 }))),
    harness.post(request(body({ nodeId: 'spatial-test-node-2', testDurationSec: 10 }))),
  ])

  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409])
  assert.equal(harness.calls.length, 1)
  assert.equal(harness.createdJob?.nodeId === 'spatial-test-node-1' || harness.createdJob?.nodeId === 'spatial-test-node-2', true)
  const deliveries = harness.persisted?.seedancePrevisDeliveries as { items: unknown[] }
  assert.equal(deliveries.items.length, 1)
})

test('retries an internal receipt transition against current metadata without losing concurrent edits', async () => {
  const harness = createHarness({
    concurrentMetadata: { editorNote: 'keep-after-reservation' },
    conflictFirstReceiptUpdate: { editorRevision: 'keep-after-conflict' },
  })

  const response = await harness.post(request(body({ nodeId: 'spatial-test-node-1', testDurationSec: 5 })))

  assert.equal(response.status, 200)
  assert.equal(harness.persisted?.editorNote, 'keep-after-reservation')
  assert.equal(harness.persisted?.editorRevision, 'keep-after-conflict')
  assert.equal(harness.receiptUpdateAttempts, 2)
  const deliveries = harness.persisted?.seedancePrevisDeliveries as {
    items: Array<{ segmentResults: Array<{ status: string }> }>
  }
  assert.equal(deliveries.items[0]?.segmentResults[0]?.status, 'submitted')
})

test('returns a recoverable accepted internal-test receipt when final workflow persistence keeps conflicting', async () => {
  const harness = createHarness({ alwaysConflictReceiptUpdate: true })

  const response = await harness.post(request(body({ nodeId: 'spatial-test-node-1', testDurationSec: 5 })))
  const payload = await response.json()

  assert.equal(response.status, 202)
  assert.equal(payload.accepted, true)
  assert.equal(payload.status, 'running')
  assert.equal(payload.generationJobId, 'generation-job-1')
  assert.equal(payload.result, undefined)
  assert.equal(harness.calls.length, 1)
  assert.equal(harness.receiptUpdateAttempts, 3)
  assert.deepEqual(harness.generationJobUpdates, [{ id: 'generation-job-1', status: 'QUEUED', providerJobId: 'task-1' }])
})
