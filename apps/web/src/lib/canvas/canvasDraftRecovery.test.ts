import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  decideCanvasDraftRecovery,
  mergeStoryboardDirectorRecoveryRiskIntoServerNodes,
} from './canvasDraftRecovery'
import {
  createStoryboardDirectorRecipe,
  createRecipeMaterializationIdentity,
  readStoryboardDirectorRecipe,
  storyboardDirectorRecipeMetadata,
} from '../storyboard'
import {
  recordStoryboardDirectorRecoveryBatch,
} from '../../components/create/canvas/skills/storyboardDirectorMaterialization'

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

  test('merges only a newer local partial-batch blocker and completed receipt into the server Recipe', () => {
    const serverRecipe = createStoryboardDirectorRecipe(
      { projectId, workflowId },
      {
        id: 'source-a',
        kind: 'text',
        title: 'Server source',
        prompt: 'INT. LAB - NIGHT',
      },
      serverUpdatedAt,
    )
    const concurrentServerRecipe = {
      ...serverRecipe,
      findings: [{
        findingId: 'server-review',
        severity: 'advisory' as const,
        code: 'SERVER_REVIEW',
        message: 'Preserve the server review.',
        evidenceIds: [],
      }],
      storyboard: {
        ...serverRecipe.storyboard,
        updatedAt: '2026-07-15T04:00:30.000Z',
      },
    }
    const draftIdentity = createRecipeMaterializationIdentity(
      serverRecipe.recipeId,
      'draft-node',
      'draft-artifact-a',
      'draft-result-a',
    )
    const recovery = recordStoryboardDirectorRecoveryBatch(
      {
        ...serverRecipe,
        legacyImportStatus: 'dismissed' as const,
      },
      'draft-node-creation',
      [draftIdentity, 'draft-identity-b'],
      [{
        identity: draftIdentity,
        targetId: 'draft-target-a',
        receipt: {
          identity: draftIdentity,
          kind: 'draft-node',
          resultId: 'draft-result-a',
          targetId: 'draft-target-a',
        },
      }],
      '2026-07-15T04:01:00.000Z',
    )
    const localRecoveryRecipe = {
      ...recovery.recipe,
      receipts: [{
        identity: draftIdentity,
        kind: 'draft-node' as const,
        resultId: 'draft-result-a',
        targetId: 'draft-target-a',
      }],
    }
    const serverNodes = [{
      id: 'control-a',
      kind: 'text',
      title: 'Server control',
      prompt: 'server summary',
      metadataJson: {
        serverOnly: { keep: true },
        ...storyboardDirectorRecipeMetadata(concurrentServerRecipe),
      },
    }, {
      id: 'manual-server',
      kind: 'text',
      title: 'Manual server node',
    }]
    const localNodes = [{
      id: 'control-a',
      kind: 'text',
      title: 'Local control title must not win',
      metadataJson: {
        localOnly: { discard: true },
        ...storyboardDirectorRecipeMetadata(localRecoveryRecipe),
      },
    }, {
      id: 'unrelated-local',
      kind: 'text',
      title: 'Must not be imported',
    }]

    const merged = mergeStoryboardDirectorRecoveryRiskIntoServerNodes({
      projectId,
      workflowId,
      serverNodes,
      localNodes,
    })

    assert.equal(merged.status, 'merged')
    assert.deepEqual(merged.batchIds, [recovery.blocker.batchId])
    assert.equal(merged.nodes.length, 2)
    assert.equal(merged.nodes.some((node) => node.id === 'unrelated-local'), false)
    const control = merged.nodes.find((node) => node.id === 'control-a')
    assert.deepEqual(
      (control?.metadataJson as Record<string, unknown>).serverOnly,
      { keep: true },
    )
    assert.equal('localOnly' in (control?.metadataJson as Record<string, unknown>), false)
    const read = readStoryboardDirectorRecipe(control?.metadataJson)
    assert.equal(read.status, 'valid')
    if (read.status !== 'valid') return
    assert.equal(read.recipe.findings.some((finding) => finding.code === 'SERVER_REVIEW'), true)
    assert.equal(
      read.recipe.findings.some((finding) => (
        finding.partialBatch?.batchId === recovery.blocker.batchId
      )),
      true,
    )
    assert.deepEqual(read.recipe.receipts.map((receipt) => receipt.targetId), ['draft-target-a'])
    assert.equal(read.recipe.storyboard.updatedAt, concurrentServerRecipe.storyboard.updatedAt)
    assert.equal(read.recipe.legacyImportStatus, concurrentServerRecipe.legacyImportStatus)
  })

  test('fails closed when a valid local partial blocker has no matching server control', () => {
    const localRecipe = createStoryboardDirectorRecipe(
      { projectId, workflowId },
      {
        id: 'source-a',
        kind: 'text',
        title: 'Source',
        prompt: 'EXT. ROOF - DAWN',
      },
      serverUpdatedAt,
    )
    const recovery = recordStoryboardDirectorRecoveryBatch(
      localRecipe,
      'grouped-materialization',
      ['scene-a'],
      [],
      '2026-07-15T04:01:00.000Z',
    )

    const result = mergeStoryboardDirectorRecoveryRiskIntoServerNodes({
      projectId,
      workflowId,
      serverNodes: [{ id: 'server-manual', metadataJson: {} }],
      localNodes: [{
        id: 'missing-control',
        metadataJson: storyboardDirectorRecipeMetadata(recovery.recipe),
      }],
    })

    assert.equal(result.status, 'blocked')
    assert.deepEqual(result.batchIds, [recovery.blocker.batchId])
    assert.deepEqual(result.nodes, [{ id: 'server-manual', metadataJson: {} }])
  })

  test('reapplies the same loader recovery idempotently across reload, remount, and project return', () => {
    const recipe = createStoryboardDirectorRecipe(
      { projectId, workflowId },
      {
        id: 'source-repeat',
        kind: 'text',
        title: 'Source',
        prompt: 'INT. ARCHIVE - NIGHT',
      },
      serverUpdatedAt,
    )
    const recovery = recordStoryboardDirectorRecoveryBatch(
      recipe,
      'grouped-materialization',
      ['scene-repeat'],
      [],
      '2026-07-15T04:01:00.000Z',
    )
    const localNodes = [{
      id: 'control-repeat',
      metadataJson: storyboardDirectorRecipeMetadata(recovery.recipe),
    }]
    let serverNodes = [{
      id: 'control-repeat',
      metadataJson: storyboardDirectorRecipeMetadata(recipe),
    }]

    for (const phase of ['reload', 'remount', 'project-return']) {
      const result = mergeStoryboardDirectorRecoveryRiskIntoServerNodes({
        projectId,
        workflowId,
        serverNodes,
        localNodes,
      })
      assert.equal(result.status, 'merged', phase)
      const read = readStoryboardDirectorRecipe(result.nodes[0]?.metadataJson)
      assert.equal(read.status, 'valid', phase)
      if (read.status !== 'valid') continue
      assert.equal(
        read.recipe.findings.filter((finding) => (
          finding.partialBatch?.batchId === recovery.blocker.batchId
        )).length,
        1,
        phase,
      )
      serverNodes = result.nodes
    }
  })

  test('fails closed instead of throwing when merged recovery receipts exceed the strict bound', () => {
    const recipe = createStoryboardDirectorRecipe(
      { projectId, workflowId },
      {
        id: 'source-overflow',
        kind: 'text',
        title: 'Source',
        prompt: 'INT. STORAGE - NIGHT',
      },
      serverUpdatedAt,
    )
    const serverRecipe = {
      ...recipe,
      receipts: Array.from({ length: 360 }, (_, index) => ({
        identity: `server-receipt-${index}`,
        kind: 'scene' as const,
        resultId: `server-result-${index}`,
        targetId: `server-target-${index}`,
      })),
    }
    const recovery = recordStoryboardDirectorRecoveryBatch(
      recipe,
      'draft-node-creation',
      ['local-receipt'],
      [],
      '2026-07-15T04:01:00.000Z',
    )
    const localRecipe = {
      ...recovery.recipe,
      receipts: [{
        identity: 'local-receipt',
        kind: 'draft-node' as const,
        resultId: 'local-result',
        targetId: 'local-target',
      }],
      findings: recovery.recipe.findings.map((finding) => ({
        ...finding,
        partialBatch: finding.partialBatch
          ? {
              ...finding.partialBatch,
              createdCount: 1,
              uncreatedCount: 0,
              successfulTargetIds: ['local-target'],
            }
          : undefined,
      })),
    }

    assert.doesNotThrow(() => mergeStoryboardDirectorRecoveryRiskIntoServerNodes({
      projectId,
      workflowId,
      serverNodes: [{
        id: 'control-overflow',
        metadataJson: storyboardDirectorRecipeMetadata(serverRecipe),
      }],
      localNodes: [{
        id: 'control-overflow',
        metadataJson: storyboardDirectorRecipeMetadata(localRecipe),
      }],
    }))
    assert.equal(mergeStoryboardDirectorRecoveryRiskIntoServerNodes({
      projectId,
      workflowId,
      serverNodes: [{
        id: 'control-overflow',
        metadataJson: storyboardDirectorRecipeMetadata(serverRecipe),
      }],
      localNodes: [{
        id: 'control-overflow',
        metadataJson: storyboardDirectorRecipeMetadata(localRecipe),
      }],
    }).status, 'blocked')
  })
})
