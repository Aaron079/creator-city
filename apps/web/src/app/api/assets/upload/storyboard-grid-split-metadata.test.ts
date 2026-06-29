/**
 * Unit tests for storyboard grid split upload metadata allowlist.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildUploadAssetMetadata,
  parseStoryboardGridSplitLineage,
} from './storyboard-grid-split-metadata'

function baseStorageArgs() {
  return {
    storageProvider: 'aliyun-oss',
    bucket: 'cc-assets',
    key: 'projects/p1/cell.png',
    originalName: 'cell.png',
  }
}

describe('buildUploadAssetMetadata', () => {
  test('preserves ordinary upload metadata without cropLineage when toolId is absent', () => {
    const fd = new FormData()
    fd.append('metadataJson', JSON.stringify({ cropLineage: { injected: true } }))
    fd.append('storageProvider', 'client-provider')
    fd.append('bucket', 'client-bucket')
    fd.append('key', 'client-key')

    const parsed = parseStoryboardGridSplitLineage(fd)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.lineage, undefined)

    const metadata = buildUploadAssetMetadata({ ...baseStorageArgs(), lineage: parsed.lineage })
    assert.equal(metadata.storageProvider, 'aliyun-oss')
    assert.equal(metadata.bucket, 'cc-assets')
    assert.equal(metadata.key, 'projects/p1/cell.png')
    assert.equal(metadata.storageKey, 'projects/p1/cell.png')
    assert.equal(metadata.originalName, 'cell.png')
    assert.equal(metadata.source, 'assets-upload')
    assert.equal('cropLineage' in metadata, false)
    assert.equal('metadataJson' in metadata, false)
  })

  test('writes allowlisted storyboard grid split lineage while preserving storage metadata', () => {
    const fd = new FormData()
    fd.append('toolId', 'storyboard-grid-split')
    fd.append('parentAssetId', 'asset-parent')
    fd.append('sourceAssetId', 'asset-source')
    fd.append('sourceNodeId', 'node-source')
    fd.append('gridSessionId', 'grid-session-1')
    fd.append('cropBox', JSON.stringify({ x: 0.25, y: 0, width: 0.25, height: 0.5 }))
    fd.append('row', '1')
    fd.append('col', '2')
    fd.append('index', '5')

    const parsed = parseStoryboardGridSplitLineage(fd)
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.lineage, {
      version: 1,
      toolId: 'storyboard-grid-split',
      parentAssetId: 'asset-parent',
      sourceAssetId: 'asset-source',
      sourceNodeId: 'node-source',
      gridSessionId: 'grid-session-1',
      cropBox: { x: 0.25, y: 0, width: 0.25, height: 0.5 },
      row: 1,
      col: 2,
      index: 5,
    })

    const metadata = buildUploadAssetMetadata({ ...baseStorageArgs(), lineage: parsed.lineage })
    assert.equal(metadata.storageProvider, 'aliyun-oss')
    assert.equal(metadata.storageKey, 'projects/p1/cell.png')
    assert.deepEqual(metadata.cropLineage, parsed.lineage)
  })

  test('ignores illegal toolId and arbitrary metadata injection', () => {
    const fd = new FormData()
    fd.append('toolId', 'other-tool')
    fd.append('parentAssetId', 'asset-parent')
    fd.append('sourceNodeId', 'node-source')
    fd.append('metadataJson', JSON.stringify({ arbitrary: true }))
    fd.append('storageProvider', 'client-provider')
    fd.append('storageKey', 'client-storage-key')

    const parsed = parseStoryboardGridSplitLineage(fd)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.lineage, undefined)

    const metadata = buildUploadAssetMetadata({ ...baseStorageArgs(), lineage: parsed.lineage })
    assert.equal(metadata.storageProvider, 'aliyun-oss')
    assert.equal(metadata.storageKey, 'projects/p1/cell.png')
    assert.equal('arbitrary' in metadata, false)
    assert.equal('cropLineage' in metadata, false)
  })

  test('rejects invalid cropBox for storyboard grid split uploads', () => {
    for (const cropBox of [
      { x: -1, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0, width: 0, height: 0.5 },
      { x: 0, y: 0, width: 0.5, height: 0 },
      { x: 0, y: 0, width: 'wide', height: 0.5 },
    ]) {
      const fd = new FormData()
      fd.append('toolId', 'storyboard-grid-split')
      fd.append('cropBox', JSON.stringify(cropBox))
      const parsed = parseStoryboardGridSplitLineage(fd)
      assert.equal(parsed.ok, false)
      assert.equal(parsed.errorCode, 'INVALID_CROP_BOX')
    }
  })
})
