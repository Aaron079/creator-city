import assert from 'node:assert/strict'
import { test } from 'node:test'
import { receiptFromDelivery, recordSegmentResult } from './receipts'

function fixtureReceipt() {
  return receiptFromDelivery({
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    package: {
      kind: 'provider-neutral-take',
      masterTakeId: 'take-1',
      durationSec: 60,
      chain: {
        segments: [
          { id: 'take-1:segment-1', index: 0, startSec: 0, endSec: 30 },
          { id: 'take-1:segment-2', index: 1, startSec: 30, endSec: 60 },
        ],
      },
    },
    capabilitySnapshot: { model: 'seedance-2.5' },
    acknowledgements: ['continuity-chain-recommended'],
    segmentResults: [{ segmentId: 'take-1:segment-1', index: 0, status: 'submitted', providerTaskId: 'task-1' }],
  })
}

test('records a returned segment without changing the authored master take or prior receipt', () => {
  const receipt = fixtureReceipt()
  const next = recordSegmentResult(receipt, {
    segmentId: 'take-1:segment-2',
    status: 'succeeded',
    providerTaskId: 'task-2',
    videoUrl: 'https://example.com/2.mp4',
    completedAt: '2026-09-09T00:00:00.000Z',
  })

  assert.equal(next.segmentResults[1]?.providerTaskId, 'task-2')
  assert.equal(next.segmentResults[1]?.videoUrl, 'https://example.com/2.mp4')
  assert.equal(next.masterTakeId, 'take-1')
  assert.equal(receipt.masterTakeId, 'take-1')
  assert.equal(receipt.segmentResults.length, 1)
  assert.ok(Object.isFrozen(next))
})

test('rejects a receipt update for an unknown segment', () => {
  assert.throws(
    () => recordSegmentResult(fixtureReceipt(), { segmentId: 'unknown', status: 'failed', errorCode: 'FAILED' }),
    /SEEDANCE_PREVIS_SEGMENT_NOT_FOUND/,
  )
})
