import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  prepareCanvasEdgeRows,
  prepareCanvasNodeRows,
} from './canvas-bulk-persistence'

const now = new Date('2026-08-24T12:00:00.000Z')

describe('canvas bulk persistence rows', () => {
  test('preserves the existing node unique identity and project metadata', () => {
    const [row] = prepareCanvasNodeRows({
      workflowId: 'workflow-1',
      projectId: 'project-1',
      now,
      nodes: [{ id: 'node-1', kind: 'image', title: 'Reference' }],
    })

    assert.equal(row.workflowId, 'workflow-1')
    assert.equal(row.nodeId, 'node-1')
    assert.equal(row.metadataJson, JSON.stringify({ projectId: 'project-1', workflowId: 'workflow-1', nodeId: 'node-1', outputLabel: null, preview: null }))
  })

  test('normalizes an empty media result to null so an update can preserve stored media', () => {
    const [row] = prepareCanvasNodeRows({
      workflowId: 'workflow-1',
      projectId: 'project-1',
      now,
      nodes: [{ id: 'node-1', kind: 'image', resultImageUrl: '   ', resultVideoUrl: '' }],
    })

    assert.equal(row.resultImageUrl, null)
    assert.equal(row.resultVideoUrl, null)
  })

  test('preserves the existing edge unique identity and serializes metadata', () => {
    const [row] = prepareCanvasEdgeRows({
      workflowId: 'workflow-1',
      now,
      edges: [{
        id: 'edge-1',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        metadataJson: { label: 'Reference' },
      }],
    })

    assert.equal(row.workflowId, 'workflow-1')
    assert.equal(row.edgeId, 'edge-1')
    assert.equal(row.metadataJson, JSON.stringify({ label: 'Reference', status: 'active' }))
  })
})
