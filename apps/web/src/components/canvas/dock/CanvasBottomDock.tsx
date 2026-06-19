'use client'

import { useMemo } from 'react'
import { getDerivedToolVisual } from '@/lib/canvas/derivedToolVisualConfig'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'

// ── helpers ────────────────────────────────────────────────────────────────

function metaRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {}
}

function nodeKindIcon(kind: string): string {
  if (kind === 'image') return '◫'
  if (kind === 'video') return '▻'
  if (kind === 'text') return '✦'
  if (kind === 'audio') return '♫'
  return '◻'
}

function draftStatus(node: VisualCanvasNode): string | undefined {
  const meta = metaRecord(node.metadataJson)
  const draft = metaRecord(meta.generationDraft)
  return typeof draft.status === 'string' ? draft.status : undefined
}

function statusLabel(nodeStatus: string, draft?: string): string {
  if (nodeStatus === 'idle' && draft === 'draft') return '待确认生成'
  if (nodeStatus === 'queued' || nodeStatus === 'pending') return '排队中'
  if (nodeStatus === 'running' || nodeStatus === 'generating' || nodeStatus === 'processing') return '生成中'
  if (nodeStatus === 'done') return '已完成'
  if (nodeStatus === 'error' || nodeStatus === 'failed') return '失败'
  if (nodeStatus === 'cancelled') return '已取消'
  return '准备就绪'
}

function statusDotClass(nodeStatus: string, draft?: string): string {
  if (nodeStatus === 'done') return 'bg-emerald-400/70'
  if (
    nodeStatus === 'running' || nodeStatus === 'generating' ||
    nodeStatus === 'queued' || nodeStatus === 'pending' || nodeStatus === 'processing'
  ) return 'bg-yellow-400/70'
  if (nodeStatus === 'error' || nodeStatus === 'failed') return 'bg-red-400/70'
  if (nodeStatus === 'cancelled') return 'bg-white/30'
  if (nodeStatus === 'idle' && draft === 'draft') return 'bg-yellow-400/50'
  return 'bg-white/15'
}

// ── types ──────────────────────────────────────────────────────────────────

export type CanvasBottomDockProps = {
  expanded: boolean
  onToggle(): void
  activeNode?: VisualCanvasNode | null
  sourceNode?: VisualCanvasNode | null
  taskNodes: VisualCanvasNode[]
  onSelectNode(nodeId: string): void
  onOpenGenerationDialog(nodeId: string): void
}

// ── main component ─────────────────────────────────────────────────────────

