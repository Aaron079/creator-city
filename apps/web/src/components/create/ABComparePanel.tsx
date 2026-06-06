'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Copy, ExternalLink, Play, Star, X } from 'lucide-react'
import { analyzePromptDiff, buildCompareReport, isComparableNode } from '@/lib/canvas/compare-utils'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'
import { getNodeImageUrl, getNodeVideoUrl } from '@/lib/canvas/media-urls'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'

interface ABComparePanelProps {
  nodes: VisualCanvasNode[]
  initialNodeAId?: string | null
  initialNodeBId?: string | null
  onFocusNode?: (nodeId: string) => void
  onClose: () => void
}

// ─── copy hook ────────────────────────────────────────────────────────────────

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000)
    } catch {
      // clipboard unavailable
    }
  }, [])
  return { copiedKey, copy }
}

// ─── diff badge ───────────────────────────────────────────────────────────────

function DiffBadge({ has, label }: { has: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
        has
          ? 'bg-violet-500/15 text-violet-300/80'
          : 'bg-white/[0.04] text-white/25'
      }`}
    >
      {has ? '✓' : '✗'} {label}
    </span>
  )
}

// ─── node selector ────────────────────────────────────────────────────────────

function NodeSelector({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: VisualCanvasNode[]
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[12px] text-white/75 outline-none focus:border-violet-500/40"
      >
        <option value="">— 请选择节点 —</option>
        {options.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title || (n.kind === 'image' ? '图片节点' : '视频节点')} · {n.kind} · {n.status}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── media preview ────────────────────────────────────────────────────────────

function MediaPreview({ node }: { node: VisualCanvasNode }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)

  const imageUrl = getProxiedMediaUrl(getNodeImageUrl(node))
  const videoUrl = getProxiedMediaUrl(getNodeVideoUrl(node))

  const handlePlayClick = () => {
    const v = videoRef.current
    if (!v) return
    if (videoPlaying) {
      v.pause()
      setVideoPlaying(false)
    } else {
      v.muted = true
      v.playsInline = true
      void v.play().then(() => setVideoPlaying(true)).catch(() => setVideoFailed(true))
    }
  }

  if (node.kind === 'image') {
    if (!imageUrl || imageFailed) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-[10px] text-white/30">
          预览暂不可用，资产记录仍保留
        </div>
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="h-32 w-full rounded-lg object-contain"
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (node.kind === 'video') {
    if (!videoUrl || videoFailed) {
      return (
        <div className="flex h-32 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-[10px] text-white/30">
          预览暂不可用，资产记录仍保留
        </div>
      )
    }
    return (
      <div className="relative h-32 overflow-hidden rounded-lg bg-black/40">
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-contain"
          playsInline
          muted
          onError={() => setVideoFailed(true)}
          onEnded={() => setVideoPlaying(false)}
        />
        <button
          type="button"
          onClick={handlePlayClick}
          className="absolute inset-0 flex items-center justify-center transition hover:bg-black/20"
          aria-label={videoPlaying ? '暂停' : '播放'}
        >
          {!videoPlaying && (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm">
              <Play size={16} fill="currentColor" />
            </span>
          )}
        </button>
      </div>
    )
  }

  return null
}

// ─── node column ──────────────────────────────────────────────────────────────

function NodeColumn({
  node,
  label,
  isWinner,
  copiedKey,
  onCopy,
  onMarkWinner,
  onFocusNode,
}: {
  node: VisualCanvasNode
  label: 'A' | 'B'
  isWinner: boolean
  copiedKey: string | null
  onCopy: (key: string, text: string) => Promise<void>
  onMarkWinner: () => void
  onFocusNode?: (id: string) => void
}) {
  const promptCopyKey = `prompt-${label}`
  const prompt = node.prompt?.trim() || ''

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border p-3 transition ${
        isWinner
          ? 'border-amber-400/30 bg-amber-400/[0.04]'
          : 'border-white/[0.07] bg-white/[0.02]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isWinner ? 'bg-amber-400/20 text-amber-300' : 'bg-white/[0.06] text-white/50'
          }`}
        >
          {label}
        </span>
        <div className="flex items-center gap-1">
          {onFocusNode && (
            <button
              type="button"
              title="在画布中定位节点"
              onClick={() => onFocusNode(node.id)}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/40 transition hover:border-white/20 hover:text-white/70"
            >
              <ExternalLink size={11} />
            </button>
          )}
          <button
            type="button"
            title={isWinner ? '已标记为推荐' : '标记为推荐版本'}
            onClick={onMarkWinner}
            className={`flex h-6 w-6 items-center justify-center rounded-md border transition ${
              isWinner
                ? 'border-amber-400/30 bg-amber-400/15 text-amber-300'
                : 'border-white/10 bg-white/[0.04] text-white/40 hover:border-amber-400/20 hover:text-amber-300/70'
            }`}
          >
            <Star size={11} fill={isWinner ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Media */}
      <MediaPreview node={node} />

      {/* Meta */}
      <div className="space-y-0.5 text-[10px] text-white/45">
        <p className="font-medium text-white/70">{node.title || '未命名节点'}</p>
        <p>{node.kind === 'image' ? '图片' : '视频'} · {node.status}</p>
        <p className="truncate text-white/30">{node.providerId || node.model || '未知模型'}</p>
        <p>资产 ID: {node.assetId ? <span className="text-emerald-400/70">已绑定</span> : <span className="text-white/25">未绑定</span>}</p>
      </div>

      {/* Prompt preview */}
      {prompt ? (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <p className="line-clamp-3 font-mono text-[9px] leading-relaxed text-white/40">{prompt}</p>
        </div>
      ) : (
        <p className="text-[9px] text-white/20">（无 Prompt）</p>
      )}

      {/* Copy prompt */}
      <button
        type="button"
        disabled={!prompt}
        onClick={() => void onCopy(promptCopyKey, prompt)}
        className="inline-flex h-6 items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-[10px] font-medium text-white/50 transition hover:border-white/15 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Copy size={10} />
        {copiedKey === promptCopyKey ? '已复制' : `复制 ${label} Prompt`}
      </button>
    </div>
  )
}

