/**
 * Unit tests for /api/assets/upload project ownership validation.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/app/api/assets/upload/project-validation.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyUploadProjectAccess } from './project-validation'

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
