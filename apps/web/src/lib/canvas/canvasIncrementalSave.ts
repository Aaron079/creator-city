export type CanvasSaveEntity = {
  id: string
}

export function collectChangedEntityIds<T extends CanvasSaveEntity>(
  previous: readonly T[],
  next: readonly T[],
) {
  const previousById = new Map(previous.map((entity) => [entity.id, entity]))
  return new Set(
    next
      .filter((entity) => previousById.get(entity.id) !== entity)
      .map((entity) => entity.id),
  )
}

export function buildCanvasEntitySavePayload<
  Node extends CanvasSaveEntity,
  Edge extends CanvasSaveEntity,
>({
  nodes,
  edges,
  dirtyNodeIds,
  dirtyEdgeIds,
  forceFull = false,
}: {
  nodes: readonly Node[]
  edges: readonly Edge[]
  dirtyNodeIds: ReadonlySet<string>
  dirtyEdgeIds: ReadonlySet<string>
  forceFull?: boolean
}) {
  if (forceFull) {
    return {
      saveMode: 'full' as const,
      nodes: [...nodes],
      edges: [...edges],
    }
  }

  return {
    saveMode: 'incremental' as const,
    nodes: nodes.filter((node) => dirtyNodeIds.has(node.id)),
    edges: edges.filter((edge) => dirtyEdgeIds.has(edge.id)),
  }
}
