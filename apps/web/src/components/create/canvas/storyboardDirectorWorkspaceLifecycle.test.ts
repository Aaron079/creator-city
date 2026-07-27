import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  createRecipeMaterializationIdentity,
  createStoryboardDirectorRecipe,
  createStoryboardDirectorPartialBatchIdentity,
  createStoryboardDirectorRecipeRevision,
  storyboardDirectorRecipeMetadata,
} from '../../../lib/storyboard'
import {
  clearStoryboardDirectorEmergencyLock,
  collectStoryboardDirectorDurableLocks,
  executeStoryboardDirectorReceiptAwareDeletion,
  executeStoryboardDirectorRecoveryPersistence,
  reserveStoryboardDirectorNodeId,
  runStoryboardDirectorCreationBatch,
  runStoryboardDirectorContextTransition,
  planStoryboardDirectorReceiptAwareDeletion,
  resolveStoryboardDirectorRecipeRevision,
  selectStoryboardDirectorEmergencyLock,
  upsertStoryboardDirectorEmergencyLock,
  type StoryboardDirectorEmergencyLock,
} from './storyboardDirectorWorkspaceLifecycle'
import type { StoryboardDirectorRecipe } from '../../../lib/storyboard/recipe/types'

const NOW = '2026-07-19T01:00:00.000Z'

function recipeWithReceipt(
  sourceId: string,
  targetId: string,
  kind: 'scene' | 'draft-node',
) {
  const recipe = createStoryboardDirectorRecipe(
    { projectId: 'project-1', workflowId: 'workflow-1' },
    {
      id: sourceId,
      kind: 'text',
      title: sourceId,
      prompt: 'INT. LAB - NIGHT\nMara opens the sealed case.',
    },
    NOW,
  )
  return {
    ...recipe,
    receipts: [{
      identity: createRecipeMaterializationIdentity(
        recipe.recipeId,
        kind,
        `${kind}-artifact`,
        `${kind}-result`,
      ),
      kind,
      resultId: `${kind}-result`,
      targetId,
    }],
  }
}

function controlNode(id: string, recipe: StoryboardDirectorRecipe) {
  return {
    id,
    kind: 'text',
    title: id,
    metadataJson: {
      unrelated: { keep: true },
      ...storyboardDirectorRecipeMetadata(recipe),
    },
  }
}

