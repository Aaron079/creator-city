import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { receiptFromDelivery } from '@/lib/seedance-previs/receipts'
import { SeedanceChainReviewPanel } from './SeedanceChainReviewPanel'

function receipt() {
  return receiptFromDelivery({
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    package: {
      durationSec: 60,
      chain: {
        segments: [
          { id: 'take-1:segment-1', index: 0, startSec: 0, endSec: 30 },
          { id: 'take-1:segment-2', index: 1, startSec: 30, endSec: 60 },
        ],
      },
    },
    capabilitySnapshot: { model: 'seedance-2.5' },
    acknowledgements: [],
    segmentResults: [
      { segmentId: 'take-1:segment-1', index: 0, status: 'succeeded', videoUrl: 'https://example.com/1.mp4' },
      { segmentId: 'take-1:segment-2', index: 1, status: 'failed', errorCode: 'provider_failed' },
    ],
  })
}

test('renders one master playhead with a segment rail and a segment-only retry control', () => {
  const html = renderToStaticMarkup(
    <SeedanceChainReviewPanel receipt={receipt()} onRetry={async () => ({ success: true, message: 'submitted' })} />,
  )

  assert.match(html, /data-master-review-timeline="true"/)
  assert.match(html, /00:30/)
  assert.match(html, /仅重新生成此段/)
})
