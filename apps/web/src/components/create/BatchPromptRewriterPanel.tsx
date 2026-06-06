'use client'

import { useState, useMemo, useCallback } from 'react'
import { Check, Copy } from 'lucide-react'
import {
  type BatchRewriteDimension,
  type BatchRewriteNode,
  type BatchRewriteTarget,
  DIMENSION_LABELS,
  QUICK_CHIPS,
  isSelectableNode,
  isRunningNode,
  previewBatchAppend,
  buildBatchRewriteReportText,
} from '@/lib/canvas/batch-prompt-rewriter'

// ── Types ──────────────────────────────────────────────────────────────

interface BatchPromptRewriterPanelProps {
  nodes: BatchRewriteNode[]
  onBatchPatch: (updates: Array<{ nodeId: string; prompt: string }>) => void
  onClose: () => void
}

type KindFilter = 'all' | 'text' | 'image' | 'video'

const KIND_BADGE: Record<string, string> = {
  image: '图片',
  video: '视频',
  text: '文本',
}

const KIND_BADGE_COLOR: Record<string, string> = {
  image: 'bg-violet-500/20 text-violet-300',
  video: 'bg-blue-500/20 text-blue-300',
  text: 'bg-emerald-500/20 text-emerald-300',
}

const STATUS_LABEL: Record<string, string> = {
  idle: '待机',
  done: '已完成',
  error: '失败',
  running: '生成中',
  pending: '等待中',
  queued: '排队中',
  generating: '生成中',
}

const DIMENSIONS: BatchRewriteDimension[] = [
  'style',
  'texture',
  'negative',
  'aspect',
  'camera',
  'custom',
]

// ── Component ──────────────────────────────────────────────────────────

