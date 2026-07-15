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
