import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { decideCanvasDraftRecovery } from './canvasDraftRecovery'

const projectId = 'project-a'
const workflowId = 'workflow-a'
const serverUpdatedAt = '2026-07-15T04:00:00.000Z'

function localVersion(overrides: Partial<NonNullable<Parameters<typeof decideCanvasDraftRecovery>[0]['local']>> = {}) {
  return {
    projectId,
    workflowId,
    updatedAt: serverUpdatedAt,
    syncedAt: serverUpdatedAt,
    serverUpdatedAt,
    nodeCount: 2,
    ...overrides,
  }
}

function decide(overrides: Partial<Parameters<typeof decideCanvasDraftRecovery>[0]> = {}) {
  return decideCanvasDraftRecovery({
    projectId,
    workflowId,
    serverUpdatedAt,
    serverNodeCount: 2,
    local: localVersion(),
    ...overrides,
  })
}

describe('canvas local draft recovery decision', () => {
  test('keeps a synchronized local snapshot as a clean server load', () => {
    assert.deepEqual(decide(), { action: 'server', reason: 'local-not-newer' })
  })

  test('keeps a stale local snapshot behind the newer server canvas', () => {
    assert.deepEqual(
      decide({ local: localVersion({ updatedAt: '2026-07-15T03:59:00.000Z' }) }),
      { action: 'server', reason: 'local-not-newer' },
    )
  })

  test('prompts for a matching local draft that is provably unsynced', () => {
    assert.deepEqual(
      decide({
        local: localVersion({
          updatedAt: '2026-07-15T04:01:00.000Z',
          syncedAt: '2026-07-15T03:59:00.000Z',
          serverUpdatedAt: '2026-07-15T03:59:00.000Z',
        }),
      }),
      { action: 'prompt-local-recovery', reason: 'unsynced-local-draft' },
    )
  })

  test('still requires an explicit prompt when the server canvas is empty', () => {
    assert.equal(
      decide({
        serverNodeCount: 0,
        local: localVersion({
          updatedAt: '2026-07-15T04:01:00.000Z',
          syncedAt: '2026-07-15T03:59:00.000Z',
        }),
      }).action,
      'prompt-local-recovery',
    )
  })

  test('rejects local records from another project or workflow', () => {
    assert.deepEqual(
      decide({ local: localVersion({ projectId: 'project-b', updatedAt: '2026-07-15T04:01:00.000Z' }) }),
      { action: 'server', reason: 'project-mismatch' },
    )
    assert.deepEqual(
      decide({ local: localVersion({ workflowId: 'workflow-b', updatedAt: '2026-07-15T04:01:00.000Z' }) }),
      { action: 'server', reason: 'workflow-mismatch' },
    )
  })

  test('rejects empty or invalid local version evidence', () => {
    assert.deepEqual(
      decide({ local: localVersion({ nodeCount: 0, updatedAt: '2026-07-15T04:01:00.000Z' }) }),
      { action: 'server', reason: 'local-empty' },
    )
    assert.deepEqual(
      decide({ local: localVersion({ updatedAt: 'not-a-date' }) }),
      { action: 'server', reason: 'invalid-local-time' },
    )
    assert.deepEqual(
      decide({
        serverUpdatedAt: undefined,
        local: localVersion({
          updatedAt: '2026-07-15T04:01:00.000Z',
          syncedAt: undefined,
          serverUpdatedAt: undefined,
        }),
      }),
      { action: 'server', reason: 'missing-sync-baseline' },
    )
  })

  test('uses the 500ms tolerance to avoid timestamp jitter prompts', () => {
    assert.deepEqual(
      decide({ local: localVersion({ updatedAt: '2026-07-15T04:00:00.500Z' }) }),
      { action: 'server', reason: 'local-not-newer' },
    )
    assert.equal(
      decide({ local: localVersion({ updatedAt: '2026-07-15T04:00:00.501Z' }) }).action,
      'prompt-local-recovery',
    )
  })
})
