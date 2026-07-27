export type CanvasSaveScheduleOptions = {
  snapshot: 'flush' | 'already-flushed'
}

export function completeLocalCanvasSaveSchedule(
  options: CanvasSaveScheduleOptions | undefined,
  effects: {
    flushSnapshot: () => void
    markLocalDraft: () => void
  },
) {
  if (options?.snapshot !== 'already-flushed') effects.flushSnapshot()
  effects.markLocalDraft()
}

export type BoundedCanvasPersistenceResult = {
  operationSucceeded: boolean
  persistenceAttempted: boolean
  persistenceSucceeded: boolean
}

export function runBoundedCanvasPersistence({
  hasPriorMutation = false,
  operation,
  flushSnapshot,
  scheduleSave,
}: {
  hasPriorMutation?: boolean
  operation: (markMutation: () => void) => boolean
  flushSnapshot: () => void
  scheduleSave: () => void
}): BoundedCanvasPersistenceResult {
  let mutationOccurred = hasPriorMutation
  let operationSucceeded = false
  try {
    operationSucceeded = operation(() => {
      mutationOccurred = true
    })
  } catch {
    operationSucceeded = false
  }
  if (!mutationOccurred) {
    return {
      operationSucceeded,
      persistenceAttempted: false,
      persistenceSucceeded: true,
    }
  }

  let flushSucceeded = true
  let scheduleSucceeded = true
  try {
    flushSnapshot()
  } catch {
    flushSucceeded = false
  }
  try {
    scheduleSave()
  } catch {
    scheduleSucceeded = false
  }
  return {
    operationSucceeded,
    persistenceAttempted: true,
    persistenceSucceeded: flushSucceeded && scheduleSucceeded,
  }
}

export function completeEmergencyCanvasAcknowledgment({
  matchesTarget,
  flushSnapshot,
  scheduleSave,
}: {
  matchesTarget: boolean
  flushSnapshot: () => void
  scheduleSave: () => void
}) {
  if (!matchesTarget) return false
  const result = runBoundedCanvasPersistence({
    hasPriorMutation: true,
    operation: () => true,
    flushSnapshot,
    scheduleSave,
  })
  return result.operationSucceeded && result.persistenceSucceeded
}
