'use client'

import { useState, useMemo } from 'react'
import { Check, Copy, X } from 'lucide-react'
import {
  LOOK_PACKAGES,
  LOOK_CATEGORY_LABELS,
  filterLookPackages,
  buildLookApplyReportText,
  hasSimilarLook,
  previewLookApply,
  type LookCategory,
  type LookPackage,
  type LookApplyTarget,
} from '@/lib/canvas/look-packages'

interface LookNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  resultText?: string | null
  status?: string | null
}

interface LookPackagePanelProps {
  nodes: LookNode[]
  onApplyLook: (updates: Array<{ nodeId: string; prompt: string }>) => void
  onClose: () => void
}

const CATEGORIES: Array<{ id: LookCategory | 'all'; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'director-style', label: '导演风格' },
  { id: 'film-emulation', label: '胶片模拟' },
  { id: 'lut-grade', label: 'LUT调色' },
  { id: 'brand-commercial', label: '品牌商业' },
  { id: 'architecture-space', label: '建筑空间' },
  { id: 'social-photography', label: '社交摄影' },
]

function ContrastBadge({ value }: { value: LookPackage['contrast'] }) {
  const labels: Record<LookPackage['contrast'], string> = {
    low: '低对比', medium: '中对比', 'medium-high': '中高对比', high: '高对比', extreme: '极致对比',
  }
  return <span className="rounded px-1 py-0.5 text-[9px] bg-white/8 text-white/50">{labels[value]}</span>
}

function SaturationBadge({ value }: { value: LookPackage['saturation'] }) {
  const labels: Record<LookPackage['saturation'], string> = {
    'very-low': '极低饱和', low: '低饱和', medium: '中饱和', 'medium-high': '中高饱和', high: '高饱和', extreme: '极高饱和',
  }
  return <span className="rounded px-1 py-0.5 text-[9px] bg-white/8 text-white/50">{labels[value]}</span>
}

