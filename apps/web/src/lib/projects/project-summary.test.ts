import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  countProjectWorkflowNodes,
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
