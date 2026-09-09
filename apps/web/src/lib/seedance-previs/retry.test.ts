import assert from 'node:assert/strict'
import { test } from 'node:test'
import { receiptFromDelivery } from './receipts'
import { buildSegmentRetry } from './retry'

function receipt() {
  return receiptFromDelivery({
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    package: {
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
      { segmentId: 'take-1:segment-2', index: 1, status: 'failed', errorCode: 'provider_failed' },
    ],
  })
}

test('builds a retry request only for the failed segment and retains its prior handoff', () => {
  const retry = buildSegmentRetry(receipt(), 'take-1:segment-2')

  assert.equal(retry.segment.id, 'take-1:segment-2')
  assert.deepEqual(retry.segment.handoff, { previousLastFrameRef: { segmentId: 'take-1:segment-1', timeSec: 30 } })
  assert.equal(retry.package.segments.length, 1)
  assert.equal(retry.package.segments[0]?.id, 'take-1:segment-2')
})

test('rejects retry for a completed segment without a review finding', () => {
  assert.throws(
    () => buildSegmentRetry(receipt(), 'take-1:segment-1'),
    /SEGMENT_RETRY_NOT_ELIGIBLE/,
  )
})
