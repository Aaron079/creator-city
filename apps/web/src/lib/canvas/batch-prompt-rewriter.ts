// Pure helper for batch prompt append. No API calls, no generation, no credits consumed.

export type BatchRewriteDimension =
  | 'style'
  | 'texture'
  | 'negative'
  | 'aspect'
  | 'camera'
  | 'custom'

export const DIMENSION_LABELS: Record<BatchRewriteDimension, string> = {
  style: '风格统一',
  texture: '质感/画质',
  negative: '负向约束',
  aspect: '画幅/构图',
  camera: '镜头语言',
  custom: '自定义',
}

export const DIMENSION_HEADERS: Record<BatchRewriteDimension, string> = {
  style: 'Batch Prompt Rewriter - 风格',
  texture: 'Batch Prompt Rewriter - 质感',
  negative: 'Batch Prompt Rewriter - 负向约束',
  aspect: 'Batch Prompt Rewriter - 画幅',
  camera: 'Batch Prompt Rewriter - 镜头',
  custom: 'Batch Prompt Rewriter - 自定义',
}

export interface BatchRewriteTarget {
  nodeId: string
  title: string
  kind: 'text' | 'image' | 'video'
  currentPrompt: string
  previewPrompt: string
  alreadyContains: boolean
  status: string
}

export interface BatchRewriteNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  resultText?: string | null
  status?: string | null
  providerId?: string | null
  model?: string | null
  metadataJson?: unknown
}

// Quick chips for common append fragments (not a template library — just shortcuts)
export const QUICK_CHIPS: Array<{ label: string; text: string; dims: BatchRewriteDimension[] }> = [
  { label: 'cinematic lighting', text: 'cinematic lighting', dims: ['style', 'texture'] },
  { label: 'consistent character design', text: 'consistent character design', dims: ['style', 'custom'] },
  { label: 'no flicker, no morphing', text: 'no flicker, no morphing, stable motion', dims: ['negative'] },
  { label: 'clean details', text: 'clean details, sharp, high quality', dims: ['texture'] },
  { label: 'wide shot', text: 'wide shot, rule of thirds', dims: ['aspect', 'camera'] },
]

// ── Helpers ────────────────────────────────────────────────────────────

export function getNodeCurrentPrompt(node: BatchRewriteNode): string {
  return (node.prompt ?? node.resultText ?? '').trim()
}

export function isSelectableNode(node: BatchRewriteNode): boolean {
  return node.kind === 'text' || node.kind === 'image' || node.kind === 'video'
}

export function isRunningNode(node: BatchRewriteNode): boolean {
  const s = node.status ?? ''
  return s === 'running' || s === 'pending' || s === 'queued' || s === 'generating'
}

// Checks if appendText already appears in the prompt (first 40 chars of appendText, case-insensitive)
export function hasSimilarAppend(prompt: string, appendText: string): boolean {
  const sample = appendText.trim().slice(0, 40).toLowerCase()
  if (!sample) return false
  return prompt.toLowerCase().includes(sample)
}

// Builds the formatted append text with header
export function buildBatchAppendText(dimension: BatchRewriteDimension, userText: string): string {
  const header = DIMENSION_HEADERS[dimension]
  return `[${header}]\n${userText.trim()}`
}

// Preview what each node's prompt will look like after append
export function previewBatchAppend(
  nodes: BatchRewriteNode[],
  selectedNodeIds: Set<string>,
  dimension: BatchRewriteDimension,
  userText: string,
): BatchRewriteTarget[] {
  const appendBlock = buildBatchAppendText(dimension, userText)
  const results: BatchRewriteTarget[] = []

  for (const node of nodes) {
    if (!selectedNodeIds.has(node.id)) continue
    if (!isSelectableNode(node)) continue

    const currentPrompt = getNodeCurrentPrompt(node)
    const already = hasSimilarAppend(currentPrompt, userText.trim().slice(0, 40))

    let previewPrompt: string
    if (already) {
      previewPrompt = currentPrompt
    } else if (currentPrompt) {
      previewPrompt = currentPrompt + '\n' + appendBlock
    } else {
      previewPrompt = appendBlock
    }

    results.push({
      nodeId: node.id,
      title: node.title ?? node.id,
      kind: node.kind as 'text' | 'image' | 'video',
      currentPrompt,
      previewPrompt,
      alreadyContains: already,
      status: node.status ?? 'idle',
    })
  }

  return results
}

// ── Report builder ─────────────────────────────────────────────────────

export function buildBatchRewriteReportText(
  dimension: BatchRewriteDimension,
  appendText: string,
  targets: BatchRewriteTarget[],
): string {
  const updated = targets.filter((t) => !t.alreadyContains)
  const skipped = targets.filter((t) => t.alreadyContains)

  const lines = [
    '=== 批量 Prompt 重写报告 — Creator City ===',
    `操作维度：${DIMENSION_LABELS[dimension]}`,
    `追加内容：${appendText.trim()}`,
    '',
    `已更新节点（${updated.length}个）：`,
  ]
  for (const t of updated) {
    lines.push(`  [${t.kind.toUpperCase()}] ${t.title}`)
  }
  if (skipped.length > 0) {
    lines.push('', `跳过节点（${skipped.length}个，已存在类似片段）：`)
    for (const t of skipped) {
      lines.push(`  [${t.kind.toUpperCase()}] ${t.title}`)
    }
  }
  lines.push(
    '',
    '安全边界：',
    '  - 只追加，不替换',
    '  - 不覆盖原 prompt',
    '  - 不自动生成',
    '  - 不消耗 credits',
    '  - 不新增 API',
    '',
    '备注：本报告由 Creator City Batch Prompt Rewriter 生成。',
  )
  return lines.join('\n')
}
