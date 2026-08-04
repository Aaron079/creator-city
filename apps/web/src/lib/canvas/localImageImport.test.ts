/**
 * Unit tests for localImageImport.ts
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/canvas/localImageImport.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  getLocalImportKind,
  validateLocalImageFile,
  validateLocalMediaFile,
  buildLocalImportMetadata,
  buildUploadFormData,
  getImportNodeTitle,
  getLocalImportDisplayUrl,
  LOCAL_IMPORT_MAX_SIZE_BYTES,
  LOCAL_IMPORT_MAX_DIMENSION,
} from './localImageImport'

function makeFile(name: string, type: string, size: number): File {
  const buf = new Uint8Array(size)
  return new File([buf], name, { type })
}

describe('validateLocalImageFile', () => {
  test('accepts image/jpeg', () => {
    const f = makeFile('photo.jpg', 'image/jpeg', 1024)
    assert.deepEqual(validateLocalImageFile(f), { ok: true })
  })

  test('accepts image/png', () => {
    const f = makeFile('img.png', 'image/png', 1024)
    assert.deepEqual(validateLocalImageFile(f), { ok: true })
  })

  test('accepts image/webp', () => {
    const f = makeFile('img.webp', 'image/webp', 1024)
    assert.deepEqual(validateLocalImageFile(f), { ok: true })
  })

  test('rejects image/gif', () => {
    const f = makeFile('anim.gif', 'image/gif', 1024)
    const r = validateLocalImageFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects image/svg+xml', () => {
    const f = makeFile('icon.svg', 'image/svg+xml', 512)
    const r = validateLocalImageFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects image/heic', () => {
    const f = makeFile('shot.heic', 'image/heic', 1024)
    const r = validateLocalImageFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('rejects file exactly at 20MB + 1 byte', () => {
    const f = makeFile('big.jpg', 'image/jpeg', LOCAL_IMPORT_MAX_SIZE_BYTES + 1)
    const r = validateLocalImageFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'TOO_LARGE')
  })

  test('accepts file exactly at 20MB', () => {
    const f = makeFile('max.jpg', 'image/jpeg', LOCAL_IMPORT_MAX_SIZE_BYTES)
    assert.deepEqual(validateLocalImageFile(f), { ok: true })
  })

  test('rejects empty type string', () => {
    const f = makeFile('noext', '', 512)
    const r = validateLocalImageFile(f)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })

  test('keeps video out of image-only reference inputs', () => {
    const r = validateLocalImageFile(makeFile('shot.mp4', 'video/mp4', 1024))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.error.code, 'INVALID_TYPE')
  })
})

describe('validateLocalMediaFile', () => {
  test('accepts an MP4 video for a Canvas video node', () => {
    assert.deepEqual(validateLocalMediaFile(makeFile('shot.mp4', 'video/mp4', 1024)), { ok: true })
  })

  test('accepts a WebM video for a Canvas video node', () => {
    assert.deepEqual(validateLocalMediaFile(makeFile('shot.webm', 'video/webm', 1024)), { ok: true })
  })

  test('accepts a QuickTime video for a Canvas video node', () => {
    assert.deepEqual(validateLocalMediaFile(makeFile('shot.mov', 'video/quicktime', 1024)), { ok: true })
  })

  test('maps supported files to their Canvas node kind', () => {
    assert.equal(getLocalImportKind(makeFile('frame.png', 'image/png', 1)), 'image')
    assert.equal(getLocalImportKind(makeFile('shot.mp4', 'video/mp4', 1)), 'video')
    assert.equal(getLocalImportKind(makeFile('sound.mp3', 'audio/mpeg', 1)), null)
  })
})

describe('getImportNodeTitle', () => {
  test('strips extension from simple filename', () => {
    const f = makeFile('my-photo.jpg', 'image/jpeg', 1)
    assert.equal(getImportNodeTitle(f), 'my-photo')
  })

  test('strips only last extension when multiple dots', () => {
    const f = makeFile('my.photo.v2.png', 'image/png', 1)
    assert.equal(getImportNodeTitle(f), 'my.photo.v2')
  })

  test('returns full name when no extension', () => {
    const f = makeFile('README', 'image/png', 1)
    assert.equal(getImportNodeTitle(f), 'README')
  })

  test('handles leading dot (hidden file)', () => {
    const f = makeFile('.hidden', 'image/png', 1)
    assert.equal(getImportNodeTitle(f), '.hidden')
  })
})

describe('buildLocalImportMetadata', () => {
  test('returns all required fields', () => {
    const f = makeFile('shot.jpg', 'image/jpeg', 1024)
    const meta = buildLocalImportMetadata(f, 'asset-abc-123')
    assert.equal(meta.importedFromLocal, true)
    assert.equal(meta.importSource, 'drag-drop')
    assert.equal(meta.originalFileName, 'shot.jpg')
    assert.equal(meta.mimeType, 'image/jpeg')
    assert.equal(meta.assetId, 'asset-abc-123')
    assert.ok(typeof meta.uploadedAt === 'string' && meta.uploadedAt.length > 0)
  })

  test('uploadedAt is a valid ISO string', () => {
    const f = makeFile('x.png', 'image/png', 1)
    const meta = buildLocalImportMetadata(f, 'id-1')
    const d = new Date(meta.uploadedAt as string)
    assert.ok(!Number.isNaN(d.getTime()), 'uploadedAt is not a valid date')
  })

  test('records the video kind for a local video import', () => {
    const meta = buildLocalImportMetadata(makeFile('shot.webm', 'video/webm', 1), 'id-video', 'video')
    assert.equal(meta.mediaKind, 'video')
  })
})

describe('getLocalImportDisplayUrl', () => {
  test('uses the authenticated asset proxy for private storage URLs', () => {
    assert.equal(
      getLocalImportDisplayUrl({ id: 'asset-abc-123', url: 'storage://supabase/creator-city-assets/path/image.png' }),
      '/api/assets/asset-abc-123/file',
    )
  })

  test('keeps a browser-renderable asset URL unchanged', () => {
    assert.equal(
      getLocalImportDisplayUrl({ id: 'asset-abc-123', url: 'https://cdn.example.test/path/image.png' }),
      'https://cdn.example.test/path/image.png',
    )
  })
})

describe('buildUploadFormData', () => {
  test('appends required fields', () => {
    const f = makeFile('scene.webp', 'image/webp', 512)
    const fd = buildUploadFormData(f, 'proj-1', 'wf-1', 'node-1')
    assert.equal(fd.get('projectId'), 'proj-1')
    assert.equal(fd.get('workflowId'), 'wf-1')
    assert.equal(fd.get('nodeId'), 'node-1')
    assert.equal(fd.get('type'), 'image')
    assert.equal(fd.get('title'), 'scene')
    assert.ok(fd.get('file') instanceof File)
  })

  test('omits workflowId and nodeId when not provided', () => {
    const f = makeFile('x.jpg', 'image/jpeg', 1)
    const fd = buildUploadFormData(f, 'proj-2')
    assert.equal(fd.get('workflowId'), null)
    assert.equal(fd.get('nodeId'), null)
  })

  test('sends a video upload as type video', () => {
    const f = makeFile('shot.mp4', 'video/mp4', 512)
    const fd = buildUploadFormData(f, 'proj-3', 'wf-3', 'node-3', 'video')
    assert.equal(fd.get('type'), 'video')
  })

  test('LOCAL_IMPORT_MAX_SIZE_BYTES is 20MB', () => {
    assert.equal(LOCAL_IMPORT_MAX_SIZE_BYTES, 20 * 1024 * 1024)
  })

  test('LOCAL_IMPORT_MAX_DIMENSION is 8192', () => {
    assert.equal(LOCAL_IMPORT_MAX_DIMENSION, 8192)
  })
})

describe('uploadImageWithTimeout', () => {
  test('throws UPLOAD_TIMEOUT on AbortError', async () => {
    const originalFetch = globalThis.fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = async (_url: string, opts: RequestInit) => {
      await new Promise<void>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => reject(Object.assign(new Error('AbortError'), { name: 'AbortError' })))
      })
    }
    const { uploadImageWithTimeout } = await import('./localImageImport')
    const fd = new FormData()
    const p = uploadImageWithTimeout(fd, 1)
    await assert.rejects(p, (err: Error) => {
      assert.equal(err.message, 'UPLOAD_TIMEOUT')
      return true
    })
    ;(globalThis as any).fetch = originalFetch
  })

  test('throws on non-ok response', async () => {
    const originalFetch = globalThis.fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = async () => ({
      ok: false,
      json: async () => ({ success: false, message: '服务器错误' }),
    })
    const { uploadImageWithTimeout } = await import('./localImageImport')
    const fd = new FormData()
    await assert.rejects(uploadImageWithTimeout(fd), /服务器错误/)
    ;(globalThis as any).fetch = originalFetch
  })

  test('returns asset on success', async () => {
    const originalFetch = globalThis.fetch
    const mockAsset = { id: 'asset-1', url: 'https://oss.example.com/test.jpg', name: 'test.jpg' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => ({ success: true, asset: mockAsset }),
    })
    const { uploadImageWithTimeout } = await import('./localImageImport')
    const fd = new FormData()
    const result = await uploadImageWithTimeout(fd)
    assert.deepEqual(result, mockAsset)
    ;(globalThis as any).fetch = originalFetch
  })
})
