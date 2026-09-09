import assert from 'node:assert/strict'
import { test } from 'node:test'
import { receiptFromDelivery } from './receipts'
import { assembleReviewTimeline, compareChainBoundaries } from './review'

function receiptWithThreeSegments() {
  return receiptFromDelivery({
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    package: {
      kind: 'provider-neutral-take',
      masterTakeId: 'take-1',
      durationSec: 90,
      chain: {
        segments: [
          { id: 'take-1:segment-1', index: 0, startSec: 0, endSec: 30 },
          {
            id: 'take-1:segment-2',
            index: 1,
            startSec: 30,
            endSec: 60,
            handoff: { nextFirstComposition: { camera: { position: { x: 1, y: 2, z: 3 } } } },
          },
          { id: 'take-1:segment-3', index: 2, startSec: 60, endSec: 90 },
        ],
      },
    },
    capabilitySnapshot: { model: 'seedance-2.5' },
    acknowledgements: ['continuity-chain-recommended'],
    segmentResults: [
      { segmentId: 'take-1:segment-1', index: 0, status: 'succeeded', videoUrl: 'https://example.com/1.mp4' },
      {
        segmentId: 'take-1:segment-2',
        index: 1,
        status: 'succeeded',
        videoUrl: 'https://example.com/2.mp4',
        observedStartCamera: { position: { x: 4, y: 2, z: 3 } },
      },
      { segmentId: 'take-1:segment-3', index: 2, status: 'succeeded', videoUrl: 'https://example.com/3.mp4' },
    ],
  })
}

test('assembles completed 30-second segments into one 90-second master timeline', () => {
  const timeline = assembleReviewTimeline(receiptWithThreeSegments())

  assert.equal(timeline.durationSec, 90)
  assert.equal(timeline.items[1]?.startSec, 30)
  assert.equal(timeline.items[1]?.videoUrl, 'https://example.com/2.mp4')
})

test('flags only the affected chain boundary when handoff camera position diverges', () => {
  const findings = compareChainBoundaries(receiptWithThreeSegments())

  assert.deepEqual(findings.map((finding) => finding.segmentId), ['take-1:segment-2'])
  assert.equal(findings[0]?.code, 'CAMERA_HANDOFF_DRIFT')
})
