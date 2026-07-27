import {
  readStoryboardDirectorRecipe,
  storyboardDirectorRecipeMetadata,
} from '../storyboard/recipe/persistence'

const VERSION_TOLERANCE_MS = 500

export type CanvasDraftRecoveryInput = {
  projectId: string
  workflowId: string
  serverUpdatedAt?: string
  serverNodeCount: number
  local?: {
    projectId: string
    workflowId: string
    updatedAt?: string
    syncedAt?: string
    serverUpdatedAt?: string
    nodeCount: number
  } | null
}

export type CanvasDraftRecoveryDecision =
  | {
      action: 'server'
      reason:
        | 'no-local'
        | 'project-mismatch'
        | 'workflow-mismatch'
        | 'local-empty'
        | 'invalid-local-time'
        | 'missing-sync-baseline'
        | 'local-not-newer'
    }
  | { action: 'prompt-local-recovery'; reason: 'unsynced-local-draft' }

function timestamp(value?: string) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

export function decideCanvasDraftRecovery(
  input: CanvasDraftRecoveryInput,
): CanvasDraftRecoveryDecision {
  const local = input.local
  if (!local) return { action: 'server', reason: 'no-local' }
  if (local.projectId !== input.projectId) return { action: 'server', reason: 'project-mismatch' }
  if (local.workflowId !== input.workflowId) return { action: 'server', reason: 'workflow-mismatch' }
  if (local.nodeCount <= 0) return { action: 'server', reason: 'local-empty' }

  const localUpdatedAt = timestamp(local.updatedAt)
  if (!localUpdatedAt) return { action: 'server', reason: 'invalid-local-time' }

  const syncBaseline = Math.max(
    timestamp(local.syncedAt),
    timestamp(local.serverUpdatedAt),
    timestamp(input.serverUpdatedAt),
  )
  if (!syncBaseline) return { action: 'server', reason: 'missing-sync-baseline' }
  if (localUpdatedAt <= syncBaseline + VERSION_TOLERANCE_MS) {
    return { action: 'server', reason: 'local-not-newer' }
  }

  return { action: 'prompt-local-recovery', reason: 'unsynced-local-draft' }
}

type CanvasRecoveryRecipeNode = {
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
    for (const key of Reflect.ownKeys(metadataJson)) {
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

export type StoryboardDirectorRecoveryRiskMerge<Node extends CanvasRecoveryRecipeNode> = {
  status: 'none' | 'merged' | 'blocked'
  nodes: Node[]
  batchIds: string[]
}

export function mergeStoryboardDirectorRecoveryRiskIntoServerNodes<
  Node extends CanvasRecoveryRecipeNode,
>({
  projectId,
  workflowId,
  serverNodes,
  localNodes,
}: {
  projectId: string
  workflowId: string
  serverNodes: readonly Node[]
  localNodes: readonly CanvasRecoveryRecipeNode[]
}): StoryboardDirectorRecoveryRiskMerge<Node> {
  const recoveries = localNodes.flatMap((node) => {
    const read = readStoryboardDirectorRecipe(node.metadataJson)
    if (read.status !== 'valid'
      || read.recipe.projectId !== projectId
      || read.recipe.workflowId !== workflowId) return []
    const findings = read.recipe.findings.filter((finding) => (
      finding.code === 'PARTIAL_MATERIALIZATION_BATCH'
      && finding.severity === 'blocking'
      && finding.partialBatch
    ))
    return findings.length ? [{ recipe: read.recipe, findings }] : []
  })
  if (!recoveries.length) {
    return { status: 'none', nodes: [...serverNodes], batchIds: [] }
  }

  const nextNodes = [...serverNodes]
  const batchIds = new Set<string>()
  let blocked = false
  for (const recovery of recoveries) {
    for (const finding of recovery.findings) {
      batchIds.add(finding.partialBatch!.batchId)
    }
    const controlIndex = nextNodes.findIndex((node) => {
      const read = readStoryboardDirectorRecipe(node.metadataJson)
      return read.status === 'valid'
        && read.recipe.recipeId === recovery.recipe.recipeId
        && read.recipe.projectId === projectId
        && read.recipe.workflowId === workflowId
    })
    if (controlIndex < 0) {
      blocked = true
      continue
    }
    const controlNode = nextNodes[controlIndex]!
    const serverRead = readStoryboardDirectorRecipe(controlNode.metadataJson)
    if (serverRead.status !== 'valid') {
      blocked = true
      continue
    }

    const recoveryBatchIds = new Set(
      recovery.findings.map((finding) => finding.partialBatch!.batchId),
    )
    const successfulTargetIds = new Set(
      recovery.findings.flatMap((finding) => finding.partialBatch!.successfulTargetIds),
    )
    const findings = [
      ...serverRead.recipe.findings.filter((finding) => (
        !finding.partialBatch || !recoveryBatchIds.has(finding.partialBatch.batchId)
      )),
      ...recovery.findings,
    ]
    const receipts = [...serverRead.recipe.receipts]
    for (const receipt of recovery.recipe.receipts) {
      if (!successfulTargetIds.has(receipt.targetId)) continue
      const same = receipts.some((current) => (
        current.identity === receipt.identity
        && current.targetId === receipt.targetId
        && current.kind === receipt.kind
        && current.resultId === receipt.resultId
      ))
      const conflicts = receipts.some((current) => (
        current.identity === receipt.identity || current.targetId === receipt.targetId
      ))
      if (!same && !conflicts) receipts.push(receipt)
    }
    const candidate = {
      ...serverRead.recipe,
      findings,
      receipts,
      audit: {
        ...serverRead.recipe.audit,
        updatedAt: recovery.recipe.audit.updatedAt,
      },
    }
    let metadataJson: Record<string, unknown> | null = null
    try {
      metadataJson = mergeRecipeMetadata(
        controlNode.metadataJson,
        storyboardDirectorRecipeMetadata(candidate),
      )
    } catch {
      blocked = true
      continue
    }
    const validated = readStoryboardDirectorRecipe(metadataJson)
    if (!metadataJson || validated.status !== 'valid') {
      blocked = true
      continue
    }
    nextNodes[controlIndex] = {
      ...controlNode,
      metadataJson,
    }
  }

  return {
    status: blocked ? 'blocked' : 'merged',
    nodes: nextNodes,
    batchIds: [...batchIds].sort(),
  }
}
