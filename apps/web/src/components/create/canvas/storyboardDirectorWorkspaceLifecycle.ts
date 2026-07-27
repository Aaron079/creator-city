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
  storyboardDirectorPartialBatchBlockers,
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

export function mergeStoryboardDirectorRecipeMetadata(
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
    const metadataJson = mergeStoryboardDirectorRecipeMetadata(
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

export function collectStoryboardDirectorDurableLocks(
  nodes: readonly RecipeNode[],
  scope: { projectId: string; workflowId: string },
) {
  return nodes.flatMap((node): StoryboardDirectorEmergencyLock[] => {
    const read = readStoryboardDirectorRecipe(node.metadataJson)
    if (read.status !== 'valid'
      || read.recipe.projectId !== scope.projectId
      || read.recipe.workflowId !== scope.workflowId) return []
    return storyboardDirectorPartialBatchBlockers(read.recipe).map((blocker) => ({
      ...scope,
      controlNodeId: node.id,
      recipeId: read.recipe.recipeId,
      blocker,
    }))
  })
}

export function hasDurablyAcknowledgedStoryboardDirectorBatch(
  nodes: readonly RecipeNode[],
  scope: EmergencyLockScope,
  batchId: string,
) {
  const controlNode = nodes.find((node) => node.id === scope.controlNodeId)
  const read = readStoryboardDirectorRecipe(controlNode?.metadataJson)
  return read.status === 'valid'
    && read.recipe.recipeId === scope.recipeId
    && read.recipe.projectId === scope.projectId
    && read.recipe.workflowId === scope.workflowId
    && !storyboardDirectorPartialBatchBlockers(read.recipe).some(
      (blocker) => blocker.batchId === batchId,
    )
}

export function runStoryboardDirectorContextTransition({
  flushDrafts,
  transition,
}: {
  flushDrafts: () => boolean
  transition: () => void
}) {
  if (!flushDrafts()) return false
  transition()
  return true
}

export function reserveStoryboardDirectorNodeId(
  occupiedIds: Set<string>,
  createCandidate: () => string,
  maxAttempts = 16,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = createCandidate()
    if (!occupiedIds.has(candidate)) {
      occupiedIds.add(candidate)
      return candidate
    }
  }
  throw new Error('Unable to reserve a unique node ID for Storyboard Director batch')
}

export type StoryboardDirectorCreationBatchResult<Receipt> = {
  status: 'complete' | 'partial'
  completed: Array<{ targetId: string; receipt?: Receipt }>
  uncreatedCount: number
}

export function runStoryboardDirectorCreationBatch<Plan, Created extends { targetId: string }, Receipt>(
  plans: readonly Plan[],
  effects: {
    create: (plan: Plan, index: number) => Created
    receipt: (plan: Plan, created: Created, index: number) => Receipt
  },
): StoryboardDirectorCreationBatchResult<Receipt> {
  const completed: Array<{ targetId: string; receipt?: Receipt }> = []
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index]!
    let created: Created
    try {
      created = effects.create(plan, index)
    } catch {
      return {
        status: 'partial',
        completed,
        uncreatedCount: plans.length - completed.length,
      }
    }
    const item: { targetId: string; receipt?: Receipt } = {
      targetId: created.targetId,
    }
    completed.push(item)
    try {
      item.receipt = effects.receipt(plan, created, index)
    } catch {
      return {
        status: 'partial',
        completed,
        uncreatedCount: plans.length - completed.length,
      }
    }
  }
  return { status: 'complete', completed, uncreatedCount: 0 }
}

export function executeStoryboardDirectorRecoveryPersistence<Recipe>({
  readLatest,
  buildRecovery,
  persist,
  retainCandidate,
  retainEmergency,
}: {
  readLatest: () => Recipe | null
  buildRecovery: (latest: Recipe) => Recipe
  persist: (candidate: Recipe, latest: Recipe) => boolean
  retainCandidate: (candidate: Recipe, latest: Recipe) => void
  retainEmergency: () => void
}): { status: 'persisted' | 'emergency' } {
  let candidate: Recipe | null = null
  let latest: Recipe | null = null
  try {
    latest = readLatest()
    if (latest) {
      candidate = buildRecovery(latest)
      if (persist(candidate, latest)) return { status: 'persisted' }
    }
  } catch {
    // Retain the scoped in-memory lock below.
  }
  try {
    if (candidate && latest) retainCandidate(candidate, latest)
  } finally {
    retainEmergency()
  }
  return { status: 'emergency' }
}
