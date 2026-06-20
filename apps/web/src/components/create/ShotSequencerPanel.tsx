'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { DirectorToolPanelFrame } from '@/components/canvas/tools/DirectorToolPanelFrame'
import {
  getShotSequence,
  saveShotSequence,
  formatSequenceDuration,
} from '@/lib/canvas/shot-sequence'
import type { ShotSequenceItem } from '@/lib/canvas/shot-sequence'

interface CanvasNode {
  id: string
  title?: string
  kind: string
  durationSec?: number
}

interface ShotSequencerPanelProps {
  projectId: string
  nodes: CanvasNode[]
  onClose: () => void
  onSelectNode?: (nodeId: string) => void
}

function parseDuration(node: CanvasNode): number | undefined {
  if (node.durationSec != null && node.durationSec > 0) return node.durationSec
  const title = node.title ?? ''
  const m = /视频\s*(\d+)s/.exec(title)
  return m?.[1] != null ? parseInt(m[1], 10) : undefined
}

function isKnownNode(nodes: CanvasNode[], nodeId: string): boolean {
  return nodes.some((n) => n.id === nodeId)
}

function isShotNode(node: CanvasNode): boolean {
  return Boolean(node.title?.startsWith('镜头 ·'))
}

function nodeLabel(node: CanvasNode): string {
  const kindLabel = node.kind === 'video' ? '视频' : node.kind === 'image' ? '图片' : '文本'
  return node.title || `${kindLabel}节点`
}

function nodeKindIcon(node: CanvasNode): string {
  return node.kind === 'video' ? '🎬' : node.kind === 'image' ? '🖼️' : '📝'
}

export function ShotSequencerPanel({
  projectId,
  nodes,
  onClose,
  onSelectNode,
}: ShotSequencerPanelProps) {
  const [items, setItems] = useState<ShotSequenceItem[]>([])
  const [view, setView] = useState<'sequence' | 'picker'>('sequence')
  const [dirty, setDirty] = useState(false)
  const dragIndexRef = useRef<number | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const state = getShotSequence(projectId)
    setItems(state.items)
  }, [projectId])

  const handleSave = useCallback(() => {
    saveShotSequence(projectId, items)
    setDirty(false)
    onClose()
  }, [projectId, items, onClose])

  const handleSyncFromShotList = useCallback(() => {
    const shotNodes = nodes.filter(isShotNode)
    const synced: ShotSequenceItem[] = shotNodes.map((n, i) => ({
      nodeId: n.id,
      order: i + 1,
      durationSec: parseDuration(n),
      addedAt: new Date().toISOString(),
    }))
    setItems(synced)
    setDirty(true)
    setView('sequence')
  }, [nodes])

  const handleAddNode = useCallback((nodeId: string) => {
    setItems((prev) => {
      if (prev.some((item) => item.nodeId === nodeId)) return prev
      const node = nodes.find((n) => n.id === nodeId)
      return [
        ...prev,
        {
          nodeId,
          order: prev.length + 1,
          durationSec: node ? parseDuration(node) : undefined,
          addedAt: new Date().toISOString(),
        },
      ]
    })
    setDirty(true)
  }, [nodes])

  const handleRemove = useCallback((nodeId: string) => {
    setItems((prev) => prev.filter((item) => item.nodeId !== nodeId).map((item, i) => ({ ...item, order: i + 1 })))
    setDirty(true)
  }, [])

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) return
    setItems((prev) => {
      const next = [...prev]
      const moved = next.splice(from, 1)[0]
      if (moved == null) return prev
      next.splice(index, 0, moved)
      dragIndexRef.current = index
      return next.map((item, i) => ({ ...item, order: i + 1 }))
    })
    setDirty(true)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null
  }, [])

  const totalSec = items.reduce((acc, item) => {
    const node = nodes.find((n) => n.id === item.nodeId)
    const dur = item.durationSec ?? (node ? parseDuration(node) : undefined) ?? 0
    return acc + dur
  }, 0)

  const missingCount = items.filter((item) => !isKnownNode(nodes, item.nodeId)).length
  const aliveItems = items.filter((item) => isKnownNode(nodes, item.nodeId))
  const summary = items.length > 0
    ? `${items.length} 个镜头${totalSec > 0 ? ' · ' + formatSequenceDuration(totalSec) : ''}${missingCount > 0 ? ` · ${missingCount} 个节点已不存在` : ''}`
    : undefined

  const addedNodeIds = new Set(items.map((i) => i.nodeId))
  const pickableNodes = nodes.filter((n) => n.kind !== 'text' || true)

  return (
    <DirectorToolPanelFrame
      title="镜头编排器"
      titleEn="SHOT SEQUENCER"
      icon="🎞"
      accentColor="indigo"
      count={aliveItems.length}
      summary={summary}
      primaryLabel="保存顺序"
      primaryDisabled={!dirty && items.length === 0}
      onPrimary={handleSave}
      secondaryLabel={view === 'sequence' ? '从画布添加' : '返回序列'}
      onSecondary={() => setView(view === 'sequence' ? 'picker' : 'sequence')}
      clearLabel="从分镜表同步"
      onClear={handleSyncFromShotList}
      onClose={onClose}
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
    >
      {view === 'sequence' ? (
        <SequenceView
          items={items}
          nodes={nodes}
          onRemove={handleRemove}
          onSelectNode={onSelectNode}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          formatDuration={formatSequenceDuration}
          parseDuration={parseDuration}
        />
      ) : (
        <PickerView
          nodes={pickableNodes}
          addedNodeIds={addedNodeIds}
          onAdd={handleAddNode}
          onDone={() => setView('sequence')}
        />
      )}
    </DirectorToolPanelFrame>
  )
}

