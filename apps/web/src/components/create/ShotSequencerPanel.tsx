'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { DirectorToolPanelFrame } from '@/components/canvas/tools/DirectorToolPanelFrame'
import {
  getShotSequence,
  getShotSequenceDraft,
  saveShotSequenceDraft,
  clearShotSequenceDraft,
  clearLegacyShotSequence,
  normalizeShotSequenceItems,
  formatSequenceDuration,
} from '@/lib/canvas/shot-sequence'
import type { ShotSequenceItem, ShotSequenceState } from '@/lib/canvas/shot-sequence'

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
  initialCloudSequence?: ShotSequenceState | null
  onSaveToCloud: (items: ShotSequenceItem[]) => Promise<'success' | 'failed'>
}

type SyncStatus =
  | 'idle'
  | 'cloud-saved'
  | 'local-draft'
  | 'cloud-save-failed'
  | 'saving'
  | 'migration-available'
  | 'conflict'

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
  initialCloudSequence,
  onSaveToCloud,
}: ShotSequencerPanelProps) {
  const [items, setItems] = useState<ShotSequenceItem[]>([])
  const [view, setView] = useState<'sequence' | 'picker'>('sequence')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [legacyItems, setLegacyItems] = useState<ShotSequenceItem[] | null>(null)
  const [conflictCloudItems, setConflictCloudItems] = useState<ShotSequenceItem[] | null>(null)
  const dragIndexRef = useRef<number | null>(null)

  // Determine initial state: draft > cloud > legacy migration > empty
  useEffect(() => {
    const draft = getShotSequenceDraft(projectId)
    const cloud = initialCloudSequence ?? null
    const legacy = getShotSequence(projectId) // reads old creator-city:shot-sequence:{pid} key

    const hasCloud = cloud != null && cloud.items.length > 0
    const hasDraft = draft != null && draft.items.length > 0
    const hasLegacy = legacy.items.length > 0

    if (hasDraft && hasCloud) {
      const draftIds = draft.items.map((i) => i.nodeId).join(',')
      const cloudIds = cloud.items.map((i) => i.nodeId).join(',')
      if (draftIds !== cloudIds) {
        setItems(draft.items)
        setConflictCloudItems(cloud.items)
        setSyncStatus('conflict')
      } else {
        // Same content — draft already matches cloud, clean it up
        setItems(draft.items)
        clearShotSequenceDraft(projectId)
        setSyncStatus('cloud-saved')
      }
    } else if (hasDraft) {
      setItems(draft.items)
      setSyncStatus('local-draft')
    } else if (hasCloud) {
      setItems(cloud.items)
      setSyncStatus('cloud-saved')
    } else if (hasLegacy) {
      // Cloud is empty but user has old local-only data — offer migration
      setLegacyItems(legacy.items)
      setSyncStatus('migration-available')
      setItems([])
    }
    // else: empty state, syncStatus stays 'idle'
  }, [projectId, initialCloudSequence])

  // Auto-save draft whenever items change while dirty
  useEffect(() => {
    if (dirty && items.length > 0) {
      saveShotSequenceDraft(projectId, items)
    }
  }, [items, dirty, projectId])

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setSyncStatus('saving')
    const result = await onSaveToCloud(items)
    setSaving(false)
    if (result === 'success') {
      clearShotSequenceDraft(projectId)
      clearLegacyShotSequence(projectId)
      setDirty(false)
      setLegacyItems(null)
      setConflictCloudItems(null)
      setSyncStatus('cloud-saved')
      onClose()
    } else {
      saveShotSequenceDraft(projectId, items)
      setSyncStatus('cloud-save-failed')
    }
  }, [items, onSaveToCloud, projectId, onClose, saving])

  const handleCancel = useCallback(() => {
    if (dirty && !window.confirm('放弃未保存更改？')) return
    clearShotSequenceDraft(projectId)
    onClose()
  }, [dirty, projectId, onClose])

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
    setSyncStatus('local-draft')
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
    if (syncStatus === 'cloud-saved') setSyncStatus('local-draft')
  }, [nodes, syncStatus])

  const handleRemove = useCallback((nodeId: string) => {
    setItems((prev) => prev.filter((item) => item.nodeId !== nodeId).map((item, i) => ({ ...item, order: i + 1 })))
    setDirty(true)
    if (syncStatus === 'cloud-saved') setSyncStatus('local-draft')
  }, [syncStatus])

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
    if (syncStatus === 'cloud-saved') setSyncStatus('local-draft')
  }, [syncStatus])

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null
  }, [])

  // Migration: load legacy local items and save to cloud
  const handleMigrateFromLegacy = useCallback(async () => {
    if (!legacyItems) return
    const normalized = normalizeShotSequenceItems(legacyItems)
    setItems(normalized)
    setDirty(false)
    setSaving(true)
    setSyncStatus('saving')
    const result = await onSaveToCloud(normalized)
    setSaving(false)
    if (result === 'success') {
      clearShotSequenceDraft(projectId)
      clearLegacyShotSequence(projectId)
      setLegacyItems(null)
      setSyncStatus('cloud-saved')
      onClose()
    } else {
      saveShotSequenceDraft(projectId, normalized)
      setSyncStatus('cloud-save-failed')
    }
  }, [legacyItems, onSaveToCloud, projectId, onClose])

  const handleIgnoreLegacy = useCallback(() => {
    clearLegacyShotSequence(projectId)
    setLegacyItems(null)
    setSyncStatus('idle')
  }, [projectId])

  // Conflict resolution
  const handleUseCloudVersion = useCallback(() => {
    if (!conflictCloudItems) return
    setItems(conflictCloudItems)
    clearShotSequenceDraft(projectId)
    setConflictCloudItems(null)
    setSyncStatus('cloud-saved')
    setDirty(false)
  }, [conflictCloudItems, projectId])

  const handleUseDraftVersion = useCallback(() => {
    setConflictCloudItems(null)
    setSyncStatus('local-draft')
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
  const pickableNodes = nodes.filter(() => true)

  const primaryLabel = saving ? '保存中…' : '保存顺序'
  const primaryDisabled = saving || (items.length === 0 && !dirty && syncStatus !== 'cloud-save-failed')

  return (
    <DirectorToolPanelFrame
      title="镜头编排器"
      titleEn="SHOT SEQUENCER"
      icon="🎞"
      accentColor="indigo"
      count={aliveItems.length}
      summary={summary}
      primaryLabel={primaryLabel}
      primaryDisabled={primaryDisabled}
      onPrimary={() => { void handleSave() }}
      secondaryLabel={view === 'sequence' ? '从画布添加' : '返回序列'}
      onSecondary={() => setView(view === 'sequence' ? 'picker' : 'sequence')}
      clearLabel="从分镜表同步"
      onClear={handleSyncFromShotList}
      onClose={handleCancel}
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
    >
      {view === 'sequence' ? (
        <>
          <SyncStatusBanner
            status={syncStatus}
            legacyCount={legacyItems?.length ?? 0}
            conflictCloudCount={conflictCloudItems?.length ?? 0}
            onMigrate={() => { void handleMigrateFromLegacy() }}
            onIgnoreLegacy={handleIgnoreLegacy}
            onUseDraft={handleUseDraftVersion}
            onUseCloud={handleUseCloudVersion}
          />
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
        </>
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

// ── Sync Status Banner ─────────────────────────────────────────────────────

interface SyncStatusBannerProps {
  status: SyncStatus
  legacyCount: number
  conflictCloudCount: number
  onMigrate: () => void
  onIgnoreLegacy: () => void
  onUseDraft: () => void
  onUseCloud: () => void
}

function SyncStatusBanner({
  status,
  legacyCount,
  conflictCloudCount,
  onMigrate,
  onIgnoreLegacy,
  onUseDraft,
  onUseCloud,
}: SyncStatusBannerProps) {
  if (status === 'cloud-save-failed') {
    return (
      <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[11px] text-red-300/70">
        <span>⚠</span>
        <span>云端保存失败，草稿已保留在本机，点击&ldquo;保存顺序&rdquo;重试</span>
      </div>
    )
  }
  if (status === 'migration-available' && legacyCount > 0) {
    return (
      <div className="mx-4 mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-3">
        <p className="text-[11px] text-amber-200/70">发现本机保存的镜头顺序（{legacyCount} 个镜头），是否同步到项目？</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onMigrate}
            className="rounded-md border border-amber-500/30 bg-amber-500/[0.1] px-2.5 py-1 text-[10px] font-semibold text-amber-300/80 hover:bg-amber-500/[0.18] transition"
          >
            同步到项目
          </button>
          <button
            type="button"
            onClick={onIgnoreLegacy}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/40 hover:text-white/60 transition"
          >
            忽略
          </button>
        </div>
      </div>
    )
  }
  if (status === 'conflict' && conflictCloudCount > 0) {
    return (
      <div className="mx-4 mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] px-3 py-3">
        <p className="text-[11px] text-yellow-200/70">本机草稿与云端顺序不一致</p>
        <p className="mt-0.5 text-[10px] text-white/35">云端：{conflictCloudCount} 个镜头</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onUseDraft}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/60 hover:text-white/80 transition"
          >
            继续使用草稿
          </button>
          <button
            type="button"
            onClick={onUseCloud}
            className="rounded-md border border-indigo-500/20 bg-indigo-500/[0.08] px-2.5 py-1 text-[10px] text-indigo-300/70 hover:bg-indigo-500/[0.15] transition"
          >
            重载云端
          </button>
        </div>
      </div>
    )
  }
  if (status === 'local-draft') {
    return (
      <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-1.5 text-[10px] text-amber-200/50">
        <span aria-hidden="true">●</span>
        <span>有未保存更改（仅保存在本机）</span>
      </div>
    )
  }
  return null
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
