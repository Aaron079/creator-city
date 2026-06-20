'use client'

import { useState, useMemo } from 'react'
import { Check, Copy } from 'lucide-react'
import {
  LOOK_PACKAGES,
  LOOK_CATEGORY_LABELS,
  LOOK_KEYWORD_CATEGORY_LABELS,
  DEFAULT_SELECTED_CATEGORIES,
  filterLookPackages,
  buildLookApplyReportText,
  previewLookApply,
  type LookCategory,
  type LookPackage,
  type LookApplyTarget,
  type SelectedLookCategories,
} from '@/lib/canvas/look-packages'
import { DirectorToolPanelFrame, type DirectorSourceNode } from '@/components/canvas/tools/DirectorToolPanelFrame'

interface LookNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  resultText?: string | null
  resultImageUrl?: string | null
  status?: string | null
}

interface DerivedNodeRequest {
  sourceNodeId: string
  prompt: string
  lookName: string
}

interface LookPackagePanelProps {
  nodes: LookNode[]
  onApplyLook: (updates: Array<{ nodeId: string; prompt: string }>) => void
  onCreateDerivedNode?: (req: DerivedNodeRequest) => void
  onClose: () => void
  defaultSelectedNodeId?: string
  sourceNode?: DirectorSourceNode | null
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
      <div className="h-10 w-full" style={{ background: look.paletteGradient }} aria-hidden="true" />
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-[11px] font-semibold leading-tight text-white/90">{look.nameZh}</p>
          {isSelected && <Check size={11} className="mt-0.5 shrink-0 text-indigo-400" strokeWidth={2.5} />}
        </div>
        <p className="mt-0.5 text-[9px] text-white/35">{look.name}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {look.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded px-1 py-0.5 text-[9px] bg-white/8 text-white/50">{tag}</span>
          ))}
        </div>
      </div>
    </button>
  )
}

