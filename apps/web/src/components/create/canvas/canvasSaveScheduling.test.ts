import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { completeLocalCanvasSaveSchedule } from './canvasSaveScheduling'

describe('canvas save scheduling', () => {
  test('keeps existing callers flushing once by default', () => {
    let snapshots = 0
    let transitions = 0
    completeLocalCanvasSaveSchedule(undefined, {
      flushSnapshot: () => { snapshots += 1 },
      markLocalDraft: () => { transitions += 1 },
    })
    assert.deepEqual({ snapshots, transitions }, { snapshots: 1, transitions: 1 })
  })

  test('does not duplicate a Stage C snapshot that was already flushed', () => {
    let snapshots = 0
    let schedules = 0
    const flushSnapshot = () => { snapshots += 1 }
    flushSnapshot()
    completeLocalCanvasSaveSchedule({ snapshot: 'already-flushed' }, {
      flushSnapshot,
      markLocalDraft: () => { schedules += 1 },
    })
    assert.deepEqual({ snapshots, schedules }, { snapshots: 1, schedules: 1 })
  })
})
