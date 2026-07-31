import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  countProjectAssets,
  countProjectWorkflowNodes,
  toProjectAssetCountMap,
  toWorkflowNodeCountMap,
} from './project-summary'

describe('project summary node counts', () => {
  test('reports the count for one workflow', () => {
    const counts = toWorkflowNodeCountMap([
      { id: 'workflow-1', _count: { nodes: 1 } },
    ])

    assert.equal(countProjectWorkflowNodes([{ id: 'workflow-1' }], counts), 1)
  })

  test('sums counts across multiple workflows', () => {
    const counts = toWorkflowNodeCountMap([
      { id: 'workflow-1', _count: { nodes: 2 } },
      { id: 'workflow-2', _count: { nodes: 3 } },
    ])

    assert.equal(
      countProjectWorkflowNodes(
        [{ id: 'workflow-1' }, { id: 'workflow-2' }],
        counts,
      ),
      5,
    )
  })

  test('preserves an explicit zero count', () => {
    const counts = toWorkflowNodeCountMap([
      { id: 'workflow-1', _count: { nodes: 0 } },
    ])

    assert.equal(countProjectWorkflowNodes([{ id: 'workflow-1' }], counts), 0)
  })

  test('returns zero when a project has no workflows', () => {
    assert.equal(countProjectWorkflowNodes([], new Map()), 0)
  })

  test('treats a missing workflow count as zero', () => {
    const counts = toWorkflowNodeCountMap([
      { id: 'workflow-1', _count: { nodes: 4 } },
    ])

    assert.equal(
      countProjectWorkflowNodes(
        [{ id: 'workflow-1' }, { id: 'workflow-missing' }],
        counts,
      ),
      4,
    )
  })
})

describe('project summary asset counts', () => {
  test('maps direct assets to their project', () => {
    const counts = toProjectAssetCountMap([
      { projectId: 'project-1', _count: { _all: 2 } },
    ])

    assert.equal(countProjectAssets('project-1', counts), 2)
  })

  test('keeps counts distinct across projects', () => {
    const counts = toProjectAssetCountMap([
      { projectId: 'project-1', _count: { _all: 1 } },
      { projectId: 'project-2', _count: { _all: 3 } },
    ])

    assert.equal(countProjectAssets('project-1', counts), 1)
    assert.equal(countProjectAssets('project-2', counts), 3)
  })

  test('treats a missing project count as zero', () => {
    assert.equal(countProjectAssets('project-missing', new Map()), 0)
  })

  test('ignores unbound direct assets', () => {
    const counts = toProjectAssetCountMap([
      { projectId: null, _count: { _all: 9 } },
      { projectId: 'project-1', _count: { _all: 1 } },
    ])

    assert.equal(countProjectAssets('project-1', counts), 1)
    assert.equal(counts.has('null'), false)
  })
})