export function LookPackagePanel({ nodes, onApplyLook, onCreateDerivedNode, onClose, defaultSelectedNodeId, sourceNode }: LookPackagePanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<LookCategory | 'all'>('all')
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<SelectedLookCategories>(DEFAULT_SELECTED_CATEGORIES)
  const [targets, setTargets] = useState<LookApplyTarget[] | null>(null)
  const [applied, setApplied] = useState(false)
  const [copied, setCopied] = useState(false)

  const primaryNode = useMemo(
    () =>
      nodes.find((n) => n.id === defaultSelectedNodeId) ??
      nodes.find((n) => n.kind === 'image' || n.kind === 'video') ??
      null,
    [nodes, defaultSelectedNodeId],
  )

  const filteredLooks = useMemo(
    () => filterLookPackages(LOOK_PACKAGES, categoryFilter),
    [categoryFilter],
  )

  const selectedLook = useMemo(
    () => (selectedLookId ? LOOK_PACKAGES.find((p) => p.id === selectedLookId) ?? null : null),
    [selectedLookId],
  )

  function toggleCategory(key: keyof SelectedLookCategories) {
    setSelectedCategories((prev) => ({ ...prev, [key]: !prev[key] }))
    setTargets(null)
    setApplied(false)
  }

  function handlePreview() {
    if (!selectedLook || !primaryNode) return
    const result = previewLookApply(nodes, new Set([primaryNode.id]), selectedLook, selectedCategories)
    setTargets(result)
    setApplied(false)
  }

  function handleApply() {
    if (!targets || !selectedLook) return
    const updates = targets
      .filter((t) => !t.alreadyContains)
      .map((t) => ({ nodeId: t.nodeId, prompt: t.previewPrompt }))
    if (updates.length > 0) onApplyLook(updates)
    setApplied(true)
  }

  function handleCreateDerived() {
    if (!selectedLook || !primaryNode || !onCreateDerivedNode || !hasAnyCategory) return
    const result = previewLookApply(nodes, new Set([primaryNode.id]), selectedLook, selectedCategories)
    const target = result.find((t) => t.nodeId === primaryNode.id)
    if (target) {
      onCreateDerivedNode({
        sourceNodeId: primaryNode.id,
        prompt: target.previewPrompt,
        lookName: selectedLook.nameZh,
      })
    }
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

  const hasAnyCategory = Object.values(selectedCategories).some(Boolean)
  const canCreateDerived = !!selectedLook && !!primaryNode && hasAnyCategory && !!onCreateDerivedNode
  const canPreview = !!selectedLook && !!primaryNode && !targets && hasAnyCategory
  const canApply = !!targets && !applied && targets.some((t) => !t.alreadyContains)
  const updatedCount = targets ? targets.filter((t) => !t.alreadyContains).length : 0
  const skippedCount = targets ? targets.filter((t) => t.alreadyContains).length : 0

  const emptyPromptWarning = primaryNode
    ? (() => {
        const p = (primaryNode.prompt ?? primaryNode.resultText ?? '').trim()
        return !p || p.startsWith('[视觉风格:') || p.startsWith('[Look:')
      })()
    : false

  const summaryText = selectedLook?.nameZh ?? ''

  return (
    <div
      className="fixed inset-0 z-[1199] flex items-end justify-center bg-black/25 sm:items-center"
      role="presentation"
      data-no-node-drag="true"
      onPointerDown={(e) => { e.stopPropagation(); onClose() }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      <DirectorToolPanelFrame
        title="视觉风格"
        titleEn="Visual Style"
        icon="🎨"
        accentColor="indigo"
        count={selectedLookId ? 1 : 0}
        summary={summaryText || undefined}
        sourceNode={sourceNode}
        primaryLabel={onCreateDerivedNode ? '创建视觉风格版本' : '确认应用'}
        primaryDisabled={onCreateDerivedNode ? !canCreateDerived : !canApply}
        onPrimary={onCreateDerivedNode ? handleCreateDerived : handleApply}
        onClear={selectedLookId ? () => { setSelectedLookId(null); setTargets(null); setApplied(false) } : undefined}
        onClose={onClose}
        ariaLabel="视觉风格 / Visual Style"
      >
        {/* Safety notice */}
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
          <p className="text-[9px] leading-relaxed text-white/30">
            只改调色/光线/质感，保持主体和构图不变 · 不消耗 credits
          </p>
        </div>

        {/* Category filter */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setCategoryFilter(cat.id); setTargets(null); setApplied(false) }}
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
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
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

        {/* Look detail */}
        {selectedLook ? (
          <div className="mb-4 rounded-xl border border-white/8 bg-white/3 p-3">
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
            <div className="grid grid-cols-2 gap-1.5 text-[9px] mb-3">
              <div>
                <p className="mb-0.5 font-semibold text-white/35">适用场景</p>
                <p className="text-white/50">{selectedLook.bestFor}</p>
              </div>
              <div>
                <p className="mb-0.5 font-semibold text-white/35">不适合</p>
                <p className="text-white/50">{selectedLook.notFor}</p>
              </div>
            </div>
            {/* Keyword dimension selector */}
            <div className="rounded-lg border border-white/6 bg-white/3 px-2.5 py-2">
              <p className="mb-1.5 text-[9px] font-semibold text-white/40">选择追加维度</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(LOOK_KEYWORD_CATEGORY_LABELS) as Array<keyof SelectedLookCategories>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleCategory(key)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                      selectedCategories[key]
                        ? 'bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/40'
                        : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50'
                    }`}
                  >
                    {LOOK_KEYWORD_CATEGORY_LABELS[key]}
                  </button>
                ))}
              </div>
              {Object.values(selectedCategories).every((v) => !v) && (
                <p className="mt-1 text-[9px] text-amber-400/60">请至少选择一个维度</p>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-dashed border-white/8 p-3 text-center">
            <p className="text-[10px] text-white/30">选择一个风格包查看详情</p>
          </div>
        )}

        {/* Empty-prompt warning */}
        {emptyPromptWarning && primaryNode && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2.5">
            <p className="text-[10px] font-semibold text-amber-400 mb-1">⚠ 节点 Prompt 为空</p>
            <p className="text-[9px] leading-relaxed text-white/55">
              节点「{primaryNode.title ?? primaryNode.id}」没有主体描述，只有风格词无法生成图片。请先在 Prompt 框中写明主体，再应用视觉风格。
            </p>
          </div>
        )}

        {/* Apply-mode: preview results and report (non-derived path) */}
        {!onCreateDerivedNode && targets ? (
          <div className="mb-3 rounded-xl border border-white/8 bg-white/3 p-3">
            <p className="mb-1 text-[10px] font-semibold text-white/60">预览结果</p>
            {updatedCount > 0 && <p className="text-[10px] text-emerald-400/80">✓ 节点将被追加视觉风格词</p>}
            {skippedCount > 0 && <p className="text-[10px] text-amber-400/60">⚠ 节点已含类似片段，跳过</p>}
            {updatedCount === 0 && skippedCount > 0 && <p className="text-[10px] text-white/40">该节点已含此风格包，无需更新</p>}
          </div>
        ) : null}

        {applied ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3">
              <p className="text-[11px] font-semibold text-emerald-400 mb-1">视觉风格已追加到 Prompt ✓</p>
              <p className="text-[10px] leading-relaxed text-white/65">
                请确认 Prompt 有主体描述，再点击「重新生成」。
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyReport}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-medium transition ${
                copied ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/6 text-white/60 hover:bg-white/10 hover:text-white/80'
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
        ) : null}

        {/* Apply-mode preview button (non-derived, before preview) */}
        {!onCreateDerivedNode && !targets && !applied ? (
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
            {!primaryNode
              ? '请从节点顶部剪辑菜单打开'
              : !selectedLook
                ? '请先选择风格包'
                : !hasAnyCategory
                  ? '请至少选择一个维度'
                  : '生成预览'}
          </button>
        ) : null}

        {/* Apply-mode confirm button (non-derived, after preview) */}
        {!onCreateDerivedNode && targets && !applied ? (
          <div className="mt-2 flex gap-2">
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
                canApply ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-white/6 text-white/25 cursor-not-allowed'
              }`}
            >
              确认应用
            </button>
          </div>
        ) : null}
      </DirectorToolPanelFrame>
    </div>
  )
}
