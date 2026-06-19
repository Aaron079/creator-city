'use client'

import { useState } from 'react'
import { getDerivedToolVisual } from '@/lib/canvas/derivedToolVisualConfig'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface InspectorEdgeRef {
  id: string
  fromNodeId: string
  toNodeId: string
  label?: string
}

export interface CanvasRightInspectorProps {
  node: VisualCanvasNode
  sourceNode?: VisualCanvasNode
  incomingEdges: InspectorEdgeRef[]
  outgoingEdges: InspectorEdgeRef[]
  nodeTitleById: Map<string, string>
  onClose(): void
  onOpenGenerationDialog(): void
  onSelectNode?(id: string): void
  projectId?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function nodeKindLabel(kind: string): string {
  if (kind === 'image') return 'Image'
  if (kind === 'video') return 'Video'
  if (kind === 'text') return 'Text'
  if (kind === 'audio') return 'Audio'
  return kind
}

function statusLabel(status: string, kind?: string): string {
  if (status === 'queued' || status === 'pending') return '排队中'
  if (status === 'running' || status === 'generating' || status === 'processing') {
    if (kind === 'image') return '图片生成中'
    if (kind === 'video') return '视频生成中'
    return '生成中'
  }
  if (status === 'done') return '已生成'
  if (status === 'error' || status === 'failed') return '失败'
  if (status === 'cancelled') return '已停止'
  return '待生成'
}

function statusDot(status: string): string {
  if (status === 'done') return 'bg-emerald-400/70'
  if (status === 'running' || status === 'generating' || status === 'queued' || status === 'pending' || status === 'processing') return 'bg-yellow-400/70'
  if (status === 'error' || status === 'failed') return 'bg-red-400/70'
  if (status === 'cancelled') return 'bg-white/30'
  return 'bg-white/20'
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/[0.06] px-4 py-3">
      {title ? (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">{title}</p>
      ) : null}
      {children}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CanvasRightInspector({
  node,
  sourceNode,
  incomingEdges,
  outgoingEdges,
  nodeTitleById,
  onClose,
  onOpenGenerationDialog,
  onSelectNode,
  projectId,
}: CanvasRightInspectorProps) {
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [videoPreviewActive, setVideoPreviewActive] = useState(false)

  const meta = metaRecord(node.metadataJson)
  const draft = metaRecord(meta.generationDraft)

  // Derived tool metadata
  const toolId = typeof meta.derivedFromTool === 'string' ? meta.derivedFromTool : undefined
  const toolLabel = typeof meta.derivedFromToolLabel === 'string' ? meta.derivedFromToolLabel : undefined
  const toolSummary = typeof meta.toolSummaryText === 'string' && meta.toolSummaryText.trim() ? meta.toolSummaryText.trim() : undefined
  const isDerivedNode = Boolean(toolLabel)
  const isDraft = draft.status === 'draft'
  const visual = toolId ? getDerivedToolVisual(toolId) : undefined

  const sourceNodeId = typeof draft.sourceNodeId === 'string' ? draft.sourceNodeId : undefined
  const sourceMissing = Boolean(sourceNodeId && !nodeTitleById.has(sourceNodeId))
  const sourceTitle = sourceNodeId ? (nodeTitleById.get(sourceNodeId) ?? undefined) : undefined

  // Media
  const imageUrl = node.resultImageUrl?.trim() ? getProxiedMediaUrl(node.resultImageUrl) : undefined
  const videoPoster = node.preview?.poster?.trim() ? getProxiedMediaUrl(node.preview.poster) : undefined
  const videoUrl = node.resultVideoUrl?.trim() ? getProxiedMediaUrl(node.resultVideoUrl) : undefined

  // Prompt
  const prompt = node.prompt?.trim() ?? ''
  const promptTruncated = !promptExpanded && prompt.length > 200

  // Relations (max 3 each)
  const incomingSlice = incomingEdges.slice(0, 3)
  const outgoingSlice = outgoingEdges.slice(0, 3)
  const incomingExtra = incomingEdges.length - incomingSlice.length
  const outgoingExtra = outgoingEdges.length - outgoingSlice.length

  // Asset
  const assetId = node.assetId?.trim() ?? undefined
  const assetShort = assetId ? assetId.slice(-8) : undefined

  return (
    <div className="flex h-full flex-col bg-[#0d0f14] text-white">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-start gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] text-white/40">{nodeKindIcon(node.kind)}</span>
            <span className="text-[11px] font-medium text-white/50">{nodeKindLabel(node.kind)}</span>
            <span className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${statusDot(node.status)}`} />
            <span className="text-[10px] text-white/35">{statusLabel(node.status, node.kind)}</span>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-semibold leading-tight text-white/85" title={node.title}>
            {node.title || '未命名节点'}
          </p>
          {isDerivedNode && isDraft ? (
            <span className="mt-1 inline-block rounded bg-yellow-500/[0.12] px-1.5 py-0.5 text-[9px] font-medium text-yellow-400/80">
              待确认生成
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 flex-shrink-0 rounded p-1 text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
          aria-label="关闭检查器"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">

        {/* Media Preview */}
        {(node.kind === 'image' || node.kind === 'video') ? (
          <Section>
            {node.kind === 'image' ? (
              imageUrl ? (
                <div className="overflow-hidden rounded-lg bg-white/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={node.title}
                    className="w-full object-contain"
                    style={{ maxHeight: 200 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg bg-white/[0.03]">
                  <span className="text-[11px] text-white/25">
                    {node.status === 'idle' ? '尚未生成' : node.status === 'done' ? '预览不可用' : statusLabel(node.status, node.kind)}
                  </span>
                </div>
              )
            ) : (
              // Video — click-to-load, no auto-play
              videoPreviewActive && videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-lg bg-black"
                  style={{ maxHeight: 200 }}
                  autoPlay={false}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => videoUrl && setVideoPreviewActive(true)}
                  className="relative w-full overflow-hidden rounded-lg bg-white/[0.04]"
                  style={{ minHeight: 96 }}
                  disabled={!videoUrl}
                >
                  {videoPoster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={videoPoster} alt="" className="w-full object-cover" style={{ maxHeight: 200 }} />
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {videoUrl ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60">
                        <span className="text-white/80">▶</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-white/25">
                        {node.status === 'idle' ? '尚未生成' : statusLabel(node.status, node.kind)}
                      </span>
                    )}
                  </div>
                </button>
              )
            )}
          </Section>
        ) : node.kind === 'text' && node.resultText ? (
          <Section title="文本结果">
            <p className="text-[11px] leading-relaxed text-white/55 line-clamp-6">{node.resultText}</p>
          </Section>
        ) : null}

        {/* Derived Tool Info */}
        {isDerivedNode ? (
          <Section title="工具信息">
            {visual ? (
              <div className={`rounded-lg px-3 py-2.5 ${visual.bgClass} border ${visual.borderClass}`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px]">{visual.icon}</span>
                  <span className={`text-[10px] font-semibold ${visual.accentClass}`}>{toolLabel}</span>
                </div>
                {toolSummary ? (
                  <p className="mt-1 text-[9.5px] leading-relaxed text-white/45" title={toolSummary}>
                    {toolSummary}
                  </p>
                ) : null}
                {sourceTitle || sourceMissing ? (
                  <p className="mt-1 text-[9px] text-white/30">
                    {sourceMissing ? '来源节点已不存在' : `来源：${sourceTitle}`}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Navigate to source */}
            {sourceNode && onSelectNode ? (
              <button
                type="button"
                onClick={() => onSelectNode(sourceNode.id)}
                className="mt-2 flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[10px] text-white/40 transition hover:bg-white/[0.06] hover:text-white/65"
              >
                <span>←</span>
                <span className="truncate">定位来源：{sourceNode.title || '未命名'}</span>
              </button>
            ) : null}
          </Section>
        ) : null}

        {/* Prompt */}
        <Section title="Prompt">
          {prompt ? (
            <>
              <p
                className={`text-[11px] leading-relaxed text-white/50 ${promptTruncated ? 'line-clamp-4' : ''}`}
                title={promptTruncated ? prompt : undefined}
              >
                {prompt}
              </p>
              {prompt.length > 200 ? (
                <button
                  type="button"
                  onClick={() => setPromptExpanded(p => !p)}
                  className="mt-1 text-[10px] text-white/30 hover:text-white/55"
                >
                  {promptExpanded ? '收起' : '展开全部'}
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-[11px] text-white/25">暂无 Prompt</p>
          )}
          <button
            type="button"
            onClick={onOpenGenerationDialog}
            className="mt-3 w-full rounded-lg border border-white/[0.10] bg-white/[0.04] py-2 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white/85"
          >
            打开生成任务
          </button>
        </Section>

        {/* Relations */}
        {(incomingEdges.length > 0 || outgoingEdges.length > 0) ? (
          <Section title="节点关系">
            {incomingSlice.length > 0 ? (
              <div className="mb-2">
                <p className="mb-1 text-[9px] uppercase tracking-wider text-white/20">上游</p>
                {incomingSlice.map(edge => {
                  const title = nodeTitleById.get(edge.fromNodeId) ?? '未知节点'
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => onSelectNode?.(edge.fromNodeId)}
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] text-white/45 transition hover:bg-white/[0.05] hover:text-white/70"
                    >
                      <span className="text-white/25">←</span>
                      <span className="truncate">{edge.label ? `${edge.label} · ` : ''}{title}</span>
                    </button>
                  )
                })}
                {incomingExtra > 0 ? (
                  <p className="mt-0.5 px-1.5 text-[9px] text-white/25">…共 {incomingEdges.length} 条</p>
                ) : null}
              </div>
            ) : null}

            {outgoingSlice.length > 0 ? (
              <div>
                <p className="mb-1 text-[9px] uppercase tracking-wider text-white/20">下游</p>
                {outgoingSlice.map(edge => {
                  const title = nodeTitleById.get(edge.toNodeId) ?? '未知节点'
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => onSelectNode?.(edge.toNodeId)}
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10px] text-white/45 transition hover:bg-white/[0.05] hover:text-white/70"
                    >
                      <span className="text-white/25">→</span>
                      <span className="truncate">{edge.label ? `${edge.label} · ` : ''}{title}</span>
                    </button>
                  )
                })}
                {outgoingExtra > 0 ? (
                  <p className="mt-0.5 px-1.5 text-[9px] text-white/25">…共 {outgoingEdges.length} 条</p>
                ) : null}
              </div>
            ) : null}
          </Section>
        ) : null}

        {/* Asset */}
        <Section title="资产">
          {assetId ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] text-white/55">ID: …{assetShort}</p>
                <p className="mt-0.5 text-[9px] text-white/30">已保存为资产</p>
              </div>
              {projectId ? (
                <a
                  href={`/assets?highlight=${assetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 rounded-md border border-white/[0.08] px-2.5 py-1 text-[10px] text-white/45 transition hover:bg-white/[0.06] hover:text-white/70"
                >
                  查看资产 →
                </a>
              ) : null}
            </div>
          ) : node.status === 'done' ? (
            <p className="text-[10px] text-white/30">尚未保存为资产</p>
          ) : (
            <p className="text-[10px] text-white/20">生成完成后可保存为资产</p>
          )}
        </Section>

        {/* Spacer */}
        <div className="h-4" />
      </div>
    </div>
  )
}