// ── Sequence View ──────────────────────────────────────────────────────────

interface SequenceViewProps {
  items: ShotSequenceItem[]
  nodes: CanvasNode[]
  onRemove: (nodeId: string) => void
  onSelectNode?: (nodeId: string) => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  formatDuration: (sec: number) => string
  parseDuration: (node: CanvasNode) => number | undefined
}

function SequenceView({
  items,
  nodes,
  onRemove,
  onSelectNode,
  onDragStart,
  onDragOver,
  onDragEnd,
  formatDuration,
  parseDuration,
}: SequenceViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="text-4xl opacity-30">🎞</span>
        <p className="text-[13px] text-white/40">暂无镜头</p>
        <p className="text-[11px] text-white/25">点击&ldquo;从画布添加&rdquo;选取节点，或点击&ldquo;从分镜表同步&rdquo;自动导入所有分镜节点</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 p-4">
      {items.map((item, index) => {
        const node = nodes.find((n) => n.id === item.nodeId)
        const isMissing = !node
        const dur = item.durationSec ?? (node ? parseDuration(node) : undefined)

        return (
          <div
            key={item.nodeId}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition cursor-grab active:cursor-grabbing ${
              isMissing
                ? 'border-red-500/20 bg-red-500/[0.04] opacity-50'
                : 'border-white/[0.07] bg-white/[0.025] hover:border-indigo-500/20 hover:bg-indigo-500/[0.04]'
            }`}
          >
            {/* Order badge */}
            <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-semibold text-white/40 select-none">
              {item.order}
            </span>

            {/* Drag handle */}
            <span className="flex-shrink-0 text-white/20 group-hover:text-white/40 transition select-none" aria-hidden="true">
              ⠿
            </span>

            {/* Node info */}
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5">
                {node && <span className="text-[12px]">{nodeKindIcon(node)}</span>}
                <span className={`truncate text-[12px] font-medium ${isMissing ? 'text-red-300/60' : 'text-white/75'}`}>
                  {isMissing ? `已删除节点 (${item.nodeId.slice(0, 6)}…)` : nodeLabel(node!)}
                </span>
              </span>
              {dur != null && dur > 0 ? (
                <span className="mt-0.5 block text-[10px] text-indigo-300/40">{formatDuration(dur)}</span>
              ) : null}
            </span>

            {/* Actions */}
            <div className="flex flex-shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              {!isMissing && onSelectNode ? (
                <button
                  type="button"
                  aria-label="定位节点"
                  onClick={() => onSelectNode(item.nodeId)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-[10px] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition"
                >
                  ↗
                </button>
              ) : null}
              <button
                type="button"
                aria-label="移除"
                onClick={() => onRemove(item.nodeId)}
                className="flex h-6 w-6 items-center justify-center rounded border border-white/10 bg-white/[0.04] text-[10px] text-white/50 hover:border-red-500/20 hover:bg-red-500/[0.08] hover:text-red-300/80 transition"
              >
                ×
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Picker View ────────────────────────────────────────────────────────────

interface PickerViewProps {
  nodes: CanvasNode[]
  addedNodeIds: Set<string>
  onAdd: (nodeId: string) => void
  onDone: () => void
}

function PickerView({ nodes, addedNodeIds, onAdd, onDone }: PickerViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center p-4">
        <span className="text-4xl opacity-30">🖼️</span>
        <p className="text-[13px] text-white/40">画布中暂无节点</p>
        <p className="text-[11px] text-white/25">先在画布上添加图片或视频节点，再来编排顺序</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] text-white/40">选择节点加入序列</p>
        <button
          type="button"
          onClick={onDone}
          className="text-[11px] text-indigo-300/70 hover:text-indigo-200 transition"
        >
          完成选择 →
        </button>
      </div>
      <div className="space-y-1.5">
        {nodes.map((node) => {
          const added = addedNodeIds.has(node.id)
          return (
            <div
              key={node.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                added
                  ? 'border-indigo-500/25 bg-indigo-500/[0.07] cursor-default'
                  : 'border-white/[0.07] bg-white/[0.025] hover:border-indigo-500/20 hover:bg-indigo-500/[0.04] cursor-pointer'
              }`}
              onClick={!added ? () => onAdd(node.id) : undefined}
              role={!added ? 'button' : undefined}
              tabIndex={!added ? 0 : undefined}
              onKeyDown={!added ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(node.id) } } : undefined}
            >
              <span className="text-[14px]">{nodeKindIcon(node)}</span>
              <span className="flex-1 min-w-0 truncate text-[12px] font-medium text-white/75">
                {nodeLabel(node)}
              </span>
              <span className={`flex-shrink-0 text-[10px] font-semibold ${added ? 'text-indigo-300/70' : 'text-white/25'}`}>
                {added ? '已加入' : '+ 添加'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
