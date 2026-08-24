import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildCanvasEntitySavePayload,
  collectChangedEntityIds,
} from './canvasIncrementalSave'

const nodes = [{ id: 'node-a', title: 'A' }, { id: 'node-b', title: 'B' }]
const edges = [{ id: 'edge-a', fromNodeId: 'node-a', toNodeId: 'node-b' }]

describe('canvas incremental save payload', () => {
  test('sends no entity upserts for an unchanged incremental save', () => {
    assert.deepEqual(
      buildCanvasEntitySavePayload({
        nodes,
        edges,
        dirtyNodeIds: new Set(),
        dirtyEdgeIds: new Set(),
      }),
      { saveMode: 'incremental', nodes: [], edges: [] },
    )
  })

  test('sends only the dirty node and edge', () => {
    assert.deepEqual(
      buildCanvasEntitySavePayload({
        nodes,
        edges,
        dirtyNodeIds: new Set(['node-b']),
        dirtyEdgeIds: new Set(['edge-a']),
      }),
      { saveMode: 'incremental', nodes: [nodes[1]], edges },
    )
  })

  test('uses a full snapshot when the dirty baseline is unavailable', () => {
    assert.deepEqual(
      buildCanvasEntitySavePayload({
        nodes,
        edges,
        dirtyNodeIds: new Set(),
        dirtyEdgeIds: new Set(),
        forceFull: true,
      }),
      { saveMode: 'full', nodes, edges },
    )
  })

  test('derives only changed identities from immutable commit results', () => {
    const previous = [{ id: 'node-a', title: 'A' }, { id: 'node-b', title: 'B' }]
    const next = [previous[0], { id: 'node-b', title: 'Edited' }, { id: 'node-c', title: 'C' }]

    assert.deepEqual([...collectChangedEntityIds(previous, next)], ['node-b', 'node-c'])
  })
})
