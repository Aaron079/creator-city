/**
 * Unit tests for /api/assets/upload project ownership validation.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/app/api/assets/upload/project-validation.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyUploadProjectAccess } from './project-validation'
import { verifyStoryboardReferenceSourceAccess } from './reference-source-access'

function prismaPoolTimeout() {
  return Object.assign(new Error('Timed out fetching a new connection from the connection pool.'), {
    code: 'P2024',
  })
}

describe('verifyUploadProjectAccess', () => {
  test('requires projectId for storyboard grid split uploads', async () => {
    const result = await verifyUploadProjectAccess({
      projectId: null,
      userId: 'user-1',
      required: true,
      lookupProjectOwnerId: async () => ({ ownerId: 'user-1' }),
      retryDelaysMs: [],
    })

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'PROJECT_REQUIRED')
    assert.equal(result.status, 400)
    assert.equal(result.message, '请先保存项目后再上传裁切资产。')
  })

  test('requires projectId for storyboard reference extraction uploads', async () => {
    const result = await verifyUploadProjectAccess({
      projectId: null,
      userId: 'user-1',
      required: true,
      lookupProjectOwnerId: async () => ({ ownerId: 'user-1' }),
      retryDelaysMs: [],
    })

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'PROJECT_REQUIRED')
    assert.equal(result.status, 400)
  })

  test('rejects unauthorized project without bypassing ownership', async () => {
    const result = await verifyUploadProjectAccess({
      projectId: 'project-1',
      userId: 'user-1',
      required: true,
      lookupProjectOwnerId: async () => ({ ownerId: 'other-user' }),
      retryDelaysMs: [],
    })

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'FORBIDDEN')
    assert.equal(result.status, 403)
    assert.equal(result.message, '无权访问该项目。')
  })

  test('rejects a reference extractor upload for a project owned by another user', async () => {
    const result = await verifyUploadProjectAccess({
      projectId: 'project-1',
      userId: 'user-1',
      required: true,
      lookupProjectOwnerId: async () => ({ ownerId: 'other-user' }),
      retryDelaysMs: [],
    })

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'FORBIDDEN')
    assert.equal(result.status, 403)
  })

  test('retries transient pool timeout and preserves project ownership on success', async () => {
    let calls = 0
    const result = await verifyUploadProjectAccess({
      projectId: 'project-1',
      userId: 'user-1',
      required: true,
      lookupProjectOwnerId: async () => {
        calls += 1
        if (calls === 1) throw prismaPoolTimeout()
        return { ownerId: 'user-1' }
      },
      retryDelaysMs: [0],
    })

    assert.equal(result.ok, true)
    assert.equal(calls, 2)
    assert.equal(result.attempts, 2)
  })

  test('returns a retryable 503 after repeated project DB pool timeouts', async () => {
    const result = await verifyUploadProjectAccess({
      projectId: 'project-1',
      userId: 'user-1',
      required: true,
      lookupProjectOwnerId: async () => {
        throw prismaPoolTimeout()
      },
      retryDelaysMs: [0, 0],
    })

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'PROJECT_CHECK_UNAVAILABLE')
    assert.equal(result.status, 503)
    assert.equal(result.message, '项目验证服务繁忙，请稍后重试。')
    assert.equal(result.attempts, 3)
  })
})

describe('verifyStoryboardReferenceSourceAccess', () => {
  const referenceLineage = {
    version: 2 as const,
    toolId: 'storyboard-reference-extractor' as const,
    parentAssetId: 'source-asset',
    sourceAssetId: 'source-asset',
    sourceNodeId: 'source-node',
    extractionSessionId: 'session-1',
    index: 0,
    cropBox: { x: 0, y: 0, width: 0.5, height: 0.5 },
  }

  test('rejects a missing reference source without disclosing its existence', async () => {
    const result = await verifyStoryboardReferenceSourceAccess({
      lineage: referenceLineage,
      projectId: 'project-1',
      userId: 'user-1',
      lookupSourceAsset: async () => null,
    })

    assert.deepEqual(result, {
      ok: false,
      errorCode: 'INVALID_REFERENCE_SOURCE',
      message: '参考图来源无效或无权访问。',
      status: 403,
    })
  })

  test('rejects a reference source owned by another user', async () => {
    const result = await verifyStoryboardReferenceSourceAccess({
      lineage: referenceLineage,
      projectId: 'project-1',
      userId: 'user-1',
      lookupSourceAsset: async () => ({ ownerId: 'user-2', projectId: 'project-1' }),
    })

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'INVALID_REFERENCE_SOURCE')
    assert.equal(result.message, '参考图来源无效或无权访问。')
    assert.equal(result.status, 403)
  })

  test('rejects a reference source from another project', async () => {
    const result = await verifyStoryboardReferenceSourceAccess({
      lineage: referenceLineage,
      projectId: 'project-1',
      userId: 'user-1',
      lookupSourceAsset: async () => ({ ownerId: 'user-1', projectId: 'project-2' }),
    })

    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'INVALID_REFERENCE_SOURCE')
    assert.equal(result.message, '参考图来源无效或无权访问。')
    assert.equal(result.status, 403)
  })

  test('accepts a same-project reference source owned by the current user', async () => {
    const result = await verifyStoryboardReferenceSourceAccess({
      lineage: referenceLineage,
      projectId: 'project-1',
      userId: 'user-1',
      lookupSourceAsset: async () => ({ ownerId: 'user-1', projectId: 'project-1' }),
    })

    assert.deepEqual(result, { ok: true })
  })

  test('leaves ordinary and legacy storyboard uploads without a reference source lookup', async () => {
    let lookupCalls = 0
    const result = await verifyStoryboardReferenceSourceAccess({
      lineage: {
        version: 1,
        toolId: 'storyboard-grid-split',
        cropBox: { x: 0, y: 0, width: 1, height: 1 },
      },
      projectId: 'project-1',
      userId: 'user-1',
      lookupSourceAsset: async () => {
        lookupCalls += 1
        return null
      },
    })

    assert.deepEqual(result, { ok: true })
    assert.equal(lookupCalls, 0)
  })
})
