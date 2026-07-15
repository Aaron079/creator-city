import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  CANVAS_SAVE_CLIENT_TIMEOUT_MS,
  CANVAS_SAVE_SERVER_DEADLINE_MS,
  canvasSaveFailure,
  consumePendingCanvasSave,
} from './canvasSaveIntegrity'

describe('canvas save acknowledgement', () => {
  test('accepts only a clean successful response', () => {
    assert.equal(canvasSaveFailure(true, { success: true }), null)
  })

  test('rejects a non-ok response with the server message', () => {
    assert.equal(
      canvasSaveFailure(false, { message: '数据库连接繁忙' }),
      '数据库连接繁忙',
    )
  })

  test('rejects an explicit unsuccessful response', () => {
    assert.equal(
      canvasSaveFailure(true, { success: false, message: '保存失败' }),
      '保存失败',
    )
  })

  test('rejects a partial-save flag even when HTTP succeeded', () => {
    assert.equal(
      canvasSaveFailure(true, { success: true, partialSave: true }),
      '画布仅部分保存，请重试。',
    )
  })

  test('rejects non-empty failed node or edge lists', () => {
    assert.equal(
      canvasSaveFailure(true, { success: true, failedNodeIds: ['node-1'] }),
      '画布仅部分保存，请重试。',
    )
    assert.equal(
      canvasSaveFailure(true, { success: true, failedEdgeIds: ['edge-1'] }),
      '画布仅部分保存，请重试。',
    )
  })
})

describe('canvas save sequencing', () => {
  test('consumes a pending save exactly once', () => {
    const pendingRef = { current: true }

    assert.equal(consumePendingCanvasSave(pendingRef), true)
    assert.equal(pendingRef.current, false)
    assert.equal(consumePendingCanvasSave(pendingRef), false)
  })

  test('waits for the server deadline without exceeding the platform ceiling', () => {
    assert.ok(CANVAS_SAVE_CLIENT_TIMEOUT_MS > CANVAS_SAVE_SERVER_DEADLINE_MS)
    assert.ok(CANVAS_SAVE_CLIENT_TIMEOUT_MS < 60_000)
  })
})
