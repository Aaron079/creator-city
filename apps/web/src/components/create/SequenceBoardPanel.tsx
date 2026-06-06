'use client'

import { useState, useCallback, useRef } from 'react'
import type { SequenceItem, SequenceRole, SeqNode, SeqEdge } from '@/lib/canvas/sequence-board'
import {
  buildDefaultSequence,
  buildSequenceReportText,
  formatDuration,
  hasAsset,
  isSequenceable,
  promptSummary,
  totalDurationSeconds,
} from '@/lib/canvas/sequence-board'

interface SequenceBoardPanelProps {
  nodes: SeqNode[]
  edges: SeqEdge[]
  onFocusNode: (nodeId: string) => void
  onClose: () => void
}

const ROLE_OPTIONS: Array<{ value: SequenceRole; label: string }> = [
  { value: 'main', label: '正片' },
  { value: 'alternate', label: '备选' },
  { value: 'redo', label: '待重做' },
  { value: 'reference', label: '参考' },
]

const ROLE_BADGE: Record<SequenceRole, string> = {
  main: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  alternate: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  redo: 'bg-red-500/20 text-red-400 border-red-500/30',
  reference: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const STATUS_BADGE: Record<string, string> = {
  done: 'bg-emerald-500/15 text-emerald-400',
  idle: 'bg-slate-500/15 text-slate-400',
  error: 'bg-red-500/15 text-red-400',
  running: 'bg-blue-500/15 text-blue-300',
  pending: 'bg-blue-500/15 text-blue-300',
}

const KIND_LABEL: Record<string, string> = {
  image: '图片',
  video: '视频',
  text: '文本',
}

function statusLabel(s: string | null | undefined): string {
  const map: Record<string, string> = {
    done: '可用',
    idle: '草案',
    error: '需重做',
    running: '处理中',
    pending: '处理中',
  }
  return map[s ?? ''] ?? (s ?? '?')
}

function NodeThumbnail({ node }: { node: SeqNode }) {
  const [imgErr, setImgErr] = useState(false)

  if (node.kind === 'image' && node.resultImageUrl && !imgErr) {
    return (
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#181b24]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={node.resultImageUrl}
          alt={node.title ?? ''}
          className="h-full w-full object-cover"
          onError={() => setImgErr(true)}
        />
      </div>
    )
  }

  if (node.kind === 'video' && node.resultVideoUrl) {
    return (
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#181b24]">
        <video
          src={node.resultVideoUrl}
          className="h-full w-full object-cover"
          autoPlay={false}
          muted
          preload="none"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="text-[16px]">▶</span>
        </div>
      </div>
    )
  }

  const kindIcons: Record<string, string> = { image: '🖼', video: '🎬', text: '📝' }
  return (
    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#181b24] text-xl">
      <span>{kindIcons[node.kind] ?? '◻'}</span>
    </div>
  )
}

export function SequenceBoardPanel({ nodes, edges, onFocusNode, onClose }: SequenceBoardPanelProps) {
  const sequenceable = nodes.filter(isSequenceable)

  const [items, setItems] = useState<SequenceItem[]>(() =>
    buildDefaultSequence(nodes, edges),
  )
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sequencedNodeIds = new Set(items.map((i) => i.nodeId))
  const poolNodes = sequenceable.filter((n) => !sequencedNodeIds.has(n.id))

  const handleReset = useCallback(() => {
    setItems(buildDefaultSequence(nodes, edges))
  }, [nodes, edges])

  const handleAddNode = useCallback((node: SeqNode) => {
    setItems((prev) => {
      const nextOrder = prev.length
      const newItem: SequenceItem = {
        id: `seq-${node.id}-${Date.now()}`,
        nodeId: node.id,
        order: nextOrder,
        label: `Shot ${String(nextOrder + 1).padStart(2, '0')}`,
        role: 'main',
        durationSeconds: node.kind === 'video' ? 5 : 3,
        note: '',
      }
      return [...prev, newItem]
    })
  }, [])

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const handleMoveUp = useCallback((id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      const tmp = next[idx - 1]!
      next[idx - 1] = next[idx]!
      next[idx] = tmp
      return next
    })
  }, [])

  const handleMoveDown = useCallback((id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      const tmp = next[idx + 1]!
      next[idx + 1] = next[idx]!
      next[idx] = tmp
      return next
    })
  }, [])

  const handleRoleChange = useCallback((id: string, role: SequenceRole) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, role } : i)))
  }, [])

  const handleDurationChange = useCallback((id: string, val: string) => {
    const n = Math.max(0, Math.min(3600, parseInt(val, 10) || 0))
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, durationSeconds: n } : i)))
  }, [])

  const handleNoteChange = useCallback((id: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)))
  }, [])

  const handleCopyReport = useCallback(async () => {
    const text = buildSequenceReportText(items, nodes)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback: noop — user can still see report in console
    }
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2200)
  }, [items, nodes])

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const mainCount = items.filter((i) => i.role === 'main').length
  const altCount = items.filter((i) => i.role === 'alternate').length
  const redoCount = items.filter((i) => i.role === 'redo').length
  const totalSec = totalDurationSeconds(items)

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] -translate-y-1/2 flex flex-col"
      style={{ width: 520, maxHeight: 'calc(100vh - 48px)' }}
      data-no-node-drag="true"
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/96 shadow-2xl backdrop-blur-xl" style={{ maxHeight: 'calc(100vh - 48px)' }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px]">🎞</span>
              <span className="text-[14px] font-semibold text-white/90">镜头序列编排器</span>
              <span className="rounded border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-400">Director</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              把画布中的已有节点编排成作品镜头顺序，标记正片/备选/待重做并估算总时长。不自动生成，不消耗 credits。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex-shrink-0 rounded-lg p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {/* Overview */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">序列总览</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/50 transition hover:border-white/20 hover:text-white/80"
                >
                  重新从画布生成序列
                </button>
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
                    copied
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                      : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  {copied ? '已复制 ✓' : '复制镜头清单'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: '序列镜头', value: items.length, color: 'text-white/80' },
                { label: '正片', value: mainCount, color: 'text-emerald-400' },
                { label: '备选', value: altCount, color: 'text-blue-400' },
                { label: '待重做', value: redoCount, color: 'text-red-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-white/4 px-3 py-2 text-center">
                  <div className={`text-[20px] font-bold ${color}`}>{value}</div>
                  <div className="text-[10px] text-white/40">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-white/4 px-3 py-2">
              <span className="text-[11px] text-white/50">正片总时长</span>
              <span className="text-[14px] font-semibold text-white/80">{formatDuration(totalSec)}</span>
            </div>
          </div>

          {/* Node pool */}
          {poolNodes.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">
                可加入节点 ({poolNodes.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {poolNodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5"
                  >
                    <NodeThumbnail node={node} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-white/70">
                          {node.title || `节点 ${node.id.slice(-6)}`}
                        </span>
                        <span className={`rounded px-1 py-0.5 text-[9px] ${STATUS_BADGE[node.status ?? ''] ?? 'bg-slate-500/15 text-slate-400'}`}>
                          {statusLabel(node.status)}
                        </span>
                        <span className="rounded bg-white/8 px-1 py-0.5 text-[9px] text-white/40">
                          {KIND_LABEL[node.kind] ?? node.kind}
                        </span>
                        {hasAsset(node) && (
                          <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-400">有资产</span>
                        )}
                      </div>
                      {node.prompt && (
                        <p className="mt-0.5 truncate text-[10px] text-white/30">
                          {promptSummary(node.prompt, 60)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddNode(node)}
                      className="flex-shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] text-white/60 transition hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-blue-300"
                    >
                      + 加入序列
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {poolNodes.length === 0 && items.length === 0 && (
            <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-8 text-center">
              <div className="mb-2 text-2xl">🎞</div>
              <div className="text-[13px] text-white/50">画布中暂无可加入序列的节点</div>
              <div className="mt-1 text-[11px] text-white/30">生成 image 或 video 节点后返回此处</div>
            </div>
          )}

          {/* Sequence list */}
          {items.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">
                序列 ({items.length})
              </div>
              <div className="flex flex-col gap-2">
                {items.map((item, idx) => {
                  const node = nodeMap.get(item.nodeId)
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/8 bg-white/3 p-3"
                    >
                      {/* Top row */}
                      <div className="flex items-start gap-3">
                        {/* Thumbnail */}
                        {node ? <NodeThumbnail node={node} /> : (
                          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#181b24] text-white/20 text-xs">?</div>
                        )}

                        <div className="min-w-0 flex-1">
                          {/* Label + badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-white/60">{item.label}</span>
                            <span className="text-[11px] font-medium text-white/80">
                              {node?.title || `节点 ${item.nodeId.slice(-6)}`}
                            </span>
                            {node && (
                              <span className={`rounded px-1 py-0.5 text-[9px] ${STATUS_BADGE[node.status ?? ''] ?? 'bg-slate-500/15 text-slate-400'}`}>
                                {statusLabel(node.status)}
                              </span>
                            )}
                            {node && (
                              <span className="rounded bg-white/8 px-1 py-0.5 text-[9px] text-white/40">
                                {KIND_LABEL[node.kind] ?? node.kind}
                              </span>
                            )}
                          </div>

                          {node?.prompt && (
                            <p className="mt-0.5 text-[10px] text-white/30 line-clamp-1">
                              {promptSummary(node.prompt, 70)}
                            </p>
                          )}
                          {node?.providerId && (
                            <p className="mt-0.5 text-[9px] text-white/20">{node.providerId}</p>
                          )}
                        </div>

                        {/* Up/Down/Remove */}
                        <div className="flex flex-shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(item.id)}
                            disabled={idx === 0}
                            className="rounded px-1.5 py-1 text-[10px] text-white/30 transition hover:bg-white/8 hover:text-white/70 disabled:opacity-20"
                            title="上移"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(item.id)}
                            disabled={idx === items.length - 1}
                            className="rounded px-1.5 py-1 text-[10px] text-white/30 transition hover:bg-white/8 hover:text-white/70 disabled:opacity-20"
                            title="下移"
                          >
                            ▼
                          </button>
                        </div>
                      </div>

                      {/* Controls row */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {/* Role */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-white/30">角色</span>
                          <select
                            value={item.role}
                            onChange={(e) => handleRoleChange(item.id, e.target.value as SequenceRole)}
                            className="rounded border border-white/10 bg-[#181b24] px-1.5 py-0.5 text-[11px] text-white/70 focus:outline-none"
                          >
                            {ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <span className={`rounded border px-1 py-0.5 text-[9px] ${ROLE_BADGE[item.role]}`}>
                            {ROLE_OPTIONS.find((o) => o.value === item.role)?.label ?? item.role}
                          </span>
                        </div>

                        {/* Duration */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-white/30">时长</span>
                          <input
                            type="number"
                            min={0}
                            max={3600}
                            value={item.durationSeconds}
                            onChange={(e) => handleDurationChange(item.id, e.target.value)}
                            className="w-14 rounded border border-white/10 bg-[#181b24] px-1.5 py-0.5 text-center text-[11px] text-white/70 focus:outline-none"
                          />
                          <span className="text-[10px] text-white/30">s</span>
                        </div>

                        {/* Focus + Remove */}
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onFocusNode(item.nodeId)}
                            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/40 transition hover:border-white/20 hover:text-white/70"
                          >
                            定位节点
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            className="rounded-lg border border-red-500/20 px-2 py-1 text-[10px] text-red-400/60 transition hover:border-red-500/40 hover:text-red-400"
                          >
                            移出
                          </button>
                        </div>
                      </div>

                      {/* Note */}
                      <textarea
                        value={item.note}
                        onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        placeholder="备注（可选）"
                        rows={1}
                        className="mt-2 w-full resize-none rounded-lg border border-white/8 bg-[#1a1d26] px-2.5 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty sequence hint when pool also empty */}
          {items.length === 0 && poolNodes.length > 0 && (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center">
              <div className="text-[12px] text-white/35">序列为空 — 从上方节点池加入镜头</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
