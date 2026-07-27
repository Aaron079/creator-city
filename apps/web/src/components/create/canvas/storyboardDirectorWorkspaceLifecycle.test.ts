import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  createRecipeMaterializationIdentity,
  createStoryboardDirectorRecipe,
  createStoryboardDirectorRecipeRevision,
  storyboardDirectorRecipeMetadata,
} from '../../../lib/storyboard'
import {
  executeStoryboardDirectorReceiptAwareDeletion,
  planStoryboardDirectorReceiptAwareDeletion,
  resolveStoryboardDirectorRecipeRevision,
  selectStoryboardDirectorEmergencyLock,
  upsertStoryboardDirectorEmergencyLock,
} from './storyboardDirectorWorkspaceLifecycle'

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

function controlNode(id: string, recipe: ReturnType<typeof recipeWithReceipt>) {
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
})