export function BatchPromptRewriterPanel({ nodes, onBatchPatch, onClose }: BatchPromptRewriterPanelProps) {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dimension, setDimension] = useState<BatchRewriteDimension>('style')
  const [appendText, setAppendText] = useState('')
  const [targets, setTargets] = useState<BatchRewriteTarget[] | null>(null)
  const [applied, setApplied] = useState<{ updated: number; skipped: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedReport, setCopiedReport] = useState(false)

  // Selectable nodes (text/image/video)
  const selectableNodes = useMemo(
    () => nodes.filter((n) => isSelectableNode(n)),
    [nodes],
  )

  const filteredNodes = useMemo(() => {
    if (kindFilter === 'all') return selectableNodes
    return selectableNodes.filter((n) => n.kind === kindFilter)
  }, [selectableNodes, kindFilter])

  // Running nodes should warn but still be selectable — just default unchecked
  const isRunning = useCallback((n: BatchRewriteNode) => isRunningNode(n), [])

  // Selection helpers
  const toggleNode = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setTargets(null)
    setApplied(null)
  }

  const selectAll = () => {
    setSelectedIds(new Set(filteredNodes.filter((n) => !isRunning(n)).map((n) => n.id)))
    setTargets(null)
    setApplied(null)
  }

  const selectKind = (kind: 'image' | 'video') => {
    setSelectedIds(new Set(selectableNodes.filter((n) => n.kind === kind && !isRunning(n)).map((n) => n.id)))
    setTargets(null)
    setApplied(null)
  }

  const clearAll = () => {
    setSelectedIds(new Set())
    setTargets(null)
    setApplied(null)
  }

  // Invalidate preview when inputs change
  const handleDimensionChange = (d: BatchRewriteDimension) => {
    setDimension(d)
    setTargets(null)
    setApplied(null)
  }

  const handleTextChange = (t: string) => {
    setAppendText(t)
    setTargets(null)
    setApplied(null)
  }

  const appendChip = (text: string) => {
    setAppendText((prev) => {
      const base = prev.trim()
      return base ? `${base}, ${text}` : text
    })
    setTargets(null)
    setApplied(null)
  }

  // Generate preview
  const handlePreview = () => {
    if (!appendText.trim() || selectedIds.size === 0) return
    const result = previewBatchAppend(nodes, selectedIds, dimension, appendText)
    setTargets(result)
    setApplied(null)
  }

  // Apply patches
  const handleApply = () => {
    if (!targets) return
    const toUpdate = targets.filter((t) => !t.alreadyContains)
    if (toUpdate.length === 0) return
    onBatchPatch(toUpdate.map((t) => ({ nodeId: t.nodeId, prompt: t.previewPrompt })))
    const skipped = targets.filter((t) => t.alreadyContains).length
    setApplied({ updated: toUpdate.length, skipped })
  }

  // Copy append text
  const handleCopyText = () => {
    void navigator.clipboard.writeText(appendText.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  // Copy report
  const handleCopyReport = () => {
    if (!targets) return
    const text = buildBatchRewriteReportText(dimension, appendText, targets)
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedReport(true)
      setTimeout(() => setCopiedReport(false), 1800)
    })
  }

  // Can apply?
  const canApply =
    targets !== null &&
    targets.some((t) => !t.alreadyContains) &&
    appendText.trim().length > 0

  const selectedCount = selectedIds.size
  const updateCount = targets ? targets.filter((t) => !t.alreadyContains).length : 0
  const skipCount = targets ? targets.filter((t) => t.alreadyContains).length : 0

  // Chips for current dimension
  const relevantChips = QUICK_CHIPS.filter((c) => c.dims.includes(dimension) || dimension === 'custom')

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] -translate-y-1/2 flex flex-col gap-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f14]/97 shadow-2xl backdrop-blur-xl"
      style={{ width: 420, maxHeight: 'calc(100vh - 80px)' }}
      data-no-node-drag="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
        <div>
          <p className="text-[13px] font-semibold text-white/90">批量 Prompt 重写</p>
          <p className="mt-0.5 text-[11px] text-white/40">Batch Prompt Rewriter</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/8 hover:text-white/70"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex flex-col gap-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>

        {/* Safety notice */}
        <div className="mx-4 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/6 px-4 py-3">
          <p className="text-[11px] font-semibold text-amber-400/80">安全边界</p>
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-white/50">
            <li>· 只追加，不替换原 prompt</li>
            <li>· 确认前不会修改任何节点</li>
            <li>· 不会自动生成 / 不消耗 credits</li>
          </ul>
        </div>

        {/* Node selection */}
        <div className="px-4 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">节点选择</p>
            <span className="text-[11px] text-white/30">{selectableNodes.length} 个可用节点</span>
          </div>

          {/* Kind filter tabs */}
          <div className="mb-3 flex gap-1">
            {(['all', 'text', 'image', 'video'] as KindFilter[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => { setKindFilter(k); setTargets(null); setApplied(null) }}
                className={`rounded-lg px-2.5 py-1 text-[11px] transition ${
                  kindFilter === k
                    ? 'bg-white/12 text-white/90 font-semibold'
                    : 'text-white/40 hover:bg-white/6 hover:text-white/60'
                }`}
              >
                {k === 'all' ? '全部' : k === 'text' ? 'Text' : k === 'image' ? 'Image' : 'Video'}
              </button>
            ))}
          </div>

          {/* Quick select actions */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/50 transition hover:border-white/20 hover:text-white/70"
            >
              全选可用
            </button>
            <button
              type="button"
              onClick={() => selectKind('image')}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/50 transition hover:border-white/20 hover:text-white/70"
            >
              只选 Image
            </button>
            <button
              type="button"
              onClick={() => selectKind('video')}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/50 transition hover:border-white/20 hover:text-white/70"
            >
              只选 Video
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/50 transition hover:border-red-500/30 hover:text-red-400/70"
            >
              清空选择
            </button>
          </div>

          {/* Node list */}
          <div className="flex max-h-[200px] flex-col gap-1 overflow-y-auto rounded-xl border border-white/8 bg-white/3 p-1.5">
            {filteredNodes.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-white/30">此类型暂无节点</p>
            ) : (
              filteredNodes.map((node) => {
                const running = isRunning(node)
                const checked = selectedIds.has(node.id)
                const promptPreview = (node.prompt ?? node.resultText ?? '').trim()

                return (
                  <label
                    key={node.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition ${
                      running ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'
                    } ${checked ? 'bg-white/5' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={running}
                      onChange={() => !running && toggleNode(node.id)}
                      className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-violet-400"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${KIND_BADGE_COLOR[node.kind] ?? 'bg-white/10 text-white/50'}`}
                        >
                          {KIND_BADGE[node.kind] ?? node.kind}
                        </span>
                        <span className="truncate text-[12px] text-white/75">{node.title ?? node.id}</span>
                        <span className="ml-auto flex-shrink-0 text-[10px] text-white/30">
                          {running ? '⚡ 处理中' : STATUS_LABEL[node.status ?? 'idle'] ?? node.status}
                        </span>
                      </div>
                      {promptPreview ? (
                        <p className="mt-1 truncate text-[11px] text-white/35">
                          {promptPreview.slice(0, 80)}{promptPreview.length > 80 ? '…' : ''}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-white/20">（无 prompt）</p>
                      )}
                      {running ? (
                        <p className="mt-0.5 text-[10px] text-amber-400/60">处理中，不建议批量修改</p>
                      ) : null}
                    </div>
                  </label>
                )
              })
            )}
          </div>

          {selectedCount > 0 ? (
            <p className="mt-1.5 text-right text-[11px] text-white/40">已选择 {selectedCount} 个节点</p>
          ) : null}
        </div>

        {/* Append settings */}
        <div className="px-4 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">追加设置</p>

          {/* Dimension selector */}
          <div className="mb-3 grid grid-cols-3 gap-1">
            {DIMENSIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDimensionChange(d)}
                className={`rounded-lg px-2 py-1.5 text-[11px] transition ${
                  dimension === d
                    ? 'bg-violet-500/25 text-violet-300 font-semibold border border-violet-500/30'
                    : 'border border-white/8 text-white/45 hover:border-white/15 hover:text-white/65'
                }`}
              >
                {DIMENSION_LABELS[d]}
              </button>
            ))}
          </div>

          {/* Quick chips */}
          {relevantChips.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {relevantChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => appendChip(chip.text)}
                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40 transition hover:border-violet-500/30 hover:text-violet-300/70"
                >
                  + {chip.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Text input */}
          <div className="relative">
            <textarea
              value={appendText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={3}
              placeholder="例如：cinematic lighting, warm color grade, film grain, consistent character design"
              style={{ colorScheme: 'dark' }}
              className="w-full resize-none rounded-xl border border-white/15 bg-[#10131a] px-3 py-2.5 text-[12px] text-slate-100 caret-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/40 focus:bg-[#13161f]"
            />
            {appendText.trim() ? (
              <button
                type="button"
                onClick={handleCopyText}
                className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border border-white/10 px-1.5 py-0.5 text-[10px] text-white/35 transition hover:border-white/20 hover:text-white/55"
              >
                {copied ? <Check size={9} /> : <Copy size={9} />}
                {copied ? '已复制' : '复制'}
              </button>
            ) : null}
          </div>
        </div>

        {/* Preview */}
        <div className="px-4 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">预览</p>
            {targets !== null ? (
              <span className="text-[11px] text-white/35">
                将更新 <span className="text-violet-300 font-semibold">{updateCount}</span> 个 / 跳过 {skipCount} 个
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handlePreview}
            disabled={selectedCount === 0 || !appendText.trim()}
            className={`mb-3 w-full rounded-xl py-2 text-[12px] font-semibold transition ${
              selectedCount === 0 || !appendText.trim()
                ? 'cursor-not-allowed border border-white/8 text-white/25'
                : 'border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/18'
            }`}
          >
            生成预览
          </button>

          {targets !== null ? (
            <div className="flex max-h-[220px] flex-col gap-2 overflow-y-auto rounded-xl border border-white/8 bg-white/2 p-2">
              {targets.map((t) => (
                <div
                  key={t.nodeId}
                  className={`rounded-lg border px-3 py-2.5 ${
                    t.alreadyContains
                      ? 'border-white/8 bg-white/2 opacity-50'
                      : 'border-violet-500/20 bg-violet-500/5'
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${KIND_BADGE_COLOR[t.kind] ?? 'bg-white/10 text-white/50'}`}>
                      {KIND_BADGE[t.kind] ?? t.kind}
                    </span>
                    <span className="text-[11px] text-white/70">{t.title}</span>
                    {t.alreadyContains ? (
                      <span className="ml-auto text-[10px] text-white/35">已存在类似片段，将跳过</span>
                    ) : (
                      <span className="ml-auto text-[10px] text-violet-400/70">将追加</span>
                    )}
                  </div>
                  {!t.alreadyContains ? (
                    <>
                      <p className="mb-1 text-[10px] text-white/30">
                        修改前：{(t.currentPrompt || '（空）').slice(0, 60)}{t.currentPrompt.length > 60 ? '…' : ''}
                      </p>
                      <p className="text-[10px] text-violet-300/70">
                        修改后：{t.previewPrompt.slice(0, 80)}{t.previewPrompt.length > 80 ? '…' : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-white/30">
                      {(t.currentPrompt || '（空）').slice(0, 80)}{t.currentPrompt.length > 80 ? '…' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/6 bg-white/2 py-5 text-center">
              <p className="text-[11px] text-white/25">选择节点 + 输入追加内容后，点击「生成预览」</p>
            </div>
          )}
        </div>

        {/* Apply */}
        <div className="px-4 pb-4 pt-4">
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className={`w-full rounded-xl py-2.5 text-[13px] font-semibold transition ${
              canApply
                ? 'bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700'
                : 'cursor-not-allowed border border-white/8 text-white/20'
            }`}
          >
            {canApply ? `应用到 ${updateCount} 个节点` : '应用到节点'}
          </button>

          {!canApply && targets === null ? (
            <p className="mt-1.5 text-center text-[10px] text-white/25">请先生成预览，确认无误后再应用</p>
          ) : null}

          {applied ? (
            <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3">
              <p className="text-[12px] font-semibold text-emerald-400">
                已更新 {applied.updated} 个节点
                {applied.skipped > 0 ? `，跳过 ${applied.skipped} 个已存在节点` : ''}
              </p>
              <p className="mt-0.5 text-[11px] text-white/40">prompt 已批量追加，不会自动生成，不消耗 credits。</p>
            </div>
          ) : null}

          {targets !== null ? (
            <button
              type="button"
              onClick={handleCopyReport}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/8 py-2 text-[11px] text-white/35 transition hover:border-white/16 hover:text-white/55"
            >
              {copiedReport ? <Check size={12} /> : <Copy size={12} />}
              {copiedReport ? '已复制报告' : '复制批量修改报告'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
