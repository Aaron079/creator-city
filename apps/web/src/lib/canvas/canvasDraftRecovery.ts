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
