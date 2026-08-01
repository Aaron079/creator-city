/**
 * Unit tests for storyboard grid split upload metadata allowlist.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/app/api/assets/upload/storyboard-grid-split-metadata.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildUploadAssetMetadata,
  parseStoryboardCropLineage,
  parseStoryboardGridSplitLineage,
} from './storyboard-grid-split-metadata'
import { buildStoryboardReferenceUploadFormData } from '@/lib/canvas/storyboardReferenceCrop'
import { buildStoryboardReferenceExtractionMetadata } from '@/lib/canvas/storyboardReferenceExtract'

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

    const parsed = parseStoryboardCropLineage(fd)
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
    assert.deepEqual(parseStoryboardCropLineage(fd), parsed)

    const metadata = buildUploadAssetMetadata({ ...baseStorageArgs(), lineage: parsed.lineage })
    assert.equal(metadata.storageProvider, 'aliyun-oss')
    assert.equal(metadata.storageKey, 'projects/p1/cell.png')
    assert.deepEqual(metadata.cropLineage, parsed.lineage)
  })

  test('accepts a reference extractor upload with only the V2 allowlisted lineage fields', () => {
    const fd = new FormData()
    fd.append('toolId', 'storyboard-reference-extractor')
    fd.append('parentAssetId', 'parent-a')
    fd.append('sourceAssetId', 'parent-a')
    fd.append('sourceNodeId', 'node-a')
    fd.append('extractionSessionId', 'extract-a')
    fd.append('index', '0')
    fd.append('cropBox', JSON.stringify({ x: 0, y: 0, width: 0.5, height: 0.5 }))

    const parsed = parseStoryboardCropLineage(fd)
    assert.deepEqual(parsed, {
      ok: true,
      lineage: {
        version: 2,
        toolId: 'storyboard-reference-extractor',
        parentAssetId: 'parent-a',
        sourceAssetId: 'parent-a',
        sourceNodeId: 'node-a',
        extractionSessionId: 'extract-a',
        index: 0,
        cropBox: { x: 0, y: 0, width: 0.5, height: 0.5 },
      },
    })
  })

  test('builds reference extractor FormData without legacy grid lineage fields', () => {
    const metadata = buildStoryboardReferenceExtractionMetadata({
      sourceAssetId: 'asset-source',
      sourceNodeId: 'node-source',
      extractionSessionId: 'extract-1',
      index: 2,
      crop: { x: 100, y: 50, width: 200, height: 100 },
      image: { width: 400, height: 200 },
    })
    const fd = buildStoryboardReferenceUploadFormData({
      blob: new Blob(['reference'], { type: 'image/jpeg' }),
      projectId: 'project-1',
      workflowId: 'workflow-1',
      title: 'reference-3',
      metadata,
    })

    assert.equal(fd.get('projectId'), 'project-1')
    assert.equal(fd.get('workflowId'), 'workflow-1')
    assert.equal(fd.get('type'), 'image')
    assert.equal(fd.get('toolId'), 'storyboard-reference-extractor')
    assert.equal(fd.get('parentAssetId'), 'asset-source')
    assert.equal(fd.get('sourceAssetId'), 'asset-source')
    assert.equal(fd.get('sourceNodeId'), 'node-source')
    assert.equal(fd.get('extractionSessionId'), 'extract-1')
    assert.equal(fd.get('index'), '2')
    assert.equal(fd.get('cropBox'), JSON.stringify({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }))
    assert.deepEqual([...fd.keys()].sort(), [
      'cropBox',
      'extractionSessionId',
      'file',
      'index',
      'parentAssetId',
      'projectId',
      'sourceAssetId',
      'sourceNodeId',
      'title',
      'toolId',
      'type',
      'workflowId',
    ])
    assert.equal(fd.has('row'), false)
    assert.equal(fd.has('col'), false)
    assert.equal(fd.has('gridSessionId'), false)
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
      assert.equal(parsed.message, '裁切元数据无效。')
    }
  })

  test('rejects invalid storyboard grid indexes with a metadata-specific error', () => {
    const fd = new FormData()
    fd.append('toolId', 'storyboard-grid-split')
    fd.append('cropBox', JSON.stringify({ x: 0, y: 0, width: 0.5, height: 0.5 }))
    fd.append('row', '0')
    fd.append('col', '-1')
    fd.append('index', '1')

    const parsed = parseStoryboardGridSplitLineage(fd)
    assert.equal(parsed.ok, false)
    assert.equal(parsed.errorCode, 'INVALID_GRID_INDEX')
    assert.equal(parsed.message, '裁切元数据无效。')
  })

  test('rejects malformed or incomplete reference extractor lineage', () => {
    const cases = [
      { cropBox: { x: 0, y: 0, width: 1.1, height: 0.5 } },
      { index: '-1' },
      { parentAssetId: ' ' },
      { sourceAssetId: ' ' },
      { sourceNodeId: ' ' },
      { extractionSessionId: ' ' },
    ]

    for (const invalid of cases) {
      const fd = new FormData()
      fd.append('toolId', 'storyboard-reference-extractor')
      fd.append('parentAssetId', invalid.parentAssetId ?? 'parent-a')
      fd.append('sourceAssetId', invalid.sourceAssetId ?? 'parent-a')
      fd.append('sourceNodeId', invalid.sourceNodeId ?? 'node-a')
      fd.append('extractionSessionId', invalid.extractionSessionId ?? 'extract-a')
      fd.append('index', invalid.index ?? '0')
      fd.append('cropBox', JSON.stringify(invalid.cropBox ?? { x: 0, y: 0, width: 0.5, height: 0.5 }))

      const parsed = parseStoryboardCropLineage(fd)
      assert.equal(parsed.ok, false)
    }
  })
})
