import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildKeyframeExtractionProvenance } from './keyframe-extraction-provenance'

test('records browser-frame evidence without frame bytes', () => {
  const result = buildKeyframeExtractionProvenance({
    sourceNodeId: 'video-01',
    sourceAssetId: 'asset-01',
    sourceVideoUrlAvailable: true,
    selectedTimeSeconds: 3.5,
    selectedTimeLabel: '0:03.5',
    hasLocalFrame: true,
    previewStatus: 'available',
    createdAt: '2026-08-03T00:00:00.000Z',
  })

  assert.equal(result.version, 1)
  assert.equal(result.evidenceKind, 'browser-frame-preview')
  assert.equal(result.sourceAssetId, 'asset-01')
  assert.doesNotMatch(JSON.stringify(result), /data:image|base64/i)
})

test('falls back to timestamp-only evidence after a CORS restriction without an asset ID', () => {
  const result = buildKeyframeExtractionProvenance({
    sourceNodeId: 'video-02',
    sourceVideoUrlAvailable: true,
    selectedTimeSeconds: 0,
    selectedTimeLabel: '0:00.0',
    hasLocalFrame: false,
    previewStatus: 'cors-restricted',
    createdAt: '2026-08-03T00:00:00.000Z',
  })

  assert.equal(result.evidenceKind, 'time-point-reference')
  assert.equal('sourceAssetId' in result, false)
})

test('rejects local frame evidence with an unavailable preview status', () => {
  for (const previewStatus of ['not-extracted', 'cors-restricted', 'video-unavailable'] as const) {
    assert.throws(
      () => buildKeyframeExtractionProvenance({
        sourceNodeId: 'video-contradictory',
        sourceVideoUrlAvailable: true,
        selectedTimeSeconds: 1,
        selectedTimeLabel: '0:01.0',
        hasLocalFrame: true,
        previewStatus,
        createdAt: '2026-08-03T00:00:00.000Z',
      }),
      /requires an available preview status/,
    )
  }
})

test('rejects an available preview without local frame evidence', () => {
  assert.throws(
    () => buildKeyframeExtractionProvenance({
      sourceNodeId: 'video-available-without-frame',
      sourceVideoUrlAvailable: true,
      selectedTimeSeconds: 1,
      selectedTimeLabel: '0:01.0',
      hasLocalFrame: false,
      previewStatus: 'available',
      createdAt: '2026-08-03T00:00:00.000Z',
    }),
    /available preview status requires local frame evidence/,
  )
})

test('rejects a blank source identity before Canvas mutation', () => {
  assert.throws(
    () => buildKeyframeExtractionProvenance({
      sourceNodeId: ' ',
      sourceVideoUrlAvailable: true,
      selectedTimeSeconds: 0,
      selectedTimeLabel: '0:00.0',
      hasLocalFrame: false,
      previewStatus: 'not-extracted',
      createdAt: '2026-08-03T00:00:00.000Z',
    }),
    /source node ID/,
  )
})

test('rejects an invalid selected time', () => {
  assert.throws(
    () => buildKeyframeExtractionProvenance({
      sourceNodeId: 'video-03',
      sourceVideoUrlAvailable: true,
      selectedTimeSeconds: Number.NaN,
      selectedTimeLabel: '0:00.0',
      hasLocalFrame: false,
      previewStatus: 'not-extracted',
      createdAt: '2026-08-03T00:00:00.000Z',
    }),
    /non-negative finite number/,
  )
})
