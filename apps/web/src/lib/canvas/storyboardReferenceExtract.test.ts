import assert from 'node:assert/strict'
import test from 'node:test'

import {
  STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID,
  buildStoryboardReferenceExtractionMetadata,
  normalizeReferenceCropBox,
} from './storyboardReferenceExtract'

test('normalizes a pixel selection against the source image dimensions', () => {
  assert.deepEqual(
    normalizeReferenceCropBox(
      { x: 123.4567899, y: 64.5, width: 300.1234567, height: 200.9876543 },
      { width: 1000, height: 800 },
    ),
    { x: 0.123457, y: 0.080625, width: 0.300123, height: 0.251235 },
  )
})

test('keeps rounded crop boundaries within normalized image bounds', () => {
  const cropBox = normalizeReferenceCropBox(
    { x: 125, y: 0, width: 3, height: 128 },
    { width: 128, height: 128 },
  )

  assert.ok(cropBox.x + cropBox.width <= 1)
  assert.ok(cropBox.y + cropBox.height <= 1)
})

test('rejects zero-area and out-of-bounds selections', () => {
  assert.throws(
    () => normalizeReferenceCropBox({ x: 0, y: 0, width: 0, height: 10 }, { width: 100, height: 100 }),
    /positive selection size/i,
  )
  assert.throws(
    () => normalizeReferenceCropBox({ x: 90, y: 0, width: 11, height: 10 }, { width: 100, height: 100 }),
    /image boundary/i,
  )
  assert.throws(
    () => normalizeReferenceCropBox({ x: -1, y: 0, width: 10, height: 10 }, { width: 100, height: 100 }),
    /negative/i,
  )
})

test('rejects non-finite values and nonpositive image dimensions', () => {
  assert.throws(
    () => normalizeReferenceCropBox({ x: Number.NaN, y: 0, width: 10, height: 10 }, { width: 100, height: 100 }),
    /finite/i,
  )
  assert.throws(
    () => normalizeReferenceCropBox({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 100 }),
    /image dimensions/i,
  )
})

test('builds stable version 2 metadata with source as parent', () => {
  const args = {
    sourceNodeId: 'node-source',
    sourceAssetId: 'asset-source',
    extractionSessionId: 'extract-session-1',
    index: 2,
    crop: { x: 10, y: 20, width: 30, height: 40 },
    image: { width: 100, height: 200 },
  } as const

  const first = buildStoryboardReferenceExtractionMetadata(args)
  const second = buildStoryboardReferenceExtractionMetadata(args)

  assert.deepEqual(first, second)
  assert.deepEqual(first, {
    version: 2,
    toolId: STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID,
    sourceAssetId: 'asset-source',
    sourceNodeId: 'node-source',
    parentAssetId: 'asset-source',
    extractionSessionId: 'extract-session-1',
    index: 2,
    cropBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
  })
})

test('rejects a negative extraction index', () => {
  assert.throws(
    () => buildStoryboardReferenceExtractionMetadata({
      sourceNodeId: 'node-source',
      sourceAssetId: 'asset-source',
      extractionSessionId: 'extract-session-1',
      index: -1,
      crop: { x: 0, y: 0, width: 10, height: 10 },
      image: { width: 100, height: 100 },
    }),
    /index/i,
  )
})

test('rejects blank source asset identifiers', () => {
  assert.throws(
    () => buildStoryboardReferenceExtractionMetadata({
      sourceNodeId: 'node-source',
      sourceAssetId: '   ',
      extractionSessionId: 'extract-session-1',
      index: 0,
      crop: { x: 0, y: 0, width: 10, height: 10 },
      image: { width: 100, height: 100 },
    }),
    /source asset id/i,
  )
})

test('rejects blank source node identifiers', () => {
  assert.throws(
    () => buildStoryboardReferenceExtractionMetadata({
      sourceNodeId: '\t',
      sourceAssetId: 'asset-source',
      extractionSessionId: 'extract-session-1',
      index: 0,
      crop: { x: 0, y: 0, width: 10, height: 10 },
      image: { width: 100, height: 100 },
    }),
    /source node id/i,
  )
})

test('rejects blank extraction session identifiers', () => {
  assert.throws(
    () => buildStoryboardReferenceExtractionMetadata({
      sourceNodeId: 'node-source',
      sourceAssetId: 'asset-source',
      extractionSessionId: '\n',
      index: 0,
      crop: { x: 0, y: 0, width: 10, height: 10 },
      image: { width: 100, height: 100 },
    }),
    /extraction session id/i,
  )
})