// ─── main panel ───────────────────────────────────────────────────────────────

export function ABComparePanel({
  nodes,
  initialNodeAId,
  initialNodeBId,
  onFocusNode,
  onClose,
}: ABComparePanelProps) {
  const { copiedKey, copy } = useCopy()

  const comparableNodes = useMemo(() => nodes.filter(isComparableNode), [nodes])

  const [selectedAId, setSelectedAId] = useState<string>(initialNodeAId ?? comparableNodes[0]?.id ?? '')
  const [selectedBId, setSelectedBId] = useState<string>(() => {
    if (initialNodeBId) return initialNodeBId
    const others = comparableNodes.filter((n) => n.id !== (initialNodeAId ?? comparableNodes[0]?.id))
    return others[0]?.id ?? ''
  })
  const [winner, setWinner] = useState<'A' | 'B' | null>(null)

  const nodeA = useMemo(() => nodes.find((n) => n.id === selectedAId) ?? null, [nodes, selectedAId])
  const nodeB = useMemo(() => nodes.find((n) => n.id === selectedBId) ?? null, [nodes, selectedBId])

  const diff = useMemo(
    () => (nodeA && nodeB ? analyzePromptDiff(nodeA.prompt ?? '', nodeB.prompt ?? '') : null),
    [nodeA, nodeB],
  )

  const handleCopyReport = useCallback(async () => {
    if (!nodeA || !nodeB || !diff) return
    await copy('report', buildCompareReport(nodeA, nodeB, winner, diff))
  }, [copy, nodeA, nodeB, diff, winner])

  const hasValidPair = Boolean(nodeA && nodeB && nodeA.id !== nodeB.id)

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[90vh] w-[440px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/96 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      data-smart-toolbar-panel="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.07] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">资产版本对比</p>
          <h2 className="mt-1 text-sm font-semibold text-white/90">A-B Compare</h2>
          <p className="mt-0.5 text-[11px] text-white/40">比较两个已有节点，选择后续使用版本。不自动生成，不消耗 credits。</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
          aria-label="关闭版本对比"
        >
          <X size={13} />
        </button>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-3 border-b border-white/[0.07] px-4 py-3">
        <NodeSelector
          label="版本 A"
          value={selectedAId}
          options={comparableNodes}
          onChange={(id) => {
            setSelectedAId(id)
            setWinner(null)
          }}
        />
        <NodeSelector
          label="版本 B"
          value={selectedBId}
          options={comparableNodes}
          onChange={(id) => {
            setSelectedBId(id)
            setWinner(null)
          }}
        />
      </div>

      {/* No comparable nodes */}
      {comparableNodes.length < 2 ? (
        <div className="flex-1 px-5 py-8 text-center">
          <p className="text-sm font-medium text-white/40">需要至少两个图片或视频节点</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/25">
            请先在画布上创建并生成至少两个图片或视频节点，或确保节点有 Prompt / 资产 ID。
          </p>
        </div>
      ) : !hasValidPair ? (
        <div className="flex-1 px-5 py-8 text-center">
          <p className="text-sm font-medium text-white/40">请选择两个不同的节点</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/25">
            A 和 B 选择了同一个节点，请更改其中一个。
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* A / B columns */}
          <div className="grid grid-cols-2 gap-3 px-4 py-3">
            {nodeA && (
              <NodeColumn
                node={nodeA}
                label="A"
                isWinner={winner === 'A'}
                copiedKey={copiedKey}
                onCopy={copy}
                onMarkWinner={() => setWinner((w) => (w === 'A' ? null : 'A'))}
                onFocusNode={onFocusNode}
              />
            )}
            {nodeB && (
              <NodeColumn
                node={nodeB}
                label="B"
                isWinner={winner === 'B'}
                copiedKey={copiedKey}
                onCopy={copy}
                onMarkWinner={() => setWinner((w) => (w === 'B' ? null : 'B'))}
                onFocusNode={onFocusNode}
              />
            )}
          </div>

          {/* Prompt diff */}
          {diff && (
            <div className="mx-4 mb-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                Prompt 差异分析
              </p>

              {/* Length */}
              <div className="mb-2 grid grid-cols-2 gap-1.5 text-[10px] text-white/45">
                <span>A 长度：<span className="font-mono text-white/70">{diff.aLength} 字</span></span>
                <span>B 长度：<span className="font-mono text-white/70">{diff.bLength} 字</span></span>
              </div>

              {/* Unique keywords */}
              {(diff.aOnlyKeywords.length > 0 || diff.bOnlyKeywords.length > 0) && (
                <div className="mb-2 space-y-1.5 text-[10px]">
                  {diff.aOnlyKeywords.length > 0 && (
                    <div>
                      <span className="text-white/30">A 独有词：</span>
                      <span className="text-white/55">{diff.aOnlyKeywords.join('、')}</span>
                    </div>
                  )}
                  {diff.bOnlyKeywords.length > 0 && (
                    <div>
                      <span className="text-white/30">B 独有词：</span>
                      <span className="text-white/55">{diff.bOnlyKeywords.join('、')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Attribute badges — A */}
              <div className="mb-1 flex flex-wrap gap-1">
                <span className="text-[9px] font-semibold text-white/25">A：</span>
                <DiffBadge has={diff.aHasPortrait} label="人物" />
                <DiffBadge has={diff.aHasShot} label="镜头" />
                <DiffBadge has={diff.aHasLight} label="光线" />
                <DiffBadge has={diff.aHasEmotion} label="情绪" />
              </div>

              {/* Attribute badges — B */}
              <div className="flex flex-wrap gap-1">
                <span className="text-[9px] font-semibold text-white/25">B：</span>
                <DiffBadge has={diff.bHasPortrait} label="人物" />
                <DiffBadge has={diff.bHasShot} label="镜头" />
                <DiffBadge has={diff.bHasLight} label="光线" />
                <DiffBadge has={diff.bHasEmotion} label="情绪" />
              </div>

              {winner && (
                <p className="mt-2.5 text-[10px] font-semibold text-amber-300/70">
                  ★ 已标记推荐版本：{winner} — {winner === 'A' ? nodeA?.title || '版本 A' : nodeB?.title || '版本 B'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {hasValidPair && nodeA && nodeB && diff && (
        <div className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-3">
          <button
            type="button"
            onClick={() => void handleCopyReport()}
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] py-1.5 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.07] hover:text-white/80"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Copy size={11} />
              {copiedKey === 'report' ? '已复制对比报告' : '复制对比报告'}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/[0.07] bg-transparent px-3 py-1.5 text-[11px] text-white/40 transition hover:text-white/60"
          >
            关闭
          </button>
        </div>
      )}
    </div>
  )
}
