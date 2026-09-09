import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SeedancePrevisVideoInput, SeedanceVideoResult } from '@/lib/providers/china/volcengine'
import { appendSeedancePrevisDeliveryMetadata, parseSeedancePrevisDeliveries } from '@/lib/seedance-previs/deliveryPersistence'
import { createSeedancePrevisRetryPostHandler } from './handler'

function request(body: Record<string, unknown>) {
  return new Request('http://creator-city.test/api/generate/seedance-previs/delivery-1/retry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: 'project-1', workflowId: 'workflow-1', ...body }),
  })
}

function metadata(secondStatus: 'failed' | 'succeeded' = 'failed') {
  return appendSeedancePrevisDeliveryMetadata({}, {
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    package: {
      direction: 'Keep the camera following the actor.',
      aspectRatio: '16:9',
      durationSec: 60,
      chain: {
        segments: [
          { id: 'take-1:segment-1', index: 0, startSec: 0, endSec: 30 },
          {
            id: 'take-1:segment-2',
            index: 1,
            startSec: 30,
            endSec: 60,
            handoff: { previousLastFrameRef: { segmentId: 'take-1:segment-1', timeSec: 30 } },
          },
        ],
      },
    },
    capabilitySnapshot: { model: 'seedance-2.5' },
    acknowledgements: ['continuity-chain-recommended'],
    segmentResults: [
      { segmentId: 'take-1:segment-1', index: 0, status: 'succeeded', videoUrl: 'https://example.com/1.mp4' },
      secondStatus === 'failed'
        ? { segmentId: 'take-1:segment-2', index: 1, status: 'failed', errorCode: 'provider_failed' }
        : { segmentId: 'take-1:segment-2', index: 1, status: 'succeeded', videoUrl: 'https://example.com/2.mp4' },
    ],
  })
}

function harness(secondStatus: 'failed' | 'succeeded' = 'failed') {
  const calls: SeedancePrevisVideoInput[] = []
  let persisted: Record<string, unknown> = metadata(secondStatus)
  const result: SeedanceVideoResult = {
    success: true,
    async: true,
    providerId: 'volcengine-seedance-video',
    model: 'seedance-2.5',
    taskId: 'retry-task-2',
    status: 'running',
    message: 'submitted',
  }
  return {
    calls,
    get persisted() { return persisted },
    post: createSeedancePrevisRetryPostHandler({
      getCurrentUser: async () => ({ id: 'user-1' }),
      findWorkflow: async () => ({ id: 'workflow-1', projectId: 'project-1', metadataJson: persisted }),
      updateWorkflowMetadata: async (_workflowId, next) => { persisted = next },
      resolveModel: () => 'seedance-2.5',
      resolveEntitlement: () => 'standard',
      platformDispatchEnabled: () => true,
      createGenerationJob: async () => ({ id: 'retry-job-2' }),
      updateGenerationJob: async () => {},
      generate: async (input) => { calls.push(input); return result },
    }),
  }
}

test('retries only the failed segment and keeps its prior segment as a reference', async () => {
  const subject = harness()
  const response = await subject.post(request({ segmentId: 'take-1:segment-2' }), { params: Promise.resolve({ deliveryId: 'delivery-1' }) })

  assert.equal(response.status, 200)
  assert.equal(subject.calls.length, 1)
  assert.equal(subject.calls[0]?.duration, 30)
  assert.deepEqual(subject.calls[0]?.referenceVideos, ['https://example.com/1.mp4'])
  const delivery = parseSeedancePrevisDeliveries(subject.persisted)?.items[0]
  assert.equal(delivery?.segmentResults[0]?.status, 'succeeded')
  assert.equal(delivery?.segmentResults[1]?.providerTaskId, 'retry-task-2')
})

test('rejects retry for a completed segment without a user-selected review finding', async () => {
  const subject = harness('succeeded')
  const response = await subject.post(request({ segmentId: 'take-1:segment-2' }), { params: Promise.resolve({ deliveryId: 'delivery-1' }) })

  assert.equal(response.status, 409)
  assert.equal((await response.json()).errorCode, 'SEGMENT_RETRY_NOT_ELIGIBLE')
  assert.equal(subject.calls.length, 0)
})
