// Pure helper functions for Sequence Board.
// No API calls, no generation, no credits consumed.

export type SequenceRole = 'main' | 'alternate' | 'redo' | 'reference'

export interface SequenceItem {
  id: string
  nodeId: string
  order: number
  label: string
  role: SequenceRole
  durationSeconds: number
  note: string
}

export interface SeqNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  resultText?: string | null
  assetId?: string | null
  status?: string | null
  providerId?: string | null
  model?: string | null
  metadataJson?: unknown
  x?: number
  y?: number
  createdAt?: number
}

export interface SeqEdge {
  id: string
  fromNodeId: string
  toNodeId: string
}

export function isSequenceable(node: SeqNode): boolean {
  return node.kind === 'image' || node.kind === 'video' || node.kind === 'text'
}

export function hasAsset(node: SeqNode): boolean {
  if (node.assetId) return true
  if (node.resultImageUrl) return true
  if (node.resultVideoUrl) return true
  const meta = safeMetaJson(node.metadataJson)
  if (meta?.assetId) return true
  return false
}

export function safeMetaJson(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

export function promptSummary(prompt: string | null | undefined, maxLen = 80): string {
  const p = (prompt ?? '').trim()
  if (!p) return ''
  return p.length <= maxLen ? p : p.slice(0, maxLen - 1) + '…'
}

/** Order nodes by edge chain (Kahn's algorithm), fallback to createdAt/insertion order. */
function topologicalSort(nodes: SeqNode[], edges: SeqEdge[]): SeqNode[] {
  const ids = new Set(nodes.map((n) => n.id))
  const inDeg: Record<string, number> = {}
  const outEdges: Record<string, string[]> = {}
  for (const n of nodes) {
    inDeg[n.id] = 0
    outEdges[n.id] = []
  }
  for (const e of edges) {
    if (ids.has(e.fromNodeId) && ids.has(e.toNodeId)) {
      outEdges[e.fromNodeId]?.push(e.toNodeId)
      inDeg[e.toNodeId] = (inDeg[e.toNodeId] ?? 0) + 1
    }
  }
  const queue: string[] = []
  for (const n of nodes) {
    if ((inDeg[n.id] ?? 0) === 0) queue.push(n.id)
  }
  const result: SeqNode[] = []
  const visited = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const node = nodes.find((n) => n.id === id)
    if (node) result.push(node)
    for (const next of outEdges[id] ?? []) {
      if (!visited.has(next)) queue.push(next)
    }
  }
  for (const n of nodes) {
    if (!visited.has(n.id)) result.push(n)
  }
  return result
}

/** Build default sequence: image/video done nodes in edge order. */
export function buildDefaultSequence(nodes: SeqNode[], edges: SeqEdge[]): SequenceItem[] {
  const eligible = nodes.filter(
    (n) => (n.kind === 'image' || n.kind === 'video') && n.status === 'done',
  )
  if (eligible.length === 0) return []
  const ordered = topologicalSort(eligible, edges)
  return ordered.map((node, i) => ({
    id: `seq-${node.id}-${i}`,
    nodeId: node.id,
    order: i,
    label: `Shot ${String(i + 1).padStart(2, '0')}`,
    role: 'main' as SequenceRole,
    durationSeconds: node.kind === 'video' ? 5 : 3,
    note: '',
  }))
}

export function totalDurationSeconds(items: SequenceItem[]): number {
  return items
    .filter((i) => i.role === 'main')
    .reduce((sum, i) => sum + (Number(i.durationSeconds) || 0), 0)
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

export function buildSequenceReportText(items: SequenceItem[], nodes: SeqNode[]): string {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const mainItems = items.filter((i) => i.role === 'main')
  const redoItems = items.filter((i) => i.role === 'redo')
  const total = totalDurationSeconds(items)

  const roleLabel: Record<SequenceRole, string> = {
    main: '正片',
    alternate: '备选',
    redo: '待重做',
    reference: '参考',
  }
  const statusLabel: Record<string, string> = {
    done: '可用',
    idle: '草案',
    error: '需重做',
    running: '处理中',
    pending: '处理中',
  }

  const lines: string[] = [
    '# 镜头序列清单',
    `总镜头数: ${items.length} | 正片: ${mainItems.length} | 总时长: ${formatDuration(total)}`,
    '',
    '## 序列',
  ]
  for (const item of items) {
    const node = nodeMap.get(item.nodeId)
    lines.push(`[${item.label}] ${node?.title ?? item.nodeId}`)
    lines.push(
      `  类型: ${node?.kind ?? '?'} | 角色: ${roleLabel[item.role] ?? item.role} | 时长: ${item.durationSeconds}s | 状态: ${statusLabel[node?.status ?? ''] ?? (node?.status ?? '?')}`,
    )
    if (node?.prompt) lines.push(`  Prompt: ${promptSummary(node.prompt)}`)
    if (item.note) lines.push(`  备注: ${item.note}`)
  }
  if (redoItems.length > 0) {
    lines.push('', '## 待重做')
    for (const item of redoItems) {
      const node = nodeMap.get(item.nodeId)
      lines.push(
        `- ${item.label} ${node?.title ?? item.nodeId}${item.note ? ': ' + item.note : ''}`,
      )
    }
  }
  lines.push(
    '',
    '---',
    '安全说明: 本清单由 Sequence Board 工具生成，不自动生成内容，不消耗 credits。',
  )
  return lines.join('\n')
}
