import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  appendSeedancePrevisDeliveryMetadata,
  parseSeedancePrevisDeliveries,
  replaceSeedancePrevisDeliveryMetadata,
  updateSeedancePrevisDeliverySegmentResults,
} from './deliveryPersistence'

test('keeps delivery metadata isolated from the spatial previs snapshot', () => {
  const spatialPrevis = {
    version: 1,
    masterTake: { id: 'take-1' },
  }
  const existingMetadata = {
    existing: 'keep',
    spatialPrevis,
  }
  const source = structuredClone(existingMetadata)

  const next = appendSeedancePrevisDeliveryMetadata(existingMetadata, {
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    segmentResults: [],
  })

  assert.equal(next.existing, 'keep')
  assert.strictEqual(next.spatialPrevis, spatialPrevis)
  assert.deepEqual(existingMetadata, source)
  const deliveries = parseSeedancePrevisDeliveries(next)
  assert.ok(deliveries)
  assert.equal(deliveries.items[0]?.deliveryId, 'delivery-1')
})

test('appends an independent JSON delivery snapshot', () => {
  const delivery = {
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    package: {
      kind: 'provider-neutral-take',
      referenceImages: ['https://example.com/building.jpg'],
    },
    capabilitySnapshot: {
      providerId: 'volcengine-seedance-video',
      supports: { continuation: true },
    },
    acknowledgements: ['continuity-chain-recommended'],
    segmentResults: [{ segmentId: 'take-1:segment-1', providerTaskId: 'task-1' }],
  }

  const next = appendSeedancePrevisDeliveryMetadata({}, delivery)
  delivery.package.referenceImages[0] = 'https://example.com/changed.jpg'
  delivery.segmentResults[0]!.providerTaskId = 'task-2'

  const deliveries = parseSeedancePrevisDeliveries(next)
  assert.ok(deliveries)
  assert.deepEqual(deliveries, {
    version: 1,
    items: [{
      deliveryId: 'delivery-1',
      masterTakeId: 'take-1',
      package: {
        kind: 'provider-neutral-take',
        referenceImages: ['https://example.com/building.jpg'],
      },
      capabilitySnapshot: {
        providerId: 'volcengine-seedance-video',
        supports: { continuation: true },
      },
      acknowledgements: ['continuity-chain-recommended'],
      segmentResults: [{ segmentId: 'take-1:segment-1', providerTaskId: 'task-1' }],
    }],
  })
})

test('preserves valid prior deliveries while appending the next delivery', () => {
  const existingMetadata = appendSeedancePrevisDeliveryMetadata({}, {
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    segmentResults: [],
  })
  const source = structuredClone(existingMetadata)

  const next = appendSeedancePrevisDeliveryMetadata(existingMetadata, {
    deliveryId: 'delivery-2',
    masterTakeId: 'take-2',
    acknowledgements: ['warning-1'],
    segmentResults: [{ segmentId: 'take-2:segment-1' }],
  })

  assert.deepEqual(existingMetadata, source)
  const deliveries = parseSeedancePrevisDeliveries(next)
  assert.ok(deliveries)
  assert.deepEqual(deliveries.items.map((delivery) => delivery.deliveryId), ['delivery-1', 'delivery-2'])
})

test('records the provider result against only the dispatched delivery segment', () => {
  const existingMetadata = appendSeedancePrevisDeliveryMetadata({}, {
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    segmentResults: [{ segmentId: 'take-1:segment-1', status: 'submitting' }],
  })

  const next = updateSeedancePrevisDeliverySegmentResults(existingMetadata, 'delivery-1', [
    { segmentId: 'take-1:segment-1', status: 'submitted', providerTaskId: 'task-1' },
  ])

  assert.deepEqual(parseSeedancePrevisDeliveries(next)?.items[0]?.segmentResults, [
    { segmentId: 'take-1:segment-1', status: 'submitted', providerTaskId: 'task-1' },
  ])
})

test('replaces one immutable receipt without changing spatial previs or another delivery', () => {
  const existingMetadata = appendSeedancePrevisDeliveryMetadata({ spatialPrevis: { version: 1, masterTake: { id: 'take-1' } } }, {
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    package: { durationSec: 30 },
    segmentResults: [{ segmentId: 'take-1', index: 0, status: 'submitted' }],
  })
  const withSecondDelivery = appendSeedancePrevisDeliveryMetadata(existingMetadata, {
    deliveryId: 'delivery-2',
    masterTakeId: 'take-2',
    segmentResults: [],
  })
  const receipt = parseSeedancePrevisDeliveries(withSecondDelivery)?.items[0]
  assert.ok(receipt)

  const next = replaceSeedancePrevisDeliveryMetadata(withSecondDelivery, {
    ...receipt,
    segmentResults: [{ segmentId: 'take-1', index: 0, status: 'succeeded', videoUrl: 'https://example.com/take-1.mp4' }],
  })

  assert.deepEqual(next.spatialPrevis, { version: 1, masterTake: { id: 'take-1' } })
  assert.equal(parseSeedancePrevisDeliveries(next)?.items[0]?.segmentResults[0]?.status, 'succeeded')
  assert.equal(parseSeedancePrevisDeliveries(next)?.items[1]?.deliveryId, 'delivery-2')
})

test('parses only complete version-one delivery metadata records', () => {
  const invalidMetadata = [
    null,
    [],
    {},
    { seedancePrevisDeliveries: { version: 2, items: [] } },
    { seedancePrevisDeliveries: { version: 1, items: [], unexpected: true } },
    { seedancePrevisDeliveries: { version: 1, items: [{}] } },
    {
      seedancePrevisDeliveries: {
        version: 1,
        items: [{
          deliveryId: 'delivery-1',
          masterTakeId: 'take-1',
          package: null,
          capabilitySnapshot: null,
          acknowledgements: ['warning-1', 'warning-1'],
          segmentResults: [],
        }],
      },
    },
    {
      seedancePrevisDeliveries: {
        version: 1,
        items: [{
          deliveryId: 'delivery-1',
          masterTakeId: 'take-1',
          package: null,
          capabilitySnapshot: null,
          acknowledgements: [],
          segmentResults: [{ providerTaskId: 'task-1' }],
        }],
      },
    },
  ]

  for (const metadata of invalidMetadata) {
    assert.equal(parseSeedancePrevisDeliveries(metadata), null)
  }
})

test('rejects non-JSON delivery values and duplicate delivery identifiers', () => {
  assert.throws(
    () => appendSeedancePrevisDeliveryMetadata({}, {
      deliveryId: 'delivery-1',
      masterTakeId: 'take-1',
      package: new Map([['kind', 'provider-neutral-take']]) as never,
      segmentResults: [],
    }),
    /INVALID_SEEDANCE_PREVIS_DELIVERY/,
  )

  const existingMetadata = appendSeedancePrevisDeliveryMetadata({}, {
    deliveryId: 'delivery-1',
    masterTakeId: 'take-1',
    segmentResults: [],
  })
  assert.throws(
    () => appendSeedancePrevisDeliveryMetadata(existingMetadata, {
      deliveryId: 'delivery-1',
      masterTakeId: 'take-2',
      segmentResults: [],
    }),
    /DUPLICATE_SEEDANCE_PREVIS_DELIVERY/,
  )
})