export function CanvasBottomDock({
  expanded,
  onToggle,
  activeNode,
  sourceNode,
  taskNodes,
  onSelectNode,
  onOpenGenerationDialog,
}: CanvasBottomDockProps) {
  const activeDraft = activeNode ? draftStatus(activeNode) : undefined
  const activeMeta = activeNode ? metaRecord(activeNode.metadataJson) : {}
  const toolId = typeof activeMeta.derivedFromTool === 'string' ? activeMeta.derivedFromTool : undefined
  const toolLabel = typeof activeMeta.derivedFromToolLabel === 'string' ? activeMeta.derivedFromToolLabel : undefined
  const toolSummary = typeof activeMeta.toolSummaryText === 'string' && activeMeta.toolSummaryText.trim()
    ? activeMeta.toolSummaryText.trim()
    : undefined
  const toolVisual = toolId ? getDerivedToolVisual(toolId) : undefined

  const runningCount = useMemo(
    () => taskNodes.filter(
      (n) => n.status === 'running' || n.status === 'generating' || n.status === 'processing' ||
             n.status === 'queued' || n.status === 'pending'
    ).length,
    [taskNodes],
  )

  return (
    <div className="flex h-full flex-col">

      {/* ── Collapsed header bar (always visible) ─────────── */}
      <div
        className="flex flex-shrink-0 items-center gap-3 px-4"
        style={{ height: 44 }}
      >
        {/* Toggle chevron + label */}
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 text-white/30 transition hover:text-white/60"
          aria-label={expanded ? '折叠任务栏' : '展开任务栏'}
        >
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[11px] font-medium">任务</span>
        </button>

        {/* Active generation badge */}
        {runningCount > 0 ? (
          <span className="rounded bg-yellow-500/[0.12] px-1.5 py-0.5 text-[9px] font-semibold text-yellow-400/75">
            {runningCount} 进行中
          </span>
        ) : null}

        <div className="mx-0.5 h-3 w-px bg-white/[0.08]" />

        {/* Current node quick-status */}
        {activeNode ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span className="flex-shrink-0 text-[11px] text-white/25">{nodeKindIcon(activeNode.kind)}</span>
            <span className="truncate text-[11px] text-white/50">{activeNode.title || '未命名节点'}</span>
            <span className={`flex-shrink-0 inline-block h-1.5 w-1.5 rounded-full ${statusDotClass(activeNode.status, activeDraft)}`} />
            <span className="flex-shrink-0 text-[10px] text-white/30">
              {statusLabel(activeNode.status, activeDraft)}
            </span>
            {toolVisual && toolLabel ? (
              <span className={`flex-shrink-0 text-[9px] ${toolVisual.accentClass}`}>
                {toolVisual.icon} {toolLabel}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-[11px] text-white/20">选择节点以查看任务</span>
        )}

        {/* Task count */}
        <div className="ml-auto flex-shrink-0">
          <span className="text-[10px] text-white/15">{taskNodes.length} 个任务节点</span>
        </div>
      </div>

      {/* ── Expanded body ──────────────────────────────────── */}
      {expanded ? (
        <div className="flex min-h-0 flex-1 overflow-hidden border-t border-white/[0.06]">

          {/* Selected task strip (left column) */}
          <div className="flex w-60 flex-shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] px-3 py-3">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-white/20">当前节点</p>
            {activeNode ? (
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                {/* Identity */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-white/40">{nodeKindIcon(activeNode.kind)}</span>
                  <span className="truncate text-[11px] font-semibold text-white/80" title={activeNode.title}>
                    {activeNode.title || '未命名'}
                  </span>
                </div>
                {/* Status */}
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotClass(activeNode.status, activeDraft)}`} />
                  <span className="text-[10px] text-white/40">{statusLabel(activeNode.status, activeDraft)}</span>
                </div>
                {/* Derived tool badge */}
                {toolVisual && toolLabel ? (
                  <div className={`mt-2 rounded px-2 py-1.5 ${toolVisual.bgClass} border ${toolVisual.borderClass}`}>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]">{toolVisual.icon}</span>
                      <span className={`text-[9px] font-semibold ${toolVisual.accentClass}`}>{toolLabel}</span>
                    </div>
                    {toolSummary ? (
                      <p className="mt-0.5 truncate text-[8.5px] text-white/35" title={toolSummary}>{toolSummary}</p>
                    ) : null}
                  </div>
                ) : null}
                {/* Source node */}
                {sourceNode ? (
                  <button
                    type="button"
                    onClick={() => onSelectNode(sourceNode.id)}
                    className="mt-2 flex w-full items-center gap-1 text-left text-[9px] text-white/25 transition hover:text-white/55"
                  >
                    <span>←</span>
                    <span className="truncate">来源：{sourceNode.title || '未命名'}</span>
                  </button>
                ) : null}
                {/* Prompt snippet */}
                {activeNode.prompt?.trim() ? (
                  <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-white/25">
                    {activeNode.prompt}
                  </p>
                ) : null}
                {/* Open task */}
                <button
                  type="button"
                  onClick={() => onOpenGenerationDialog(activeNode.id)}
                  className="mt-3 w-full rounded-md border border-white/[0.10] bg-white/[0.03] py-1.5 text-[10px] font-medium text-white/50 transition hover:bg-white/[0.07] hover:text-white/80"
                >
                  打开任务
                </button>
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-white/[0.06]">
                <span className="text-[10px] text-white/20">未选择节点</span>
              </div>
            )}
          </div>

          {/* Project task overview (scrollable horizontal strip) */}
          <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            {taskNodes.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6">
                <span className="text-[11px] text-white/20">暂无任务节点</span>
              </div>
            ) : (
              <div className="flex h-full items-stretch gap-2 px-3 py-3">
                {taskNodes.map((node) => {
                  const draft = draftStatus(node)
                  const meta = metaRecord(node.metadataJson)
                  const tid = typeof meta.derivedFromTool === 'string' ? meta.derivedFromTool : undefined
                  const tlabel = typeof meta.derivedFromToolLabel === 'string' ? meta.derivedFromToolLabel : undefined
                  const tv = tid ? getDerivedToolVisual(tid) : undefined
                  const isActive = node.id === activeNode?.id
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                      className={`flex w-[136px] flex-shrink-0 flex-col rounded-lg border px-2.5 py-2 text-left transition ${
                        isActive
                          ? 'border-white/[0.18] bg-white/[0.07]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="flex-shrink-0 text-[11px] text-white/35">{nodeKindIcon(node.kind)}</span>
                        <span className="truncate text-[10px] font-medium text-white/60">{node.title || '未命名'}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDotClass(node.status, draft)}`} />
                        <span className="text-[9px] text-white/30">{statusLabel(node.status, draft)}</span>
                      </div>
                      {tv && tlabel ? (
                        <span className={`mt-1 truncate text-[8px] ${tv.accentClass}`}>
                          {tv.icon} {tlabel}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