function LookCard({
  look,
  isSelected,
  onClick,
}: {
  look: LookPackage
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-xl border text-left transition-all duration-150 overflow-hidden ${
        isSelected
          ? 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_0_1px_rgba(99,102,241,0.3)]'
          : 'border-white/8 bg-white/3 hover:border-white/16 hover:bg-white/6'
      }`}
    >
      {/* Color swatch */}
      <div
        className="h-10 w-full"
        style={{ background: look.paletteGradient }}
        aria-hidden="true"
      />
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-[11px] font-semibold leading-tight text-white/90">{look.nameZh}</p>
          {isSelected && (
            <Check size={11} className="mt-0.5 shrink-0 text-indigo-400" strokeWidth={2.5} />
          )}
        </div>
        <p className="mt-0.5 text-[9px] text-white/35">{look.name}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {look.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded px-1 py-0.5 text-[9px] bg-white/8 text-white/50">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}

export function LookPackagePanel({ nodes, onApplyLook, onClose }: LookPackagePanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<LookCategory | 'all'>('all')
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    for (const n of nodes) {
      if (n.kind === 'image' || n.kind === 'video') ids.add(n.id)
    }
    return ids
  })
  const [targets, setTargets] = useState<LookApplyTarget[] | null>(null)
  const [applied, setApplied] = useState(false)
  const [copied, setCopied] = useState(false)

  const filteredLooks = useMemo(
    () => filterLookPackages(LOOK_PACKAGES, categoryFilter),
    [categoryFilter],
  )

  const selectedLook = useMemo(
    () => (selectedLookId ? LOOK_PACKAGES.find((p) => p.id === selectedLookId) ?? null : null),
    [selectedLookId],
  )

  const selectableNodes = nodes.filter(
    (n) => n.kind === 'text' || n.kind === 'image' || n.kind === 'video',
  )

  function toggleNode(id: string) {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setTargets(null)
    setApplied(false)
  }

  function toggleAllNodes() {
    if (selectedNodeIds.size === selectableNodes.length) {
      setSelectedNodeIds(new Set())
    } else {
      setSelectedNodeIds(new Set(selectableNodes.map((n) => n.id)))
    }
    setTargets(null)
    setApplied(false)
  }

  function handlePreview() {
    if (!selectedLook || selectedNodeIds.size === 0) return
    const result = previewLookApply(nodes, selectedNodeIds, selectedLook)
    setTargets(result)
    setApplied(false)
  }

  function handleApply() {
    if (!targets || !selectedLook) return
    const updates = targets
      .filter((t) => !t.alreadyContains)
      .map((t) => ({ nodeId: t.nodeId, prompt: t.previewPrompt }))
    if (updates.length > 0) {
      onApplyLook(updates)
    }
    setApplied(true)
  }

  function handleReset() {
    setTargets(null)
    setApplied(false)
  }

  function handleCopyReport() {
    if (!targets || !selectedLook) return
    const text = buildLookApplyReportText(selectedLook, targets)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  const canPreview = !!selectedLook && selectedNodeIds.size > 0 && !targets
  const canApply = !!targets && !applied && targets.some((t) => !t.alreadyContains)
  const updatedCount = targets ? targets.filter((t) => !t.alreadyContains).length : 0
  const skippedCount = targets ? targets.filter((t) => t.alreadyContains).length : 0

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] -translate-y-1/2 flex"
      style={{ maxHeight: 'calc(100vh - 48px)' }}
      data-no-node-drag="true"
    >
      <div
        className="flex w-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/97 shadow-2xl backdrop-blur-xl"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-white/90">视觉风格包</p>
            <p className="text-[10px] text-white/35">Look Package Applier · 只追加，不替换，不消耗 credits</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white/70"
            aria-label="关闭"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Category filter */}
          <div className="shrink-0 border-b border-white/6 px-4 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat.id)
                    setTargets(null)
                    setApplied(false)
                  }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                    categoryFilter === cat.id
                      ? 'bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/40'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Look card grid */}
          <div className="shrink-0 p-3">
            <div className="grid grid-cols-2 gap-2">
              {filteredLooks.map((look) => (
                <LookCard
                  key={look.id}
                  look={look}
                  isSelected={selectedLookId === look.id}
                  onClick={() => {
                    setSelectedLookId((prev) => (prev === look.id ? null : look.id))
                    setTargets(null)
                    setApplied(false)
                  }}
                />
              ))}
            </div>
          </div>

          {/* Look detail */}
          {selectedLook ? (
            <div className="mx-3 mb-3 shrink-0 rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="mb-2 flex items-start gap-2">
                <div
                  className="h-8 w-8 shrink-0 rounded-lg"
                  style={{ background: selectedLook.paletteGradient }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-white/90">{selectedLook.nameZh}</p>
                  <p className="text-[9px] text-white/35">{selectedLook.name}</p>
                </div>
              </div>
              <p className="mb-2 text-[10px] leading-relaxed text-white/60">{selectedLook.visualDescription}</p>
              <div className="mb-2 flex flex-wrap gap-1">
                <ContrastBadge value={selectedLook.contrast} />
                <SaturationBadge value={selectedLook.saturation} />
                <span className="rounded px-1 py-0.5 text-[9px] bg-white/8 text-white/50">
                  {LOOK_CATEGORY_LABELS[selectedLook.category]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                <div>
                  <p className="mb-0.5 font-semibold text-white/35">适用场景</p>
                  <p className="text-white/50">{selectedLook.bestFor}</p>
                </div>
                <div>
                  <p className="mb-0.5 font-semibold text-white/35">不适合</p>
                  <p className="text-white/50">{selectedLook.notFor}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-3 mb-3 shrink-0 rounded-xl border border-dashed border-white/8 p-3 text-center">
              <p className="text-[10px] text-white/30">选择一个风格包查看详情</p>
            </div>
          )}

          {/* Node selection */}
          <div className="mx-3 mb-3 shrink-0 rounded-xl border border-white/8 bg-white/3 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-white/60">应用到节点</p>
              <button
                type="button"
                onClick={toggleAllNodes}
                className="text-[9px] text-indigo-400/70 hover:text-indigo-300 transition"
              >
                {selectedNodeIds.size === selectableNodes.length ? '取消全选' : '全选'}
              </button>
            </div>
            {selectableNodes.length === 0 ? (
              <p className="text-[10px] text-white/30">画布上没有可用节点</p>
            ) : (
              <div className="flex flex-col gap-1">
                {selectableNodes.map((node) => {
                  const isChecked = selectedNodeIds.has(node.id)
                  const alreadyHasLook = selectedLook
                    ? hasSimilarLook((node.prompt ?? node.resultText ?? '').trim(), selectedLook)
                    : false
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => toggleNode(node.id)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                        isChecked
                          ? 'bg-indigo-500/12 text-white/80'
                          : 'bg-white/3 text-white/45 hover:bg-white/6 hover:text-white/60'
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${
                          isChecked
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-white/20 bg-transparent'
                        }`}
                      >
                        {isChecked && <Check size={9} strokeWidth={3} className="text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px]">{node.title ?? node.id}</span>
                        <span className="text-[9px] text-white/30">
                          {node.kind.toUpperCase()}
                          {alreadyHasLook ? ' · 已含此风格' : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          {/* Preview results */}
          {targets ? (
            <div className="mb-3 rounded-xl border border-white/8 bg-white/3 p-3">
              <p className="mb-1 text-[10px] font-semibold text-white/60">预览结果</p>
              {updatedCount > 0 && (
                <p className="text-[10px] text-emerald-400/80">✓ {updatedCount} 个节点将被追加</p>
              )}
              {skippedCount > 0 && (
                <p className="text-[10px] text-amber-400/60">⚠ {skippedCount} 个节点已含类似片段，跳过</p>
              )}
              {updatedCount === 0 && skippedCount > 0 && (
                <p className="text-[10px] text-white/40">所有选中节点已含该风格包，无需更新</p>
              )}
            </div>
          ) : null}

          {applied ? (
            <div className="mb-3 space-y-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3 text-center">
                <p className="text-[11px] font-semibold text-emerald-400">已成功应用风格包</p>
                <p className="text-[9px] text-white/40">Prompt 已追加，不会自动生成</p>
              </div>
              <button
                type="button"
                onClick={handleCopyReport}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-medium transition ${
                  copied
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-white/6 text-white/60 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
                {copied ? '已复制报告' : '复制操作报告'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-xl py-2 text-[11px] text-white/40 hover:text-white/60 transition"
              >
                继续选择其他风格包
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {targets ? (
                <>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 rounded-xl border border-white/10 py-2 text-[11px] text-white/50 transition hover:bg-white/5 hover:text-white/70"
                  >
                    重新选择
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={!canApply}
                    className={`flex-[2] rounded-xl py-2 text-[11px] font-semibold transition ${
                      canApply
                        ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                        : 'bg-white/6 text-white/25 cursor-not-allowed'
                    }`}
                  >
                    确认应用
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!canPreview}
                  className={`w-full rounded-xl py-2.5 text-[11px] font-semibold transition ${
                    canPreview
                      ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-500/30'
                      : 'bg-white/4 text-white/25 cursor-not-allowed'
                  }`}
                >
                  {!selectedLook
                    ? '请先选择风格包'
                    : selectedNodeIds.size === 0
                      ? '请选择要应用的节点'
                      : '生成预览'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
