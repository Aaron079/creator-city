export type WorkflowNodeCountRow = {
  id: string
  _count: { nodes: number }
}

export function toWorkflowNodeCountMap(
  rows: readonly WorkflowNodeCountRow[],
): Map<string, number> {
  return new Map(rows.map((row) => [row.id, row._count.nodes]))
}

export function countProjectWorkflowNodes(
  workflows: readonly { id: string }[],
  counts: ReadonlyMap<string, number>,
): number {
  return workflows.reduce(
    (total, workflow) => total + (counts.get(workflow.id) ?? 0),
    0,
  )
}

export type ProjectAssetCountRow = {
  projectId: string | null
  _count: { _all: number }
}

export function toProjectAssetCountMap(
  rows: readonly ProjectAssetCountRow[],
): Map<string, number> {
  return new Map(
    rows.flatMap((row) => (
      row.projectId === null ? [] : [[row.projectId, row._count._all] as const]
    )),
  )
}

export function countProjectAssets(
  projectId: string,
  counts: ReadonlyMap<string, number>,
): number {
  return counts.get(projectId) ?? 0
}
