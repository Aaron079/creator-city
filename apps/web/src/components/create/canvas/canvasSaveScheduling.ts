export type CanvasSaveScheduleOptions = {
  snapshot: 'flush' | 'already-flushed'
}

export function writeCanonicalCanvasSnapshot(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  payload: unknown,
) {
  const serialized = JSON.stringify(payload)
  storage.setItem(key, serialized)
  return serialized
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
  persistenceOrder = 'flush-first',
  operation,
  flushSnapshot,
  scheduleSave,
}: {
  hasPriorMutation?: boolean
  persistenceOrder?: 'flush-first' | 'schedule-first'
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

  let flushSucceeded = false
  let scheduleSucceeded = false
  if (persistenceOrder === 'schedule-first') {
    try {
      scheduleSave()
      scheduleSucceeded = true
    } catch {
      scheduleSucceeded = false
    }
    if (scheduleSucceeded) {
      try {
        flushSnapshot()
        flushSucceeded = true
      } catch {
        flushSucceeded = false
      }
    }
  } else {
    try {
      flushSnapshot()
      flushSucceeded = true
    } catch {
      flushSucceeded = false
    }
    try {
      scheduleSave()
      scheduleSucceeded = true
    } catch {
      scheduleSucceeded = false
    }
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

export type CanvasAutosaveSuppression<
  Node,
  Edge,
> = {
  nodes: readonly Node[]
  edges: readonly Edge[]
  zoom: number
  panX: number
  panY: number
}

export function createCanvasAutosaveSuppression<Node, Edge>(
  nodes: readonly Node[],
  edges: readonly Edge[],
  viewport: { zoom: number; pan: { x: number; y: number } },
): CanvasAutosaveSuppression<Node, Edge> {
  return {
    nodes,
    edges,
    zoom: viewport.zoom,
    panX: viewport.pan.x,
    panY: viewport.pan.y,
  }
}

export function consumeCanvasAutosaveSuppression<Node, Edge>(
  token: CanvasAutosaveSuppression<Node, Edge> | null,
  nodes: readonly Node[],
  edges: readonly Edge[],
  viewport: { zoom: number; pan: { x: number; y: number } },
) {
  if (!token) return { suppress: false, next: null }
  return {
    suppress: token.nodes === nodes
      && token.edges === edges
      && token.zoom === viewport.zoom
      && token.panX === viewport.pan.x
      && token.panY === viewport.pan.y,
    next: null,
  }
}