describe('Storyboard Director workspace lifecycle', () => {
  test('reconciles grouped and draft receipts across active and inactive controls', () => {
    const nodes = [
      controlNode('active-control', recipeWithReceipt('source-a', 'grouped-target', 'scene')),
      controlNode('inactive-control', recipeWithReceipt('source-b', 'grouped-target', 'draft-node')),
      { id: 'grouped-target', kind: 'text', title: 'Derived' },
    ]
    const plan = planStoryboardDirectorReceiptAwareDeletion(
      nodes,
      'grouped-target',
      NOW,
    )

    assert.equal(plan.status, 'reconciled')
    assert.deepEqual(plan.affectedControlNodeIds, ['active-control', 'inactive-control'])
    assert.equal(plan.removedReceiptCount, 2)
    assert.equal(plan.nextNodes.some((node) => node.id === 'grouped-target'), false)
    for (const node of plan.nextNodes.filter((item) => item.id.endsWith('control'))) {
      assert.deepEqual(
        (('metadataJson' in node ? node.metadataJson : {}) as Record<string, unknown>).unrelated,
        { keep: true },
      )
    }
  })

  test('leaves unrelated manual deletion on the existing non-Recipe path', () => {
    const nodes = [
      controlNode('control', recipeWithReceipt('source-a', 'derived-target', 'scene')),
      { id: 'manual-target', kind: 'text', title: 'Manual' },
    ]
    const plan = planStoryboardDirectorReceiptAwareDeletion(nodes, 'manual-target', NOW)

    assert.equal(plan.status, 'unrelated')
    assert.equal(plan.nextNodes, nodes)
    assert.equal(plan.removedReceiptCount, 0)
  })

  test('blocks receipt-aware deletion when its bounded persistence fails', () => {
    const nodes = [
      controlNode('control', recipeWithReceipt('source-a', 'derived-target', 'scene')),
      { id: 'derived-target', kind: 'text', title: 'Derived' },
    ]
    const plan = planStoryboardDirectorReceiptAwareDeletion(nodes, 'derived-target', NOW)
    let committed = 0
    const deleted = executeStoryboardDirectorReceiptAwareDeletion(plan, {
      persist: () => false,
      commit: () => { committed += 1 },
    })

    assert.equal(deleted, false)
    assert.equal(committed, 0)
  })

  test('keeps emergency locks scoped across project switches', () => {
    const lock = {
      projectId: 'project-1',
      workflowId: 'workflow-1',
      controlNodeId: 'control-1',
      recipeId: 'recipe-1',
      blocker: {
        batchId: 'batch-1',
        operation: 'draft-node-creation' as const,
        plannedCount: 2,
        createdCount: 1,
        uncreatedCount: 1,
        plannedIdentities: ['one', 'two'],
        successfulTargetIds: ['target-1'],
      },
    }
    const locks = upsertStoryboardDirectorEmergencyLock([], lock)

    assert.equal(selectStoryboardDirectorEmergencyLock(locks, {
      projectId: 'project-2',
      workflowId: 'workflow-2',
      controlNodeId: 'control-2',
      recipeId: 'recipe-2',
    }), null)
    assert.deepEqual(selectStoryboardDirectorEmergencyLock(locks, {
      projectId: 'project-1',
      workflowId: 'workflow-1',
      controlNodeId: 'control-1',
      recipeId: 'recipe-1',
    }), lock)
  })

  test('rejects same-identity concurrent changes unless recovery rebases onto latest', () => {
    const original = recipeWithReceipt('source-a', 'derived-target', 'scene')
    const expectedRevision = createStoryboardDirectorRecipeRevision(original)
    const requested = {
      ...original,
      receipts: [...original.receipts, {
        identity: 'requested-receipt',
        kind: 'draft-node' as const,
        resultId: 'requested-result',
        targetId: 'requested-target',
      }],
    }
    const concurrent = {
      ...original,
      findings: [{
        findingId: 'concurrent-review',
        severity: 'advisory' as const,
        code: 'CONCURRENT_REVIEW',
        message: 'Preserve this unrelated latest finding.',
        evidenceIds: [],
      }],
    }

    assert.deepEqual(
      resolveStoryboardDirectorRecipeRevision({
        expectedRevision,
        currentRecipe: concurrent,
        requestedRecipe: requested,
      }),
      { status: 'conflict' },
    )

    const recovered = resolveStoryboardDirectorRecipeRevision({
      expectedRevision,
      currentRecipe: concurrent,
      requestedRecipe: requested,
      recoverLatestRecipe: (latest) => ({
        ...latest,
        receipts: requested.receipts,
      }),
    })
    assert.equal(recovered.status, 'resolved')
    if (recovered.status === 'resolved') {
      assert.equal(recovered.recipe.receipts.at(-1)?.targetId, 'requested-target')
      assert.equal(recovered.recipe.findings[0]?.code, 'CONCURRENT_REVIEW')
    }
  })

  test('flushes every dirty board field before a context transition mutates identity', () => {
    const events: string[] = []
    const transitioned = runStoryboardDirectorContextTransition({
      flushDrafts: () => {
        events.push('flush:mood+directorNote')
        return true
      },
      transition: () => { events.push('replace:project+workflow+control+recipe') },
    })

    assert.equal(transitioned, true)
    assert.deepEqual(events, [
      'flush:mood+directorNote',
      'replace:project+workflow+control+recipe',
    ])

    events.length = 0
    assert.equal(runStoryboardDirectorContextTransition({
      flushDrafts: () => {
        events.push('flush:failed')
        return false
      },
      transition: () => { events.push('must-not-replace') },
    }), false)
    assert.deepEqual(events, ['flush:failed'])
  })

  test('reserves a unique Stage C node ID against evolving occupancy', () => {
    const occupied = new Set(['text-collision-1', 'text-collision-2'])
    const candidates = ['text-collision-1', 'text-collision-2', 'text-unique']
    const reserved = reserveStoryboardDirectorNodeId(
      occupied,
      () => candidates.shift() ?? 'text-collision-2',
    )

    assert.equal(reserved, 'text-unique')
    assert.equal(occupied.has('text-unique'), true)
    assert.throws(() => reserveStoryboardDirectorNodeId(
      new Set(['duplicate']),
      () => 'duplicate',
      3,
    ), /unique node ID/)
  })

  test('captures first, middle, last, and receipt-construction failures without losing created targets', () => {
    for (const failureIndex of [0, 1, 2]) {
      const result = runStoryboardDirectorCreationBatch(
        ['first', 'middle', 'last'],
        {
          create: (plan, index) => {
            if (index === failureIndex) throw new Error(`create ${plan}`)
            return { targetId: `target-${plan}` }
          },
          receipt: (plan, created) => ({
            identity: plan,
            targetId: created.targetId,
          }),
        },
      )
      assert.equal(result.status, 'partial')
      assert.equal(result.completed.length, failureIndex)
      assert.equal(result.uncreatedCount, 3 - failureIndex)
    }

    const recorderFailure = runStoryboardDirectorCreationBatch(
      ['first', 'middle', 'last'],
      {
        create: (plan) => ({ targetId: `target-${plan}` }),
        receipt: (plan, created) => {
          if (plan === 'middle') throw new Error('receipt construction failed')
          return { identity: plan, targetId: created.targetId }
        },
      },
    )
    assert.equal(recorderFailure.status, 'partial')
    assert.deepEqual(recorderFailure.completed, [
      {
        targetId: 'target-first',
        receipt: { identity: 'first', targetId: 'target-first' },
      },
      { targetId: 'target-middle' },
    ])
    assert.equal(recorderFailure.uncreatedCount, 1)
  })

  test('durably persists a recovery rebased on latest before clearing its scoped lock', () => {
    const original = recipeWithReceipt('source-a', 'derived-target', 'scene')
    const latest: StoryboardDirectorRecipe = {
      ...original,
      findings: [{
        findingId: 'concurrent-review',
        severity: 'advisory' as const,
        code: 'CONCURRENT_REVIEW',
        message: 'Preserve latest review.',
        evidenceIds: [],
      }],
    }
    const blocker = {
      batchId: 'batch-1',
      operation: 'draft-node-creation' as const,
      plannedCount: 2,
      createdCount: 1,
      uncreatedCount: 1,
      plannedIdentities: ['one', 'two'],
      successfulTargetIds: ['target-1'],
    }
    const lock = {
      projectId: latest.projectId,
      workflowId: latest.workflowId,
      controlNodeId: 'control-1',
      recipeId: latest.recipeId,
      blocker,
    }
    let locks: StoryboardDirectorEmergencyLock[] = [lock]
    const events: string[] = []
    const result = executeStoryboardDirectorRecoveryPersistence({
      readLatest: () => latest,
      buildRecovery: (current) => ({
        ...current,
        findings: [...current.findings, {
          findingId: 'partial-recovery',
          severity: 'blocking' as const,
          code: 'PARTIAL_MATERIALIZATION_BATCH',
          message: 'Recovery blocker.',
          evidenceIds: [],
          partialBatch: blocker,
        }],
      }),
      persist: (candidate) => {
        events.push(`persist:${candidate.findings.map((finding) => finding.code).join(',')}`)
        return true
      },
      retainEmergency: () => { events.push('retain') },
    })

    assert.equal(result.status, 'persisted')
    assert.deepEqual(events, ['persist:CONCURRENT_REVIEW,PARTIAL_MATERIALIZATION_BATCH'])
    locks = clearStoryboardDirectorEmergencyLock(locks, lock, blocker.batchId)
    assert.deepEqual(locks, [])
  })

  test('retains a scoped fail-closed lock when recovery serialization or scheduling fails', () => {
    const latest = recipeWithReceipt('source-a', 'derived-target', 'scene')
    let retained = 0
    for (const failure of ['build', 'persist'] as const) {
      const result = executeStoryboardDirectorRecoveryPersistence({
        readLatest: () => latest,
        buildRecovery: (current) => {
          if (failure === 'build') throw new Error('record failed')
          return current
        },
        persist: () => {
          if (failure === 'persist') throw new Error('storage failed')
          return true
        },
        retainEmergency: () => { retained += 1 },
      })
      assert.equal(result.status, 'emergency')
    }
    assert.equal(retained, 2)
  })

  test('restores durable blockers after reload, remount, and returning from a canvas switch', () => {
    const original = recipeWithReceipt('source-a', 'derived-target', 'scene')
    const batchId = createStoryboardDirectorPartialBatchIdentity(
      original.recipeId,
      'grouped-materialization',
      ['one', 'two'],
    )
    const blocker = {
      batchId,
      operation: 'grouped-materialization' as const,
      plannedCount: 2,
      createdCount: 1,
      uncreatedCount: 1,
      plannedIdentities: ['one', 'two'],
      successfulTargetIds: ['target-1'],
    }
    const persisted: StoryboardDirectorRecipe = {
      ...original,
      findings: [{
        findingId: batchId.replace(/^sdrb1_/, 'sdrf1_'),
        severity: 'blocking',
        code: 'PARTIAL_MATERIALIZATION_BATCH',
        message: 'Reload recovery.',
        evidenceIds: [],
        partialBatch: blocker,
      }],
    }
    const nodes = [controlNode('control-reload', persisted)]
    for (const phase of ['reload', 'remount', 'return-after-switch']) {
      const restored = collectStoryboardDirectorDurableLocks(nodes, {
        projectId: persisted.projectId,
        workflowId: persisted.workflowId,
      })
      assert.equal(restored.length, 1, phase)
      assert.equal(restored[0]?.blocker.batchId, blocker.batchId, phase)
    }
    assert.deepEqual(collectStoryboardDirectorDurableLocks(nodes, {
      projectId: 'other-project',
      workflowId: 'other-workflow',
    }), [])
  })
})
