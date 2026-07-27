import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  completeEmergencyCanvasAcknowledgment,
  completeLocalCanvasSaveSchedule,
  runBoundedCanvasPersistence,
} from './canvasSaveScheduling'

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

  test('persists a successful commit with one flush and one schedule', () => {
    let flushes = 0
    let schedules = 0
    const result = runBoundedCanvasPersistence({
      operation: (markMutation) => {
        markMutation()
        return true
      },
      flushSnapshot: () => { flushes += 1 },
      scheduleSave: () => { schedules += 1 },
    })

    assert.deepEqual(result, {
      operationSucceeded: true,
      persistenceAttempted: true,
      persistenceSucceeded: true,
    })
    assert.deepEqual({ flushes, schedules }, { flushes: 1, schedules: 1 })
  })

  test('persists once when a guarded commit returns false after node creation', () => {
    let flushes = 0
    let schedules = 0
    const result = runBoundedCanvasPersistence({
      hasPriorMutation: true,
      operation: () => false,
      flushSnapshot: () => { flushes += 1 },
      scheduleSave: () => { schedules += 1 },
    })

    assert.equal(result.operationSucceeded, false)
    assert.equal(result.persistenceSucceeded, true)
    assert.deepEqual({ flushes, schedules }, { flushes: 1, schedules: 1 })
  })

  test('does not persist a guard failure before any mutation', () => {
    let flushes = 0
    let schedules = 0
    const result = runBoundedCanvasPersistence({
      operation: () => false,
      flushSnapshot: () => { flushes += 1 },
      scheduleSave: () => { schedules += 1 },
    })

    assert.deepEqual(result, {
      operationSucceeded: false,
      persistenceAttempted: false,
      persistenceSucceeded: true,
    })
    assert.deepEqual({ flushes, schedules }, { flushes: 0, schedules: 0 })
  })

  test('multiple mutation marks cannot duplicate persistence', () => {
    let flushes = 0
    let schedules = 0
    runBoundedCanvasPersistence({
      operation: (markMutation) => {
        markMutation()
        markMutation()
        return true
      },
      flushSnapshot: () => { flushes += 1 },
      scheduleSave: () => { schedules += 1 },
    })

    assert.deepEqual({ flushes, schedules }, { flushes: 1, schedules: 1 })
  })

  test('emergency acknowledgment persists once before clearing the target lock', () => {
    let flushes = 0
    let schedules = 0
    const acknowledged = completeEmergencyCanvasAcknowledgment({
      matchesTarget: true,
      flushSnapshot: () => { flushes += 1 },
      scheduleSave: () => { schedules += 1 },
    })

    assert.equal(acknowledged, true)
    assert.deepEqual({ flushes, schedules }, { flushes: 1, schedules: 1 })
  })

  test('emergency acknowledgment keeps the lock when scheduling fails', () => {
    let flushes = 0
    let schedules = 0
    const acknowledged = completeEmergencyCanvasAcknowledgment({
      matchesTarget: true,
      flushSnapshot: () => { flushes += 1 },
      scheduleSave: () => {
        schedules += 1
        throw new Error('schedule failed')
      },
    })

    assert.equal(acknowledged, false)
    assert.deepEqual({ flushes, schedules }, { flushes: 1, schedules: 1 })
  })

  test('non-target emergency acknowledgment is a read-only no-op', () => {
    let flushes = 0
    let schedules = 0
    const acknowledged = completeEmergencyCanvasAcknowledgment({
      matchesTarget: false,
      flushSnapshot: () => { flushes += 1 },
      scheduleSave: () => { schedules += 1 },
    })

    assert.equal(acknowledged, false)
    assert.deepEqual({ flushes, schedules }, { flushes: 0, schedules: 0 })
  })
})
