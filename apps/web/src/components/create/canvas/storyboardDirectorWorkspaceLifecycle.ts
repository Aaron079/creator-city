import { createStoryboardDirectorRecipeRevision } from '../../../lib/storyboard/recipe/identity'
import {
  readStoryboardDirectorRecipe,
  storyboardDirectorRecipeMetadata,
} from '../../../lib/storyboard/recipe/persistence'
import type {
  StoryboardDirectorPartialBatch,
  StoryboardDirectorRecipe,
} from '../../../lib/storyboard/recipe/types'
import {
  removeStoryboardDirectorReceiptsForTarget,
} from './skills/storyboardDirectorMaterialization'

export function resolveStoryboardDirectorRecipeRevision({
  expectedRevision,
  currentRecipe,
  requestedRecipe,
  recoverLatestRecipe,
}: {
  expectedRevision: string
  currentRecipe: StoryboardDirectorRecipe
  requestedRecipe: StoryboardDirectorRecipe
  recoverLatestRecipe?: (
    latestRecipe: StoryboardDirectorRecipe,
  ) => StoryboardDirectorRecipe
}):
  | { status: 'conflict' }
  | { status: 'resolved'; recipe: StoryboardDirectorRecipe } {
  if (createStoryboardDirectorRecipeRevision(currentRecipe) === expectedRevision) {
    return { status: 'resolved', recipe: requestedRecipe }
  }
  return recoverLatestRecipe
    ? { status: 'resolved', recipe: recoverLatestRecipe(currentRecipe) }
    : { status: 'conflict' }
}

type RecipeNode = {
  id: string
  metadataJson?: unknown
}

function mergeRecipeMetadata(
  metadataJson: unknown,
  recipeMetadata: ReturnType<typeof storyboardDirectorRecipeMetadata>,
) {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) {
    return null
  }
  try {
    const clone: Record<string, unknown> = {}
    const keys = Reflect.ownKeys(metadataJson)
    for (const key of keys) {
      if (typeof key !== 'string') return null
      const descriptor = Object.getOwnPropertyDescriptor(metadataJson, key)
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null
      Object.defineProperty(clone, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    clone.storyboardDirectorRecipe = recipeMetadata.storyboardDirectorRecipe
    return clone
  } catch {
    return null
  }
}

export type StoryboardDirectorReceiptAwareDeletionPlan<Node extends RecipeNode> =
  | {
      status: 'unrelated'
      nextNodes: readonly Node[]
      affectedControlNodeIds: []
      removedReceiptCount: 0
    }
  | {
      status: 'blocked'
      nextNodes: readonly Node[]
      affectedControlNodeIds: string[]
      removedReceiptCount: number
    }
  | {
      status: 'reconciled'
      nextNodes: Node[]
      affectedControlNodeIds: string[]
      removedReceiptCount: number
    }

export function planStoryboardDirectorReceiptAwareDeletion<Node extends RecipeNode>(
  nodes: readonly Node[],
  targetId: string,
  now: string,
): StoryboardDirectorReceiptAwareDeletionPlan<Node> {
  const updates = new Map<string, unknown>()
  const affectedControlNodeIds: string[] = []
  let removedReceiptCount = 0
  for (const node of nodes) {
    const read = readStoryboardDirectorRecipe(node.metadataJson)
    if (read.status !== 'valid') continue
    const removed = removeStoryboardDirectorReceiptsForTarget(read.recipe, targetId, now)
    if (removed.removedReceipts.length === 0) continue
    const metadataJson = mergeRecipeMetadata(
      node.metadataJson,
      storyboardDirectorRecipeMetadata(removed.recipe),
    )
    affectedControlNodeIds.push(node.id)
    removedReceiptCount += removed.removedReceipts.length
    if (!metadataJson) {
      return {
        status: 'blocked',
        nextNodes: nodes,
        affectedControlNodeIds,
        removedReceiptCount,
      }
    }
    updates.set(node.id, metadataJson)
  }
  if (removedReceiptCount === 0) {
    return {
      status: 'unrelated',
      nextNodes: nodes,
      affectedControlNodeIds: [],
      removedReceiptCount: 0,
    }
  }
  return {
    status: 'reconciled',
    nextNodes: nodes
      .filter((node) => node.id !== targetId)
      .map((node) => {
        const metadataJson = updates.get(node.id)
        return metadataJson === undefined ? node : { ...node, metadataJson }
      }),
    affectedControlNodeIds,
    removedReceiptCount,
  }
}

export function executeStoryboardDirectorReceiptAwareDeletion<Node extends RecipeNode>(
  plan: StoryboardDirectorReceiptAwareDeletionPlan<Node>,
  effects: {
    persist: (nextNodes: readonly Node[]) => boolean
    commit: (nextNodes: readonly Node[]) => void
  },
) {
  if (plan.status !== 'reconciled') return false
  if (!effects.persist(plan.nextNodes)) return false
  effects.commit(plan.nextNodes)
  return true
}

export type StoryboardDirectorEmergencyLock = {
  projectId: string
  workflowId: string
  controlNodeId: string
  recipeId: string
  blocker: StoryboardDirectorPartialBatch
}

type EmergencyLockScope = Omit<StoryboardDirectorEmergencyLock, 'blocker'>

function sameEmergencyScope(
  lock: EmergencyLockScope,
  scope: EmergencyLockScope,
) {
  return lock.projectId === scope.projectId
    && lock.workflowId === scope.workflowId
    && lock.controlNodeId === scope.controlNodeId
    && lock.recipeId === scope.recipeId
}

export function selectStoryboardDirectorEmergencyLock(
  locks: readonly StoryboardDirectorEmergencyLock[],
  scope: EmergencyLockScope,
) {
  return locks.find((lock) => sameEmergencyScope(lock, scope)) ?? null
}

export function upsertStoryboardDirectorEmergencyLock(
  locks: readonly StoryboardDirectorEmergencyLock[],
  next: StoryboardDirectorEmergencyLock,
) {
  return [
    ...locks.filter((lock) => !sameEmergencyScope(lock, next)),
    next,
  ]
}

export function clearStoryboardDirectorEmergencyLock(
  locks: readonly StoryboardDirectorEmergencyLock[],
  scope: EmergencyLockScope,
  batchId: string,
) {
  return locks.filter((lock) => (
    !sameEmergencyScope(lock, scope) || lock.blocker.batchId !== batchId
  ))
}
