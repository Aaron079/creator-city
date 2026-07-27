import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  completeEmergencyCanvasAcknowledgment,
  completeLocalCanvasSaveSchedule,
  createCanvasAutosaveSuppression,
  consumeCanvasAutosaveSuppression,
  runBoundedCanvasPersistence,
  writeCanonicalCanvasSnapshot,
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

  test('suppresses only the exact explicitly persisted canvas revision at scale', () => {
    for (const nodeCount of [20, 50, 100]) {
      const nodes = Array.from({ length: nodeCount }, (_, index) => ({ id: `node-${index}` }))
      const edges = [{ id: 'edge-1' }]
      const viewport = { zoom: 1, pan: { x: 0, y: 0 } }
      const token = createCanvasAutosaveSuppression(nodes, edges, viewport)
      const consumed = consumeCanvasAutosaveSuppression(token, nodes, edges, viewport)

      assert.equal(consumed.suppress, true)
      assert.equal(consumed.next, null)
    }
  })

  test('performs one serialization, local write, and schedule end to end at scale', () => {
    for (const nodeCount of [20, 50, 100]) {
      const nodes = Array.from({ length: nodeCount }, (_, index) => ({ id: `node-${index}` }))
      const edges = [{ id: 'edge-1' }]
      const viewport = { zoom: 1, pan: { x: 0, y: 0 } }
      let serializations = 0
      let localWrites = 0
      let schedules = 0
      const originalStringify = JSON.stringify
      const storage = {
        setItem(key: string, serialized: string) {
          assert.equal(key, 'creator-city:canvas-snapshot:project-1')
          assert.equal(typeof serialized, 'string')
          localWrites += 1
        },
      }
      const result = runBoundedCanvasPersistence({
        persistenceOrder: 'schedule-first',
        operation: (markMutation) => {
          markMutation()
          return true
        },
        flushSnapshot: () => {
          JSON.stringify = ((value: unknown) => {
            serializations += 1
            return originalStringify(value)
          }) as typeof JSON.stringify
          try {
            writeCanonicalCanvasSnapshot(
              storage,
              'creator-city:canvas-snapshot:project-1',
              { nodes, edges, viewport },
            )
          } finally {
            JSON.stringify = originalStringify
          }
        },
        scheduleSave: () => { schedules += 1 },
      })
      const suppression = consumeCanvasAutosaveSuppression(
        createCanvasAutosaveSuppression(nodes, edges, viewport),
        nodes,
        edges,
        viewport,
      )
      if (!suppression.suppress) {
        serializations += 1
        localWrites += 1
        schedules += 1
      }

      assert.equal(result.persistenceSucceeded, true)
      assert.deepEqual(
        { serializations, localWrites, schedules },
        { serializations: 1, localWrites: 1, schedules: 1 },
      )
    }
  })

  test('reports canonical serialization and durable storage failures', () => {
    assert.throws(() => writeCanonicalCanvasSnapshot(
      { setItem() { throw new Error('quota exceeded') } },
      'creator-city:canvas-snapshot:project-1',
      { nodes: [], edges: [] },
    ), /quota exceeded/)

    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic
    assert.throws(() => writeCanonicalCanvasSnapshot(
      { setItem() { assert.fail('storage must not run after serialization failure') } },
      'creator-city:canvas-snapshot:project-1',
      cyclic,
    ), /circular/i)
  })

  test('keeps a Stage C transaction durable-state atomic when scheduling fails', () => {
    let serializations = 0
    let writes = 0
    let schedules = 0
    const result = runBoundedCanvasPersistence({
      persistenceOrder: 'schedule-first',
      operation: (markMutation) => {
        markMutation()
        return true
      },
      flushSnapshot: () => {
        serializations += 1
        writes += 1
      },
      scheduleSave: () => {
        schedules += 1
        throw new Error('schedule failed')
      },
    })

    assert.equal(result.persistenceSucceeded, false)
    assert.deepEqual({ serializations, writes, schedules }, {
      serializations: 0,
      writes: 0,
      schedules: 1,
    })
  })

  test('never suppresses a later unrelated node, edge, or viewport mutation', () => {
    const nodes = [{ id: 'node-1' }]
    const edges = [{ id: 'edge-1' }]
    const viewport = { zoom: 1, pan: { x: 0, y: 0 } }
    const token = createCanvasAutosaveSuppression(nodes, edges, viewport)

    assert.equal(
      consumeCanvasAutosaveSuppression(token, [...nodes], edges, viewport).suppress,
      false,
    )
    assert.equal(
      consumeCanvasAutosaveSuppression(token, nodes, [...edges], viewport).suppress,
      false,
    )
    assert.equal(
      consumeCanvasAutosaveSuppression(token, nodes, edges, {
        zoom: 1,
        pan: { x: 1, y: 0 },
      }).suppress,
      false,
    )
  })
})
